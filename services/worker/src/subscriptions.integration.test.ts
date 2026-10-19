import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { reconcileSubscriptions } from "./subscriptions.js";

const workerUrl = process.env.TEST_WORKER_DATABASE_URL;
const ownerUrl = process.env.TEST_MIGRATION_DATABASE_URL;

describe.skipIf(!workerUrl || !ownerUrl)("subscription reconciliation worker", () => {
  const developerId = crypto.randomUUID();
  const ownerId = crypto.randomUUID();
  const renewableId = crypto.randomUUID();
  const expiringId = crypto.randomUUID();
  const tenantId = crypto.randomUUID();
  const suffix = Date.now().toString(36);
  let workerPool: pg.Pool;
  let ownerPool: pg.Pool;

  beforeAll(async () => {
    workerPool = new pg.Pool({ connectionString: workerUrl });
    ownerPool = new pg.Pool({ connectionString: ownerUrl });
    await ownerPool.query(
      `INSERT INTO users
         (id, username, email, display_name, password_hash, platform_role, must_change_password)
       VALUES ($1, $2, $3, 'Worker Developer', 'test-hash', 'developer', false),
              ($4, $5, $6, 'Worker Owner', 'test-hash', NULL, false)`,
      [
        developerId,
        `worker-developer-${suffix}`,
        `worker-developer-${suffix}@example.com`,
        ownerId,
        `worker-owner-${suffix}`,
        `worker-owner-${suffix}@example.com`,
      ],
    );
    await ownerPool.query(
      `INSERT INTO tenants (id, slug, display_name, status, membership_plan, created_by)
       VALUES ($1, $2, 'Worker Subscription Tenant', 'active', 'pro', $3)`,
      [tenantId, `worker-subscription-${suffix}`, developerId],
    );
    await ownerPool.query(
      `INSERT INTO user_memberships
         (id, user_id, membership_plan, status, activated_at, assigned_by,
          billing_cycle, amount_cop, current_period_start, current_period_end,
          auto_renew, consumed_at, consumed_tenant_id)
       VALUES
         ($1, $2, 'pro', 'active', now(), $3, 'monthly', 150000,
          '2026-09-01', '2026-10-01', true, NULL, NULL),
         ($4, $2, 'pro', 'active', now(), $3, 'monthly', 150000,
          '2026-09-01', '2026-10-01', false, now(), $5)`,
      [renewableId, ownerId, developerId, expiringId, tenantId],
    );
  });

  afterAll(async () => {
    if (ownerPool) {
      await ownerPool.query("DELETE FROM user_memberships WHERE id = ANY($1::uuid[])", [
        [renewableId, expiringId],
      ]);
      await ownerPool.query("DELETE FROM audit_events WHERE target_id = ANY($1::uuid[])", [
        [renewableId, expiringId],
      ]);
      await ownerPool.query("DELETE FROM tenants WHERE id = $1", [tenantId]);
      await ownerPool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [
        [developerId, ownerId],
      ]);
      await ownerPool.end();
    }
    if (workerPool) await workerPool.end();
  });

  it("renews opted-in subscriptions and expires/suspends the rest", async () => {
    await expect(
      reconcileSubscriptions(workerPool, new Date("2026-10-19T15:00:00.000Z")),
    ).resolves.toEqual({ renewed: 1, expired: 1, tenantsSuspended: 1 });
    expect(
      (
        await ownerPool.query<{
          id: string;
          status: string;
          current_period_start: string;
          current_period_end: string;
        }>(
          `SELECT id, status, current_period_start::text, current_period_end::text
             FROM user_memberships WHERE id = ANY($1::uuid[]) ORDER BY id`,
          [[renewableId, expiringId]],
        )
      ).rows,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: renewableId,
          status: "active",
          current_period_start: "2026-10-01",
          current_period_end: "2026-11-01",
        }),
        expect.objectContaining({ id: expiringId, status: "expired" }),
      ]),
    );
    expect(
      (
        await ownerPool.query<{ status: string }>("SELECT status FROM tenants WHERE id = $1", [
          tenantId,
        ])
      ).rows[0]?.status,
    ).toBe("suspended");
  });
});
