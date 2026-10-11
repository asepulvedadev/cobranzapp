import process from "node:process";
import pg from "pg";
import { z } from "zod";
import { hashPassword } from "../auth/password.js";

const configSchema = z.object({
  DATABASE_URL: z.string().min(1),
  DEVELOPER_USERNAME: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,40}$/),
  DEVELOPER_EMAIL: z.email().transform((value) => value.toLowerCase()),
  DEVELOPER_DISPLAY_NAME: z.string().trim().min(2).max(100).default("Desarrollador"),
  DEVELOPER_PASSWORD: z.string().min(12).max(256),
});

const config = configSchema.parse(process.env);
const pool = new pg.Pool({ connectionString: config.DATABASE_URL, max: 1 });
try {
  const collision = await pool.query<{ id: string; username: string; email: string }>(
    "SELECT id, username, email FROM users WHERE username = $1 OR email = $2",
    [config.DEVELOPER_USERNAME, config.DEVELOPER_EMAIL],
  );
  if (
    collision.rowCount &&
    collision.rows.some(
      (row) => row.username !== config.DEVELOPER_USERNAME || row.email !== config.DEVELOPER_EMAIL,
    )
  ) {
    throw new Error("Username or email belongs to a different account");
  }
  const passwordHash = await hashPassword(config.DEVELOPER_PASSWORD);
  await pool.query(
    `INSERT INTO users (username, email, display_name, password_hash, platform_role, must_change_password)
     VALUES ($1, $2, $3, $4, 'developer', true)
     ON CONFLICT (username) DO UPDATE
       SET email = EXCLUDED.email,
           display_name = EXCLUDED.display_name,
           password_hash = EXCLUDED.password_hash,
           platform_role = 'developer',
           must_change_password = true,
           updated_at = now()`,
    [
      config.DEVELOPER_USERNAME,
      config.DEVELOPER_EMAIL,
      config.DEVELOPER_DISPLAY_NAME,
      passwordHash,
    ],
  );
  process.stdout.write(`Developer account ready for ${config.DEVELOPER_USERNAME}\n`);
} finally {
  await pool.end();
}
