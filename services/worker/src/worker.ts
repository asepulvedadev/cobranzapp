import pg from "pg";
import { z } from "zod";

const config = z
  .object({
    DATABASE_URL: z.string().min(1),
    WORKER_POLL_INTERVAL_MS: z.coerce.number().int().min(1_000).default(10_000),
  })
  .parse(process.env);

const pool = new pg.Pool({ connectionString: config.DATABASE_URL, max: 5 });
let stopping = false;

async function tick() {
  await pool.query("SELECT 1");
  process.stdout.write(
    `${JSON.stringify({ level: "info", service: "worker", event: "heartbeat", at: new Date().toISOString() })}\n`,
  );
}

async function run() {
  while (!stopping) {
    try {
      await tick();
    } catch (error) {
      process.stderr.write(
        `${JSON.stringify({ level: "error", service: "worker", error: String(error), at: new Date().toISOString() })}\n`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, config.WORKER_POLL_INTERVAL_MS));
  }
}

async function shutdown() {
  stopping = true;
  await pool.end();
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

await run();
