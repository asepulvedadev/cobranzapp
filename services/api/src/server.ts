import pg from "pg";
import { buildApp } from "./app.js";
import { createPostgresAuthService } from "./auth/postgres-auth-service.js";
import { loadConfig, parseAllowedOrigins } from "./config.js";
import { createPostgresPlatformService } from "./platform/postgres-platform-service.js";

const config = loadConfig();
const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  max: 10,
  statement_timeout: 10_000,
});

const app = buildApp({
  allowedWebOrigins: parseAllowedOrigins(config.ALLOWED_WEB_ORIGINS),
  authService: createPostgresAuthService(pool, config.SESSION_TTL_HOURS),
  checkDatabase: async () => {
    await pool.query("SELECT 1");
  },
  isProduction: config.NODE_ENV === "production",
  platformService: createPostgresPlatformService(pool),
  sessionTtlHours: config.SESSION_TTL_HOURS,
  version: process.env.APP_VERSION ?? "development",
});

async function shutdown(signal: string) {
  app.log.info({ signal }, "Shutting down");
  await app.close();
  await pool.end();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await app.listen({ host: config.API_HOST, port: config.API_PORT });
} catch (error) {
  app.log.error(error);
  await pool.end();
  process.exit(1);
}
