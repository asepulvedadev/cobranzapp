import pg from "pg";
import { buildApp } from "./app.js";
import { parseMfaEncryptionKey } from "./auth/mfa.js";
import { createPostgresAuthService } from "./auth/postgres-auth-service.js";
import { createLocalBorrowerDocumentStorage } from "./borrowers/document-storage.js";
import { createPostgresBorrowerService } from "./borrowers/postgres-borrower-service.js";
import { loadConfig, parseAllowedOrigins } from "./config.js";
import { createResendContactMailer } from "./contact/resend.js";
import { createPostgresCreditService } from "./credit/postgres-credit-service.js";
import { createPostgresPlatformService } from "./platform/postgres-platform-service.js";
import { createPostgresSupportAccessService } from "./support-access/postgres-support-access-service.js";
import { createPostgresTenancyService } from "./tenancy/postgres-tenancy-service.js";
import { createPostgresVerificationNetworkService } from "./verification-network/postgres-verification-network-service.js";

const config = loadConfig();
const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  max: 10,
  statement_timeout: 10_000,
});

const app = buildApp({
  contactMailer: config.RESEND_API_KEY
    ? createResendContactMailer({
        apiKey: config.RESEND_API_KEY,
        from: config.RESEND_FROM,
        to: config.CONTACT_TO_EMAIL,
      })
    : undefined,
  allowedWebOrigins: parseAllowedOrigins(config.ALLOWED_WEB_ORIGINS),
  borrowerService: config.BORROWER_IDENTITY_KEY
    ? createPostgresBorrowerService(pool, config.BORROWER_IDENTITY_KEY)
    : undefined,
  creditService: createPostgresCreditService(pool),
  documentStorage: config.BORROWER_IDENTITY_KEY
    ? createLocalBorrowerDocumentStorage(config.BORROWER_DOCUMENTS_ROOT)
    : undefined,
  authService: createPostgresAuthService(
    pool,
    config.SESSION_TTL_HOURS,
    parseMfaEncryptionKey(config.MFA_ENCRYPTION_KEY),
  ),
  checkDatabase: async () => {
    await pool.query("SELECT 1");
  },
  isProduction: config.NODE_ENV === "production",
  platformService: createPostgresPlatformService(pool),
  sessionTtlHours: config.SESSION_TTL_HOURS,
  supportAccessService: createPostgresSupportAccessService(pool),
  tenancyService: createPostgresTenancyService(pool, config.PUBLIC_WEB_URL),
  verificationNetworkService: createPostgresVerificationNetworkService(
    pool,
    config.VERIFICATION_NETWORK_HMAC_KEY,
  ),
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
