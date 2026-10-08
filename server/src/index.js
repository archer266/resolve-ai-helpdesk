import "./config.js";
import { PrismaClient } from "@prisma/client";
import { createApp } from "./app.js";

const prisma = new PrismaClient();
const port = Number(process.env.PORT || 3001);
const app = createApp({ prisma });
const server = app.listen(port, () => console.log(`Resolve API running at http://localhost:${port}`));
server.on("error", async (error) => {
  console.error(error.code === "EADDRINUSE" ? `Port ${port} is already in use. Stop the other Resolve server or change PORT.` : "Resolve could not start its server.");
  await prisma.$disconnect();
  process.exitCode = 1;
});
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  server.close(async () => { await prisma.$disconnect(); process.exit(0); });
  server.closeIdleConnections();
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
