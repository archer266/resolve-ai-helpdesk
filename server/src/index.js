import "dotenv/config";
import cors from "cors";
import express from "express";
import { PrismaClient } from "@prisma/client";
import { isOpenAIEnabled, triageTicket } from "./triage.js";

const app = express();
const prisma = new PrismaClient();
const port = Number(process.env.PORT || 3001);

app.use(cors());
app.use(express.json({ limit: "100kb" }));

app.get("/api/health", (_request, response) => response.json({ ok: true }));
app.get("/api/ai/status", (_request, response) => response.json({ enabled: isOpenAIEnabled(), model: process.env.OPENAI_MODEL || "gpt-4o-mini" }));

app.get("/api/tickets", async (request, response, next) => {
  try {
    const search = String(request.query.search || "").trim();
    const tickets = await prisma.ticket.findMany({
      where: search ? { OR: [{ title: { contains: search } }, { description: { contains: search } }, { requester: { contains: search } }] } : undefined,
      orderBy: { createdAt: "desc" },
    });
    response.json(tickets);
  } catch (error) { next(error); }
});

app.post("/api/tickets", async (request, response, next) => {
  try {
    const requester = String(request.body.requester || "").trim();
    const title = String(request.body.title || "").trim();
    const description = String(request.body.description || "").trim();
    if (requester.length < 2 || title.length < 4 || description.length < 12) {
      return response.status(400).json({ error: "Please include your name, a clear title, and a useful description." });
    }
    const triage = await triageTicket({ title, description });
    const ticket = await prisma.ticket.create({ data: {
      requester, title, description,
      category: triage.category,
      priority: triage.priority,
      summary: triage.summary,
      suggestedAction: triage.suggestedAction,
      aiConfidence: triage.confidence,
      triageSource: triage.source,
    } });
    response.status(201).json(ticket);
  } catch (error) { next(error); }
});

app.patch("/api/tickets/:id/status", async (request, response, next) => {
  try {
    const statuses = ["Open", "In Progress", "Resolved"];
    if (!statuses.includes(request.body.status)) return response.status(400).json({ error: "Invalid ticket status." });
    const ticket = await prisma.ticket.update({ where: { id: Number(request.params.id) }, data: { status: request.body.status } });
    response.json(ticket);
  } catch (error) { next(error); }
});

app.post("/api/tickets/:id/retriage", async (request, response, next) => {
  try {
    const existing = await prisma.ticket.findUnique({ where: { id: Number(request.params.id) } });
    if (!existing) return response.status(404).json({ error: "Ticket not found." });
    const triage = await triageTicket(existing);
    const ticket = await prisma.ticket.update({ where: { id: existing.id }, data: {
      category: triage.category,
      priority: triage.priority,
      summary: triage.summary,
      suggestedAction: triage.suggestedAction,
      aiConfidence: triage.confidence,
      triageSource: triage.source,
    } });
    response.json(ticket);
  } catch (error) { next(error); }
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ error: "Resolve could not complete that request." });
});

const server = app.listen(port, () => console.log(`Resolve API running at http://localhost:${port}`));

async function shutdown() {
  await prisma.$disconnect();
  server.close(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
