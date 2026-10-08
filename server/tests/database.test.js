import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { initializeDatabase } from "../prisma/setup.js";
import { seedDatabase } from "../prisma/seed.js";

async function database(t) {
  const directory = await mkdtemp(join(tmpdir(), "resolve-db-test-"));
  const prisma = new PrismaClient({ datasourceUrl: `file:${join(directory, "test.db")}` });
  t.after(async () => { await prisma.$disconnect(); await rm(directory, { recursive: true, force: true }); });
  return prisma;
}

test("an old database upgrades without losing tickets, custom fields, or original timestamps", async (t) => {
  const prisma = await database(t);
  await prisma.$executeRawUnsafe(`CREATE TABLE "Ticket" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT, "requester" TEXT NOT NULL,
    "title" TEXT NOT NULL, "description" TEXT NOT NULL, "priority" TEXT NOT NULL,
    "status" TEXT NOT NULL, "createdAt" DATETIME NOT NULL, "updatedAt" DATETIME NOT NULL,
    "legacyTag" TEXT
  )`);
  const created = new Date("2026-09-15T10:00:00Z");
  const updated = new Date("2026-09-16T11:00:00Z");
  for (let id = 1; id <= 4; id++) await prisma.$executeRaw`INSERT INTO "Ticket"
    ("id", "requester", "title", "description", "priority", "status", "createdAt", "updatedAt", "legacyTag")
    VALUES (${id}, 'Original requester', ${`Legacy ticket ${id}`}, 'Original description and troubleshooting steps', 'High', ${id === 4 ? "Resolved" : "Open"}, ${created}, ${updated}, 'keep-me')`;
  await initializeDatabase(prisma);
  await seedDatabase(prisma);
  const tickets = await prisma.ticket.findMany({ orderBy: { id: "asc" }, include: { activities: true } });
  assert.equal(tickets.length, 4);
  for (const [index, ticket] of tickets.entries()) {
    assert.equal(ticket.id, index + 1);
    assert.equal(ticket.title, `Legacy ticket ${index + 1}`);
    assert.equal(ticket.requester, "Original requester");
    assert.equal(ticket.description, "Original description and troubleshooting steps");
    assert.equal(ticket.priority, "High");
    assert.equal(ticket.createdAt.toISOString(), created.toISOString());
    assert.equal(ticket.updatedAt.toISOString(), updated.toISOString());
    assert.equal(ticket.status, index === 3 ? "Resolved" : "New");
    assert.equal(ticket.category, "Other");
    assert.equal(ticket.summary, ticket.description);
    assert.equal(ticket.activities.length, 1);
    assert.equal(ticket.activities[0].type, "imported");
    assert.equal(ticket.resolvedAt, null);
  }
  assert.deepEqual((await prisma.$queryRawUnsafe('SELECT "legacyTag" FROM "Ticket"')).map((row) => row.legacyTag), Array(4).fill("keep-me"));
  await initializeDatabase(prisma);
  await seedDatabase(prisma);
  assert.equal(await prisma.ticket.count(), 4);
  assert.equal(await prisma.ticketActivity.count(), 4);
  assert.equal(await prisma.knowledgeArticle.count(), 4);
  const next = await prisma.ticket.create({ data: { requester: "New employee", title: "New ticket after upgrade", description: "Created successfully with the new schema defaults." } });
  assert.equal(next.status, "New");
  assert.equal(next.category, "Other");
});

test("fresh setup works, and repeating it preserves edits and deleted starter articles", async (t) => {
  const prisma = await database(t);
  await initializeDatabase(prisma);
  await seedDatabase(prisma);
  assert.equal(await prisma.ticket.count(), 3);
  assert.equal(await prisma.knowledgeArticle.count(), 4);
  const ticket = await prisma.ticket.findFirst();
  await prisma.ticket.update({ where: { id: ticket.id }, data: { assignedTo: "Real technician", status: "Waiting" } });
  await prisma.knowledgeArticle.delete({ where: { id: "kb-vpn" } });
  await initializeDatabase(prisma);
  await seedDatabase(prisma);
  const preserved = await prisma.ticket.findUnique({ where: { id: ticket.id } });
  assert.equal(preserved.assignedTo, "Real technician");
  assert.equal(preserved.status, "Waiting");
  assert.equal(await prisma.knowledgeArticle.findUnique({ where: { id: "kb-vpn" } }), null);
  assert.equal(await prisma.ticket.count(), 3);
});
