// Additive, transactional SQLite setup for both fresh installs and older Resolve databases.
// Never drop a table or reset a database to introduce a new required field.
export async function initializeDatabase(prisma) {
  await prisma.$transaction(async (db) => {
    await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "Ticket" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "requester" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "category" TEXT NOT NULL DEFAULT 'Other',
      "priority" TEXT NOT NULL DEFAULT 'Medium',
      "status" TEXT NOT NULL DEFAULT 'New',
      "summary" TEXT NOT NULL DEFAULT '',
      "suggestedAction" TEXT NOT NULL DEFAULT '',
      "aiConfidence" REAL NOT NULL DEFAULT 0,
      "triageSource" TEXT NOT NULL DEFAULT 'fallback',
      "assignedTo" TEXT NOT NULL DEFAULT '',
      "resolvedAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )`);
    const columns = new Set((await db.$queryRawUnsafe('PRAGMA table_info("Ticket")')).map((column) => column.name));
    if (!columns.has("id")) throw new Error("This Ticket table has an unsupported structure. Existing data was left unchanged.");
    const additions = {
      requester: "TEXT NOT NULL DEFAULT 'Unknown requester'",
      title: "TEXT NOT NULL DEFAULT 'Untitled request'",
      description: "TEXT NOT NULL DEFAULT ''",
      category: "TEXT NOT NULL DEFAULT 'Other'",
      priority: "TEXT NOT NULL DEFAULT 'Medium'",
      status: "TEXT NOT NULL DEFAULT 'New'",
      summary: "TEXT NOT NULL DEFAULT ''",
      suggestedAction: "TEXT NOT NULL DEFAULT ''",
      aiConfidence: "REAL NOT NULL DEFAULT 0",
      triageSource: "TEXT NOT NULL DEFAULT 'fallback'",
      assignedTo: "TEXT NOT NULL DEFAULT ''",
      resolvedAt: "DATETIME",
      createdAt: "DATETIME NOT NULL DEFAULT '1970-01-01T00:00:00.000Z'",
      updatedAt: "DATETIME NOT NULL DEFAULT '1970-01-01T00:00:00.000Z'",
    };
    for (const [name, definition] of Object.entries(additions)) {
      if (!columns.has(name)) await db.$executeRawUnsafe(`ALTER TABLE "Ticket" ADD COLUMN "${name}" ${definition}`);
    }
    await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "TicketActivity" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "ticketId" INTEGER NOT NULL,
      "type" TEXT NOT NULL,
      "body" TEXT NOT NULL,
      "author" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "TicketActivity_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`);
    await db.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "TicketActivity_ticketId_createdAt_idx" ON "TicketActivity"("ticketId", "createdAt")');
    await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "KnowledgeArticle" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "title" TEXT NOT NULL,
      "category" TEXT NOT NULL,
      "summary" TEXT NOT NULL,
      "steps" TEXT NOT NULL,
      "helpfulCount" INTEGER NOT NULL DEFAULT 0,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )`);
    await db.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS "AppMetadata" ("key" TEXT NOT NULL PRIMARY KEY, "value" TEXT NOT NULL)');
    await db.$executeRaw`UPDATE "Ticket" SET "status" = 'New' WHERE "status" = 'Open'`;
    await db.$executeRaw`UPDATE "Ticket" SET "summary" = substr("description", 1, 180) WHERE "summary" = ''`;
    await db.$executeRaw`UPDATE "Ticket" SET "createdAt" = ${new Date()} WHERE "createdAt" = '1970-01-01T00:00:00.000Z'`;
    await db.$executeRaw`UPDATE "Ticket" SET "updatedAt" = "createdAt" WHERE "updatedAt" = '1970-01-01T00:00:00.000Z'`;
    // Historical tickets get an explicit import event; do not invent old conversations or resolution times.
    await db.$executeRawUnsafe(`INSERT INTO "TicketActivity" ("ticketId", "type", "body", "author")
      SELECT "id", 'imported', 'Existing ticket preserved during the Resolve upgrade.', 'Resolve'
      FROM "Ticket" WHERE NOT EXISTS (SELECT 1 FROM "TicketActivity" WHERE "ticketId" = "Ticket"."id")`);
    await db.$executeRawUnsafe(`INSERT INTO "AppMetadata" ("key", "value") VALUES ('schemaVersion', '1')
      ON CONFLICT("key") DO UPDATE SET "value" = '1'`);
  }, { timeout: 20000 });
}
