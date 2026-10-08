import cors from "cors";
import express from "express";
import { isOpenAIEnabled, triageTicket as defaultTriage } from "./triage.js";

const statuses = ["New", "In Progress", "Waiting", "Resolved"];
const priorities = ["Low", "Medium", "High", "Critical"];
const categories = ["Hardware", "Software", "Networking", "Account", "Security", "Other"];
const includeActivity = { activities: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } };

class RequestError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
function text(value, label, min = 1, max = 200) {
  if (typeof value !== "string" || value.trim().length < min || value.trim().length > max) {
    throw new RequestError(400, `${label} must contain ${min}–${max} characters.`);
  }
  return value.trim();
}
function ticketId(value) {
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) throw new RequestError(400, "Invalid ticket ID.");
  return Number(value);
}
function actor(body) { return body.author === undefined ? "Support team" : text(body.author, "Author", 1, 80); }
function normalizeStatus(status) { return status === "Open" ? "New" : status; }
function articleInput(body, allowId = false) {
  const title = text(body.title, "Article title", 5, 200);
  const summary = text(body.summary, "Article summary", 10, 1000);
  if (!categories.includes(body.category)) throw new RequestError(400, "Invalid article category.");
  if (!Array.isArray(body.steps) || !body.steps.length || body.steps.length > 30) throw new RequestError(400, "Provide 1–30 resolution steps.");
  const data = { title, summary, category: body.category, steps: JSON.stringify(body.steps.map((step) => text(step, "Each step", 1, 1000))) };
  if (allowId) {
    if (typeof body.id !== "string" || !/^[\w-]{1,100}$/.test(body.id)) throw new RequestError(400, "Invalid article ID.");
    data.id = body.id;
  }
  return data;
}
function articleResponse(article) { return { ...article, steps: JSON.parse(article.steps) }; }

export function createApp({ prisma, triageTicket = defaultTriage }) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "150kb" }));
  app.get("/api/health", async (_request, response) => {
    try { await prisma.$queryRaw`SELECT 1 FROM "Ticket" LIMIT 1`; response.json({ ok: true }); }
    catch { response.status(503).json({ ok: false, error: "Database unavailable. Run npm run db:setup." }); }
  });
  app.get("/api/ai/status", (_request, response) => response.json({ enabled: isOpenAIEnabled(), model: process.env.OPENAI_MODEL || "gpt-4o-mini" }));
  app.get("/api/tickets", async (request, response) => {
    const search = typeof request.query.search === "string" ? request.query.search.trim().slice(0, 200) : "";
    const tickets = await prisma.ticket.findMany({
      where: search ? { OR: ["title", "description", "requester", "assignedTo"].map((field) => ({ [field]: { contains: search } })) } : undefined,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], include: includeActivity,
    });
    response.json(tickets);
  });
  app.get("/api/tickets/:id", async (request, response) => {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId(request.params.id) }, include: includeActivity });
    if (!ticket) throw new RequestError(404, "Ticket not found.");
    response.json(ticket);
  });
  app.post("/api/tickets", async (request, response) => {
    const body = request.body || {};
    const requester = text(body.requester, "Requester name", 2, 80);
    const title = text(body.title, "Ticket title", 4, 200);
    const description = text(body.description, "Description", 12, 10000);
    const triage = await triageTicket({ title, description });
    const ticket = await prisma.ticket.create({ data: {
      requester, title, description, category: triage.category, priority: triage.priority,
      summary: triage.summary, suggestedAction: triage.suggestedAction, aiConfidence: triage.confidence, triageSource: triage.source,
      activities: { create: { type: "created", body: `Ticket created with ${triage.source === "openai" ? "OpenAI" : "local fallback"} triage.`, author: requester } },
    }, include: includeActivity });
    response.status(201).json(ticket);
  });
  async function updateTicket(request, response) {
    const id = ticketId(request.params.id);
    const body = request.body || {};
    const author = actor(body);
    const changes = {};
    if (body.status !== undefined) {
      const status = normalizeStatus(body.status);
      if (!statuses.includes(status)) throw new RequestError(400, "Invalid ticket status.");
      changes.status = status;
    }
    if (body.priority !== undefined) {
      if (!priorities.includes(body.priority)) throw new RequestError(400, "Invalid ticket priority.");
      changes.priority = body.priority;
    }
    if (body.assignedTo !== undefined) changes.assignedTo = text(body.assignedTo, "Assigned technician", 0, 80);
    if (!Object.keys(changes).length) throw new RequestError(400, "Include a status, priority, or assigned technician.");
    const ticket = await prisma.$transaction(async (db) => {
      const existing = await db.ticket.findUnique({ where: { id } });
      if (!existing) throw new RequestError(404, "Ticket not found.");
      const events = [];
      const data = {};
      for (const [field, value] of Object.entries(changes)) {
        if (existing[field] === value) continue;
        data[field] = value;
        if (field === "status") {
          data.resolvedAt = value === "Resolved" ? new Date() : null;
          events.push({ type: "status", body: `Status changed from ${existing.status} to ${value}.`, author });
        } else if (field === "assignedTo") events.push({ type: "assignment", body: value ? `Assigned to ${value}.` : "Ticket unassigned.", author });
        else events.push({ type: "priority", body: `Priority changed from ${existing.priority} to ${value}.`, author });
      }
      if (!events.length) return db.ticket.findUnique({ where: { id }, include: includeActivity });
      return db.ticket.update({ where: { id }, data: { ...data, activities: { create: events } }, include: includeActivity });
    });
    response.json(ticket);
  }
  app.patch("/api/tickets/:id", updateTicket);
  app.patch("/api/tickets/:id/status", (request, response) => {
    if (!(request.body || {}).status) throw new RequestError(400, "Include a ticket status.");
    return updateTicket(request, response);
  });
  app.post("/api/tickets/:id/comments", async (request, response) => {
    const id = ticketId(request.params.id);
    const body = request.body || {};
    const type = body.type || "reply";
    if (!["reply", "note"].includes(type)) throw new RequestError(400, "Choose a reply or a team note.");
    const ticket = await prisma.ticket.update({ where: { id }, data: {
      updatedAt: new Date(), activities: { create: { type, body: text(body.body, "Comment", 1, 5000), author: actor(body) } },
    }, include: includeActivity });
    response.status(201).json(ticket);
  });
  app.post("/api/tickets/:id/retriage", async (request, response) => {
    const id = ticketId(request.params.id);
    const author = actor(request.body || {});
    const existing = await prisma.ticket.findUnique({ where: { id } });
    if (!existing) throw new RequestError(404, "Ticket not found.");
    const triage = await triageTicket(existing);
    const ticket = await prisma.ticket.update({ where: { id }, data: {
      category: triage.category, priority: triage.priority, summary: triage.summary,
      suggestedAction: triage.suggestedAction, aiConfidence: triage.confidence, triageSource: triage.source,
      activities: { create: { type: "triage", body: `Triage refreshed using ${triage.source === "openai" ? "OpenAI" : "local fallback"}. Priority: ${triage.priority}.`, author } },
    }, include: includeActivity });
    response.json(ticket);
  });
  app.get("/api/articles", async (_request, response) => {
    response.json((await prisma.knowledgeArticle.findMany({ orderBy: [{ createdAt: "desc" }, { id: "asc" }] })).map(articleResponse));
  });
  app.post("/api/articles", async (request, response) => {
    response.status(201).json(articleResponse(await prisma.knowledgeArticle.create({ data: articleInput(request.body || {}) })));
  });
  app.post("/api/articles/import", async (request, response) => {
    const articles = request.body?.articles;
    if (!Array.isArray(articles) || articles.length > 100) throw new RequestError(400, "Import at most 100 articles at a time.");
    const data = articles.map((article) => articleInput(article || {}, true));
    await prisma.$transaction(async (db) => {
      for (const article of data) await db.knowledgeArticle.upsert({ where: { id: article.id }, update: {}, create: article });
    }, { timeout: 20000 });
    response.json({ imported: data.length });
  });
  app.post("/api/articles/:id/helpful", async (request, response) => {
    const article = await prisma.knowledgeArticle.update({ where: { id: request.params.id }, data: { helpfulCount: { increment: 1 } } });
    response.json(articleResponse(article));
  });
  app.delete("/api/articles/:id", async (request, response) => {
    await prisma.knowledgeArticle.delete({ where: { id: request.params.id } });
    response.status(204).end();
  });
  app.use((_request, response) => response.status(404).json({ error: "That Resolve route does not exist." }));
  app.use((error, _request, response, _next) => {
    if (error instanceof RequestError) return response.status(error.status).json({ error: error.message });
    if (error.code === "P2025") return response.status(404).json({ error: "The requested item no longer exists. Refresh and try again." });
    if (error.type === "entity.parse.failed") return response.status(400).json({ error: "Request must contain valid JSON." });
    if (error.type === "entity.too.large") return response.status(413).json({ error: "The request is too large." });
    if (["P1001", "P2021", "P2022"].includes(error.code)) return response.status(503).json({ error: "Database unavailable. Run npm run db:setup and restart Resolve." });
    console.error("Resolve request failed:", error.code || error.name);
    response.status(500).json({ error: "Resolve could not complete that request. Please try again." });
  });
  return app;
}
