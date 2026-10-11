import { hostname } from "node:os";
import pg from "pg";
import { z } from "zod";
import {
  claimNextOutboxEvent,
  processClaimedOutboxEvent,
  recordOutboxFailure,
  safeErrorMessage,
} from "./outbox.js";

const config = z
  .object({
    APP_VERSION: z.string().default("development"),
    DATABASE_URL: z.string().min(1),
    WORKER_ID: z.string().trim().min(3).max(100).optional(),
    WORKER_LEASE_SECONDS: z.coerce.number().int().min(10).max(300).default(30),
    WORKER_POLL_INTERVAL_MS: z.coerce.number().int().min(1_000).max(60_000).default(10_000),
  })
  .parse(process.env);

const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  max: 5,
  statement_timeout: 10_000,
});
const workerId = config.WORKER_ID ?? `${hostname()}:${process.pid}`;
let stopping = false;
let wakeSleep: (() => void) | null = null;
let lastHeartbeat = 0;

function log(level: "info" | "error", event: string, fields: Record<string, unknown> = {}) {
  const output = JSON.stringify({
    level,
    service: "worker",
    event,
    workerId,
    version: config.APP_VERSION,
    at: new Date().toISOString(),
    ...fields,
  });
  (level === "error" ? process.stderr : process.stdout).write(`${output}\n`);
}

async function sleep(milliseconds: number) {
  if (stopping) return;
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      wakeSleep = null;
      resolve();
    }, milliseconds);
    wakeSleep = () => {
      clearTimeout(timeout);
      wakeSleep = null;
      resolve();
    };
  });
}

async function tick() {
  const claimed = await claimNextOutboxEvent(pool, workerId, config.WORKER_LEASE_SECONDS);
  if (!claimed) {
    if (Date.now() - lastHeartbeat >= 60_000) {
      lastHeartbeat = Date.now();
      log("info", "heartbeat");
    }
    return;
  }
  try {
    const result = await processClaimedOutboxEvent(pool, claimed, workerId);
    log("info", "outbox_processed", {
      outboxEventId: claimed.id,
      tenantId: claimed.tenantId,
      eventType: claimed.eventType,
      result,
    });
  } catch (error) {
    const status = await recordOutboxFailure(pool, claimed, workerId, error);
    log("error", "outbox_failed", {
      outboxEventId: claimed.id,
      tenantId: claimed.tenantId,
      eventType: claimed.eventType,
      attempt: claimed.attempts,
      status,
      error: safeErrorMessage(error),
    });
  }
}

async function run() {
  log("info", "started");
  while (!stopping) {
    try {
      await tick();
    } catch (error) {
      log("error", "poll_failed", { error: safeErrorMessage(error) });
    }
    await sleep(config.WORKER_POLL_INTERVAL_MS);
  }
  await pool.end();
  log("info", "stopped");
}

function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  log("info", "shutdown_requested", { signal });
  wakeSleep?.();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

await run();
