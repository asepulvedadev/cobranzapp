import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const runtimeUrl = process.env.TEST_DATABASE_URL;
const ownerUrl = process.env.TEST_MIGRATION_DATABASE_URL;

describe.skipIf(!runtimeUrl || !ownerUrl)("PostgreSQL collector assignment isolation", () => {
  const tenantId = crypto.randomUUID();
  const ownerId = crypto.randomUUID();
  const collectorAId = crypto.randomUUID();
  const collectorBId = crypto.randomUUID();
  const borrowerAId = crypto.randomUUID();
  const borrowerBId = crypto.randomUUID();
  const routeAId = crypto.randomUUID();
  const routeBId = crypto.randomUUID();
  const suffix = Date.now().toString(36);
  let runtimePool: pg.Pool;
  let ownerPool: pg.Pool;

  beforeAll(async () => {
    runtimePool = new pg.Pool({ connectionString: runtimeUrl });
    ownerPool = new pg.Pool({ connectionString: ownerUrl });
    await ownerPool.query(
      `INSERT INTO users (id, username, email, display_name, password_hash, must_change_password)
       VALUES ($1, $2, $3, 'Security Owner', 'unused', false),
              ($4, $5, $6, 'Collector A', 'unused', false),
              ($7, $8, $9, 'Collector B', 'unused', false)`,
      [
        ownerId,
        `security-owner-${suffix}`,
        `security-owner-${suffix}@example.com`,
        collectorAId,
        `security-collector-a-${suffix}`,
        `security-collector-a-${suffix}@example.com`,
        collectorBId,
        `security-collector-b-${suffix}`,
        `security-collector-b-${suffix}@example.com`,
      ],
    );
    await ownerPool.query(
      `INSERT INTO tenants (id, slug, display_name, created_by)
       VALUES ($1, $2, 'Security Tenant', $3)`,
      [tenantId, `security-tenant-${suffix}`, ownerId],
    );
    await ownerPool.query(
      `INSERT INTO tenant_memberships (tenant_id, user_id, role, status, created_by)
       VALUES ($1, $2, 'owner', 'active', $2),
              ($1, $3, 'collector', 'active', $2),
              ($1, $4, 'collector', 'active', $2)`,
      [tenantId, ownerId, collectorAId, collectorBId],
    );
    await ownerPool.query(
      `INSERT INTO borrowers
         (tenant_id, id, full_name, phone, home_address, work_address,
          consent_version, consent_evidence_ref, created_by, created_by_role,
          assigned_collector_id)
       VALUES ($1, $2, 'Client A', '3000000001', 'Address A', 'Work A',
               'v1', 'integration', $4, 'owner', $5),
              ($1, $3, 'Client B', '3000000002', 'Address B', 'Work B',
               'v1', 'integration', $4, 'owner', $6)`,
      [tenantId, borrowerAId, borrowerBId, ownerId, collectorAId, collectorBId],
    );
    await ownerPool.query(
      `INSERT INTO borrower_documents
         (tenant_id, borrower_id, category, side, object_key, media_type,
          size_bytes, sha256, created_by)
       VALUES ($1, $2, 'identity', 'front', $4, 'image/jpeg', 10, $6, $7),
              ($1, $3, 'identity', 'front', $5, 'image/jpeg', 10, $6, $7)`,
      [
        tenantId,
        borrowerAId,
        borrowerBId,
        `tenant/${tenantId}/borrowers/${borrowerAId}/quarantine/front.jpg`,
        `tenant/${tenantId}/borrowers/${borrowerBId}/quarantine/front.jpg`,
        "a".repeat(64),
        ownerId,
      ],
    );
    await ownerPool.query(
      `INSERT INTO collection_routes
         (tenant_id, id, name, status, created_by, assigned_collector_id)
       VALUES ($1, $2, 'Route A', 'active', $4, $5),
              ($1, $3, 'Route B', 'active', $4, $6)`,
      [tenantId, routeAId, routeBId, ownerId, collectorAId, collectorBId],
    );
    await ownerPool.query(
      `INSERT INTO collection_route_stops
         (tenant_id, route_id, borrower_id, address_kind, position, created_by)
       VALUES ($1, $2, $4, 'home', 1, $6),
              ($1, $3, $5, 'home', 1, $6)`,
      [tenantId, routeAId, routeBId, borrowerAId, borrowerBId, ownerId],
    );
  });

  afterAll(async () => {
    if (ownerPool) {
      await ownerPool.query("DELETE FROM audit_events WHERE tenant_id = $1", [tenantId]);
      await ownerPool.query("DELETE FROM collection_routes WHERE tenant_id = $1", [tenantId]);
      await ownerPool.query("DELETE FROM borrowers WHERE tenant_id = $1", [tenantId]);
      await ownerPool.query("DELETE FROM tenant_memberships WHERE tenant_id = $1", [tenantId]);
      await ownerPool.query("DELETE FROM tenants WHERE id = $1", [tenantId]);
      await ownerPool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [
        [ownerId, collectorAId, collectorBId],
      ]);
      await ownerPool.end();
    }
    if (runtimePool) await runtimePool.end();
  });

  async function asCollector<T>(query: string, values: unknown[] = []) {
    const client = await runtimePool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
      await client.query("SELECT set_config('app.user_id', $1, true)", [collectorAId]);
      await client.query("SELECT set_config('app.tenant_role', 'collector', true)");
      return await client.query<T & pg.QueryResultRow>(query, values);
    } finally {
      await client.query("ROLLBACK").catch(() => undefined);
      client.release();
    }
  }

  it("shows a collector only assigned clients, documents, routes, and stops", async () => {
    await expect(
      asCollector<{ full_name: string }>("SELECT full_name FROM borrowers"),
    ).resolves.toMatchObject({ rows: [{ full_name: "Client A" }] });
    await expect(
      asCollector<{ object_key: string }>("SELECT object_key FROM borrower_documents"),
    ).resolves.toMatchObject({
      rows: [
        {
          object_key: `tenant/${tenantId}/borrowers/${borrowerAId}/quarantine/front.jpg`,
        },
      ],
    });
    await expect(
      asCollector<{ name: string }>("SELECT name FROM collection_routes"),
    ).resolves.toMatchObject({ rows: [{ name: "Route A" }] });
    await expect(
      asCollector<{ borrower_id: string }>("SELECT borrower_id FROM collection_route_stops"),
    ).resolves.toMatchObject({ rows: [{ borrower_id: borrowerAId }] });
  });

  it("rejects assigning a new borrower to another collector", async () => {
    await expect(
      asCollector(
        `INSERT INTO borrowers
           (tenant_id, full_name, phone, home_address, work_address,
            consent_version, consent_evidence_ref, created_by, created_by_role,
            assigned_collector_id)
         VALUES ($1, 'Blocked Client', '3000000099', 'Address', 'Work address',
                 'v1', 'integration', $2, 'collector', $3)`,
        [tenantId, collectorAId, collectorBId],
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("does not grant destructive table-wide privileges to the API role", async () => {
    const result = await asCollector<{ can_delete: boolean }>(
      "SELECT has_table_privilege(current_user, 'borrowers', 'DELETE') AS can_delete",
    );
    expect(result.rows[0]?.can_delete).toBe(false);
  });

  it("keeps every tenant-owned table behind forced RLS and the API role unable to bypass it", async () => {
    const role = await runtimePool.query<{ rolsuper: boolean; rolbypassrls: boolean }>(
      `SELECT rolsuper, rolbypassrls
         FROM pg_roles
        WHERE rolname = current_user`,
    );
    expect(role.rows[0]).toEqual({ rolsuper: false, rolbypassrls: false });

    const unprotected = await ownerPool.query<{ table_name: string }>(
      `SELECT table_class.relname AS table_name
         FROM pg_class table_class
         JOIN pg_namespace namespace ON namespace.oid = table_class.relnamespace
         JOIN pg_attribute tenant_column
           ON tenant_column.attrelid = table_class.oid
          AND tenant_column.attname = 'tenant_id'
          AND NOT tenant_column.attisdropped
        WHERE namespace.nspname = 'public'
          AND table_class.relkind = 'r'
          AND (NOT table_class.relrowsecurity OR NOT table_class.relforcerowsecurity)
        ORDER BY table_class.relname`,
    );
    expect(unprotected.rows).toEqual([]);
  });
});
