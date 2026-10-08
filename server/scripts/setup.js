import "../src/config.js";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { initializeDatabase } from "../prisma/setup.js";
import { seedDatabase } from "../prisma/seed.js";

const serverRoot = fileURLToPath(new URL("../", import.meta.url));
const generated = spawnSync(process.execPath, [fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url)), "generate"], {
  cwd: serverRoot, env: process.env, stdio: "inherit",
});
if (generated.error || generated.status !== 0) {
  console.error("Resolve could not generate its database client.");
  process.exit(1);
}
const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
try {
  await initializeDatabase(prisma);
  await seedDatabase(prisma);
  console.log("Resolve database is ready. Existing tickets and articles were preserved.");
} catch (error) {
  console.error("Database setup failed:", error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
