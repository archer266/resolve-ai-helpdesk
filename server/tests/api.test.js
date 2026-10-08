import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { createApp } from "../src/app.js";
import { initializeDatabase } from "../prisma/setup.js";

test("ticket workflow and shared articles survive errors and a database reconnect", async (t) => {
  delete process.env.OPENAI_API_KEY;
  const directory = await mkdtemp(join(tmpdir(), "resolve-api-test-"));
  const url = `file:${join(directory, "test.db")}`;
  const prisma = new PrismaClient({ datasourceUrl: url });
  await initializeDatabase(prisma);
  const server = createApp({ prisma }).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
    await rm(directory, { recursive: true, force: true });
  });
  async function request(path, method = "GET", body) {
    const response = await fetch(`${base}${path}`, { method, headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, body: response.status === 204 ? null : await response.json() };
  }
  let id;
  let articleId;
  await t.test("creates a ticket with local fallback and a creation event", async () => {
    const result = await request("/api/tickets", "POST", { requester: "Test employee", title: "VPN disconnects", description: "My company VPN disconnects every few minutes after I connect." });
    assert.equal(result.status, 201);
    assert.equal(result.body.status, "New");
    assert.equal(result.body.triageSource, "fallback");
    assert.equal(result.body.category, "Networking");
    assert.equal(result.body.activities[0].type, "created");
    id = result.body.id;
  });
  await t.test("assigns, changes priority, and waits with an atomic history", async () => {
    const result = await request(`/api/tickets/${id}`, "PATCH", { assignedTo: "Casey Agent", priority: "Critical", status: "Waiting", author: "Test analyst" });
    assert.equal(result.status, 200);
    assert.equal(result.body.assignedTo, "Casey Agent");
    assert.equal(result.body.status, "Waiting");
    assert.equal(result.body.activities.length, 4);
    assert.deepEqual(result.body.activities.slice(1).map((event) => event.author), Array(3).fill("Test analyst"));
    const unchanged = await request(`/api/tickets/${id}`, "PATCH", { status: "Waiting", assignedTo: "Casey Agent" });
    assert.equal(unchanged.body.activities.length, 4);
    const invalid = await request(`/api/tickets/${id}`, "PATCH", { assignedTo: "Should not save", status: "Not a status" });
    assert.equal(invalid.status, 400);
    assert.equal((await request(`/api/tickets/${id}`)).body.assignedTo, "Casey Agent");
  });
  await t.test("records replies and team notes, and rejects empty comments", async () => {
    for (const type of ["reply", "note"]) {
      const result = await request(`/api/tickets/${id}/comments`, "POST", { type, body: `A saved ${type} with a second line\nMore details.`, author: "Casey Agent" });
      assert.equal(result.status, 201);
      assert.equal(result.body.activities.at(-1).type, type);
    }
    assert.equal((await request(`/api/tickets/${id}/comments`, "POST", { body: "   " })).status, 400);
    assert.equal((await request(`/api/tickets/${id}/comments`, "POST", { body: "hello", type: "secret" })).status, 400);
  });
  await t.test("resolves, reopens through the legacy route, and tracks fresh triage", async () => {
    const resolved = await request(`/api/tickets/${id}/status`, "PATCH", { status: "Resolved" });
    assert.equal(resolved.body.status, "Resolved");
    assert.ok(resolved.body.resolvedAt);
    const reopened = await request(`/api/tickets/${id}/status`, "PATCH", { status: "Open" });
    assert.equal(reopened.body.status, "New");
    assert.equal(reopened.body.resolvedAt, null);
    const triaged = await request(`/api/tickets/${id}/retriage`, "POST", { author: "Casey Agent" });
    assert.equal(triaged.status, 200);
    assert.equal(triaged.body.activities.at(-1).type, "triage");
    assert.equal(triaged.body.assignedTo, "Casey Agent");
  });
  await t.test("returns useful 400/404 errors for malformed requests and missing records", async () => {
    for (const invalid of ["not-a-number", "0", "-1", "1.5", "9007199254740993"]) assert.equal((await request(`/api/tickets/${invalid}/status`, "PATCH", { status: "New" })).status, 400);
    assert.equal((await request("/api/tickets/99999/status", "PATCH", { status: "New" })).status, 404);
    assert.equal((await request("/api/tickets/99999/comments", "POST", { body: "A valid comment" })).status, 404);
    assert.equal((await request("/api/tickets", "POST", { requester: { name: "invalid" }, title: "Valid title", description: "A useful description of the problem." })).status, 400);
    const invalidJson = await fetch(`${base}/api/tickets`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{broken" });
    assert.equal(invalidJson.status, 400);
    assert.match((await invalidJson.json()).error, /valid JSON/);
    assert.equal((await request("/api/not-real")).status, 404);
  });
  await t.test("publishes and rates an article, imports browser articles without overwriting data", async () => {
    const data = { title: "VPN troubleshooting guide", category: "Networking", summary: "A shared solution for repeated VPN connection failures.", steps: ["Check the local connection.", "Capture the VPN log."] };
    const created = await request("/api/articles", "POST", data);
    assert.equal(created.status, 201);
    articleId = created.body.id;
    const helpful = await request(`/api/articles/${articleId}/helpful`, "POST");
    assert.equal(helpful.body.helpfulCount, 1);
    assert.deepEqual(helpful.body.steps, data.steps);
    const imported = { id: "old-browser-article", ...data };
    assert.equal((await request("/api/articles/import", "POST", { articles: [imported] })).status, 200);
    assert.equal((await request("/api/articles/import", "POST", { articles: [{ ...imported, title: "Changed browser title" }] })).status, 200);
    const articles = (await request("/api/articles")).body;
    assert.equal(articles.length, 2);
    assert.equal(articles.find((article) => article.id === imported.id).title, data.title);
    const invalid = await request("/api/articles/import", "POST", { articles: [{ ...imported, id: "must-not-import" }, { id: "invalid", ...data, steps: [] }] });
    assert.equal(invalid.status, 400);
    assert.equal(await prisma.knowledgeArticle.findUnique({ where: { id: "must-not-import" } }), null);
  });
  await t.test("retains ticket conversations and shared articles after reconnecting", async () => {
    await prisma.$disconnect();
    const connected = new PrismaClient({ datasourceUrl: url });
    try {
      const ticket = await connected.ticket.findUnique({ where: { id }, include: { activities: true } });
      assert.equal(ticket.assignedTo, "Casey Agent");
      assert.equal(ticket.activities.filter((event) => ["reply", "note"].includes(event.type)).length, 2);
      assert.equal((await connected.knowledgeArticle.findUnique({ where: { id: articleId } })).helpfulCount, 1);
    } finally { await connected.$disconnect(); }
    assert.equal((await request(`/api/articles/${articleId}`, "DELETE")).status, 204);
    assert.equal((await request(`/api/articles/${articleId}`, "DELETE")).status, 404);
  });
});
