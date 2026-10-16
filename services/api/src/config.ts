import { z } from "zod";

const configSchema = z.object({
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1),
  ALLOWED_WEB_ORIGINS: z.string().default("http://localhost:3000"),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().max(168).default(8),
  MFA_ENCRYPTION_KEY: z.string().min(43).max(44),
  BORROWER_IDENTITY_KEY: z.string().min(32).optional(),
  BORROWER_DOCUMENTS_ROOT: z.string().min(1).default(".data/documents"),
  VERIFICATION_NETWORK_HMAC_KEY: z.string().min(32).optional(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PUBLIC_WEB_URL: z.url().default("http://localhost:3000"),
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM: z.string().min(1).default("cobranzapp <contacto@cobranzaap.tech>"),
  CONTACT_TO_EMAIL: z.email().default("info@cobranzaap.tech"),
  GEOCODING_ENDPOINT: z.url().default("https://nominatim.openstreetmap.org/search"),
  HERMES_OCR_URL: z.url().optional(),
  HERMES_OCR_API_KEY: z.string().min(32).optional(),
  HERMES_OCR_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(120_000).default(45_000),
});

export type ApiConfig = z.infer<typeof configSchema>;

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): ApiConfig {
  return configSchema.parse(environment);
}

export function parseAllowedOrigins(value: string) {
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}
