import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  claimNextOutboxEvent,
  processClaimedOutboxEvent,
  recordOutboxFailure,
  safeErrorMessage,
} from "./outbox.js";

const appUrl = process.env.TEST_DATABASE_URL;
const workerUrl = process.env.TEST_WORKER_DATABASE_URL;
const ownerUrl = process.env.TEST_MIGRATION_DATABASE_URL;

describe.skipIf(!appUrl || !workerUrl || !ownerUrl)("PostgreSQL outbox worker", () => {
  const suffix = Date.now().toString(36);
  const developerId = crypto.randomUUID();
  const ownerId = crypto.randomUUID();
  const tenantId = crypto.randomUUID();
  const otherTenantId = crypto.randomUUID();
  const accessId = crypto.randomUUID();
  const otherAccessId = crypto.randomUUID();
  const workerId = `worker-test-${suffix}`;
  let appPool: pg.Pool;
  let workerPool: pg.Pool;
  let ownerPool: pg.Pool;

  async function insertOutbox(input: {
    tenantId: string;
    aggregateId: string;
    eventType: string;
    key: string;
    maxAttempts?: number;
    payload?: Record<string, unknown>;
  }) {
    const id = crypto.randomUUID();
    const client = await appPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.user_id', $1, true)", [ownerId]);
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [input.tenantId]);
      await client.query("SELECT set_config('app.tenant_role', 'owner', true)");
      await client.query(
        `INSERT INTO outbox_events (
           id, tenant_id, event_type, aggregate_type, aggregate_id,
           idempotency_key, payload, available_at, max_attempts
         ) VALUES ($1, $2, $3, 'support_access', $4, $5, $6, now() - interval '1 second', $7)`,
        [
          id,
          input.tenantId,
          input.eventType,
          input.aggregateId,
          input.key,
          input.payload ?? {},
          input.maxAttempts ?? 5,
        ],
      );
      await client.query("COMMIT");
      return id;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  beforeAll(async () => {
    appPool = new pg.Pool({ connectionString: appUrl });
    workerPool = new pg.Pool({ connectionString: workerUrl });
    ownerPool = new pg.Pool({ connectionString: ownerUrl });
    await ownerPool.query(
      `INSERT INTO users (id, username, email, display_name, password_hash, platform_role, must_change_password)
       VALUES ($1, $2, $3, 'Outbox Developer', digest($4, 'sha256'), 'developer', false),
              ($5, $6, $7, 'Outbox Owner', digest($4, 'sha256'), NULL, false)`,
      [
        developerId,
        `outbox-dev-${suffix}`,
        `outbox-dev-${suffix}@example.com`,
        `outbox-password-${suffix}`,
        ownerId,
        `outbox-owner-${suffix}`,
        `outbox-owner-${suffix}@example.com`,
      ],
    );
    await ownerPool.query(
      `INSERT INTO tenants (id, slug, display_name, created_by)
       VALUES ($1, $2, 'Outbox Tenant', $3), ($4, $5, 'Other Outbox Tenant', $3)`,
      [tenantId, `outbox-${suffix}`, developerId, otherTenantId, `outbox-other-${suffix}`],
    );
    await ownerPool.query(
      `INSERT INTO tenant_support_access_requests (
         id, tenant_id, requested_by, purpose, requested_duration_minutes,
         status, reviewed_by, reviewed_at, approved_until
       ) VALUES
         ($1, $2, $3, 'Expire authorized support access', 30, 'approved', $4, now(), now() - interval '1 second'),
         ($5, $6, $3, 'Protect another tenant access', 30, 'approved', $4, now(), now() - interval '1 second')`,
      [accessId, tenantId, developerId, ownerId, otherAccessId, otherTenantId],
    );
  });

  afterAll(async () => {
    if (ownerPool) {
      await ownerPool.query("DELETE FROM audit_events WHERE tenant_id = ANY($1::uuid[])", [
        [tenantId, otherTenantId],
      ]);
      await ownerPool.query("DELETE FROM tenants WHERE id = ANY($1::uuid[])", [
        [tenantId, otherTenantId],
      ]);
      await ownerPool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [
        [developerId, ownerId],
      ]);
      await ownerPool.end();
    }
    if (appPool) await appPool.end();
    if (workerPool) await workerPool.end();
  });

  it("keeps the worker role least-privileged", async () => {
    await expect(workerPool.query("SELECT id FROM users LIMIT 1")).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      appPool.query("UPDATE outbox_events SET status = 'dead' WHERE false"),
    ).rejects.toThrow(/permission denied/);
  });

  it("does not trust a cross-tenant aggregate reference", async () => {
    const eventId = await insertOutbox({
      tenantId,
      aggregateId: otherAccessId,
      eventType: "support_access.expire",
      key: `malicious-${suffix}`,
      payload: { tenantId: otherTenantId },
    });
    const claimed = await claimNextOutboxEvent(workerPool, workerId, 30);
    expect(claimed).toMatchObject({ id: eventId, tenantId, aggregateId: otherAccessId });
    if (!claimed) throw new Error("Expected an outbox event");
    await expect(processClaimedOutboxEvent(workerPool, claimed, workerId)).resolves.toBe("skipped");
    expect(
      (
        await ownerPool.query<{ status: string }>(
          "SELECT status FROM tenant_support_access_requests WHERE id = $1",
          [otherAccessId],
        )
      ).rows[0]?.status,
    ).toBe("approved");
  });

  it("leases and expires authorized support access exactly once", async () => {
    const eventId = await insertOutbox({
      tenantId,
      aggregateId: accessId,
      eventType: "support_access.expire",
      key: `expire-${suffix}`,
    });
    const claimed = await claimNextOutboxEvent(workerPool, workerId, 30);
    expect(claimed).toMatchObject({ id: eventId, attempts: 1, maxAttempts: 5 });
    if (!claimed) throw new Error("Expected an outbox event");
    await expect(processClaimedOutboxEvent(workerPool, claimed, workerId)).resolves.toBe("expired");
    await expect(processClaimedOutboxEvent(workerPool, claimed, workerId)).resolves.toBe(
      "lost_lease",
    );
    expect(
      (
        await ownerPool.query<{ status: string }>(
          "SELECT status FROM tenant_support_access_requests WHERE id = $1",
          [accessId],
        )
      ).rows[0]?.status,
    ).toBe("expired");
    expect(
      (
        await ownerPool.query<{ count: string }>(
          `SELECT count(*) AS count FROM audit_events
            WHERE tenant_id = $1 AND target_id = $2 AND action = 'support_access.expired'`,
          [tenantId, accessId],
        )
      ).rows[0]?.count,
    ).toBe("1");
  });

  it("dead-letters an unsupported event after its bounded attempts", async () => {
    const eventId = await insertOutbox({
      tenantId,
      aggregateId: accessId,
      eventType: "unsupported.event",
      key: `unsupported-${suffix}`,
      maxAttempts: 1,
    });
    const claimed = await claimNextOutboxEvent(workerPool, workerId, 30);
    expect(claimed?.id).toBe(eventId);
    if (!claimed) throw new Error("Expected an outbox event");
    await expect(processClaimedOutboxEvent(workerPool, claimed, workerId)).rejects.toThrow(
      "Unsupported outbox event type",
    );
    await expect(
      recordOutboxFailure(workerPool, claimed, workerId, new Error("unsupported")),
    ).resolves.toBe("dead");
    expect(
      (
        await ownerPool.query<{ status: string; last_error: string }>(
          "SELECT status, last_error FROM outbox_events WHERE id = $1",
          [eventId],
        )
      ).rows[0],
    ).toEqual({ status: "dead", last_error: "unsupported" });
  });

  it("redacts multiline worker errors to a bounded log value", () => {
    expect(safeErrorMessage(new Error("first\nsecond\tthird"))).toBe("first second third");
    expect(safeErrorMessage("raw failure")).toBe("Unknown worker failure");
  });
});
