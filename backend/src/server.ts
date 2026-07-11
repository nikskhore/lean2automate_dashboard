import cron from "node-cron";
import { createApp } from "./app";
import { env } from "./config/env";
import { prisma } from "./lib/prisma";
import { materializeDueRules } from "./services/recurring";

const app = createApp();

const server = app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[server] Finance Tracker API listening on http://localhost:${env.PORT}`);
});

// Daily in-process scheduler that generates due recurring transactions.
// Disable via ENABLE_CRON=false when an external cron (e.g. Cloudflare) drives it instead.
if (env.ENABLE_CRON) {
  cron.schedule("0 2 * * *", async () => {
    try {
      const result = await materializeDueRules();
      if (result.created > 0) {
        // eslint-disable-next-line no-console
        console.log(`[cron] generated ${result.created} recurring transaction(s)`);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[cron] recurring materialization failed", err);
    }
  });
}

async function shutdown(signal: string): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`\n[server] ${signal} received, shutting down...`);
  server.close(() => undefined);
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
