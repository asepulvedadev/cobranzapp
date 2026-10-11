import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import pg from "pg";
import { z } from "zod";

const migrationConfigSchema = z.object({
  MIGRATION_DATABASE_URL: z.string().min(1),
  APP_DATABASE_USER: z.string().regex(/^[a-z_][a-z0-9_]{0,62}$/),
  APP_DATABASE_PASSWORD: z.string().min(24),
  MIGRATIONS_DIR: z.string().optional(),
});

function quoteIdentifier(identifier: string) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function quoteLiteral(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

async function resolveMigrationsDirectory(configured?: string) {
  const candidates = configured
    ? [path.resolve(configured)]
    : [
        path.resolve(process.cwd(), "database/migrations"),
        path.resolve(process.cwd(), "../../database/migrations"),
      ];
  for (const candidate of candidates) {
    try {
      await readdir(candidate);
      return candidate;
    } catch {
      // Try the next known repository/runtime location.
    }
  }
  throw new Error(`Could not find migrations directory. Checked: ${candidates.join(", ")}`);
}

async function main() {
  const config = migrationConfigSchema.parse(process.env);
  const pool = new pg.Pool({ connectionString: config.MIGRATION_DATABASE_URL, max: 1 });
  const client = await pool.connect();
  const appRole = quoteIdentifier(config.APP_DATABASE_USER);
  try {
    await client.query("SELECT pg_advisory_lock(hashtext('cobranzapp:migrations'))");
    const roleResult = await client.query<{ exists: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $1) AS exists",
      [config.APP_DATABASE_USER],
    );
    if (roleResult.rows[0]?.exists) {
      await client.query(
        `ALTER ROLE ${appRole} WITH LOGIN PASSWORD ${quoteLiteral(config.APP_DATABASE_PASSWORD)} NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`,
      );
    } else {
      await client.query(
        `CREATE ROLE ${appRole} WITH LOGIN PASSWORD ${quoteLiteral(config.APP_DATABASE_PASSWORD)} NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`,
      );
    }
    const databaseResult = await client.query<{ name: string }>(
      "SELECT current_database() AS name",
    );
    const databaseName = databaseResult.rows[0]?.name;
    if (!databaseName) throw new Error("Could not resolve the current database name");
    await client.query(`GRANT CONNECT ON DATABASE ${quoteIdentifier(databaseName)} TO ${appRole}`);
    await client.query(`GRANT USAGE ON SCHEMA public TO ${appRole}`);
    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
        name text PRIMARY KEY,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`,
    );

    const migrationsDirectory = await resolveMigrationsDirectory(config.MIGRATIONS_DIR);
    const files = (await readdir(migrationsDirectory))
      .filter((file) => /^\d+_[a-z0-9_]+\.sql$/.test(file))
      .sort();
    for (const file of files) {
      const source = await readFile(path.join(migrationsDirectory, file), "utf8");
      const checksum = (await import("node:crypto"))
        .createHash("sha256")
        .update(source)
        .digest("hex");
      const existing = await client.query<{ checksum: string }>(
        "SELECT checksum FROM schema_migrations WHERE name = $1",
        [file],
      );
      if (existing.rows[0]) {
        if (existing.rows[0].checksum !== checksum)
          throw new Error(`Migration ${file} changed after being applied`);
        continue;
      }

      await client.query("BEGIN");
      try {
        await client.query(source.replaceAll("{{APP_DATABASE_ROLE}}", appRole));
        await client.query("INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)", [
          file,
          checksum,
        ]);
        await client.query("COMMIT");
        process.stdout.write(`Applied ${file}\n`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }

    await client.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${appRole}`,
    );
    await client.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${appRole}`,
    );
  } finally {
    await client
      .query("SELECT pg_advisory_unlock(hashtext('cobranzapp:migrations'))")
      .catch(() => undefined);
    client.release();
    await pool.end();
  }
}

await main();
