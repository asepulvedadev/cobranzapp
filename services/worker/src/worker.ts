import { hostname } from "node:os";
import { createHermesIdentityExtractor } from "@cobranzapp/hermes-ocr";
import { createHermesCollectionRoutePlanner } from "@cobranzapp/hermes-routes";
import pg from "pg";
import { z } from "zod";
import {
  claimNextOutboxEvent,
  processClaimedOutboxEvent,
  recordOutboxFailure,
  safeErrorMessage,
} from "./outbox.js";
import { planNextDayRoutes } from "./routes.js";
import { reconcileSubscriptions } from "./subscriptions.js";

const config = z
  .object({
    APP_VERSION: z.string().default("development"),
    DATABASE_URL: z.string().min(1),
    WORKER_ID: z.string().trim().min(3).max(100).optional(),
    WORKER_LEASE_SECONDS: z.coerce.number().int().min(10).max(300).default(120),
    WORKER_POLL_INTERVAL_MS: z.coerce.number().int().min(1_000).max(60_000).default(10_000),
    BORROWER_DOCUMENTS_ROOT: z.string().min(1).default("/var/lib/cobranzapp/documents"),
    BORROWER_IDENTITY_KEY: z.string().min(32).optional(),
    HERMES_OCR_URL: z.url().optional(),
    HERMES_OCR_API_KEY: z.string().min(32).optional(),
    HERMES_OCR_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(120_000).default(45_000),
    HERMES_ROUTES_URL: z.url().optional(),
    HERMES_ROUTES_API_KEY: z.string().min(32).optional(),
    HERMES_ROUTES_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(120_000).default(30_000),
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
let lastRoutePlanningCheck = 0;
let lastSubscriptionCheck = 0;
const identityExtractor =
  config.HERMES_OCR_URL && config.HERMES_OCR_API_KEY
    ? createHermesIdentityExtractor({
        endpoint: config.HERMES_OCR_URL,
        apiKey: config.HERMES_OCR_API_KEY,
        timeoutMs: config.HERMES_OCR_TIMEOUT_MS,
      })
    : undefined;
const routePlanner =
  config.HERMES_ROUTES_URL && config.HERMES_ROUTES_API_KEY
    ? createHermesCollectionRoutePlanner({
        endpoint: config.HERMES_ROUTES_URL,
        apiKey: config.HERMES_ROUTES_API_KEY,
        timeoutMs: config.HERMES_ROUTES_TIMEOUT_MS,
      })
    : undefined;

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
  if (Date.now() - lastSubscriptionCheck >= 60_000) {
    lastSubscriptionCheck = Date.now();
    try {
      const subscriptionSummary = await reconcileSubscriptions(pool);
      if (subscriptionSummary.renewed > 0 || subscriptionSummary.expired > 0) {
        log("info", "subscriptions_reconciled", subscriptionSummary);
      }
    } catch (error) {
      log("error", "subscription_reconciliation_failed", { error: safeErrorMessage(error) });
    }
  }
  if (Date.now() - lastRoutePlanningCheck >= 60_000) {
    lastRoutePlanningCheck = Date.now();
    try {
      const routeSummary = await planNextDayRoutes(pool, routePlanner);
      if (routeSummary.tenantsGenerated > 0) {
        log("info", "routes_generated", routeSummary);
      }
    } catch (error) {
      log("error", "route_generation_failed", { error: safeErrorMessage(error) });
    }
  }
  const claimed = await claimNextOutboxEvent(pool, workerId, config.WORKER_LEASE_SECONDS);
  if (!claimed) {
    if (Date.now() - lastHeartbeat >= 60_000) {
      lastHeartbeat = Date.now();
      log("info", "heartbeat");
    }
    return;
  }
  try {
    const result = await processClaimedOutboxEvent(pool, claimed, workerId, {
      documentsRoot: config.BORROWER_DOCUMENTS_ROOT,
      identitySecret: config.BORROWER_IDENTITY_KEY,
      identityExtractor,
    });
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
