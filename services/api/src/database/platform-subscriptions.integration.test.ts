import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashPassword } from "../auth/password.js";
import { createPostgresPlatformService } from "../platform/postgres-platform-service.js";

const runtimeUrl = process.env.TEST_DATABASE_URL;
const ownerUrl = process.env.TEST_MIGRATION_DATABASE_URL;

describe.skipIf(!runtimeUrl || !ownerUrl)("PostgreSQL platform subscriptions", () => {
  const suffix = Date.now().toString(36);
  const developerId = crypto.randomUUID();
  const ownerId = crypto.randomUUID();
  const tenantSlug = `subscription-${suffix}`;
  let runtimePool: pg.Pool;
  let ownerPool: pg.Pool;

  beforeAll(async () => {
    runtimePool = new pg.Pool({ connectionString: runtimeUrl });
    ownerPool = new pg.Pool({ connectionString: ownerUrl });
    const passwordHash = await hashPassword("subscription-integration-password");
    await ownerPool.query(
      `INSERT INTO users
         (id, username, email, display_name, password_hash, platform_role, must_change_password)
       VALUES ($1, $2, $3, 'Subscription Developer', $4, 'developer', false),
              ($5, $6, $7, 'Subscription Owner', $4, NULL, false)`,
      [
        developerId,
        `subscription-developer-${suffix}`,
        `subscription-developer-${suffix}@example.com`,
        passwordHash,
        ownerId,
        `subscription-owner-${suffix}`,
        `subscription-owner-${suffix}@example.com`,
      ],
    );
  });

  afterAll(async () => {
    if (ownerPool) {
      await ownerPool.query("DELETE FROM user_memberships WHERE user_id = $1", [ownerId]);
      await ownerPool.query(
        `DELETE FROM audit_events
          WHERE actor_user_id = ANY($1::uuid[])
             OR tenant_id IN (SELECT id FROM tenants WHERE slug = $2)`,
        [[developerId, ownerId], tenantSlug],
      );
      await ownerPool.query("DELETE FROM tenants WHERE slug = $1", [tenantSlug]);
      await ownerPool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [
        [developerId, ownerId],
      ]);
      await ownerPool.end();
    }
    if (runtimePool) await runtimePool.end();
  });

  it("creates, filters and updates a linked subscription with full auditability", async () => {
    const platform = createPostgresPlatformService(runtimePool);
    const created = await platform.createSubscription?.(
      developerId,
      {
        userId: ownerId,
        membershipPlan: "ultra",
        billingCycle: "yearly",
        amountCop: 3_600_000,
        currentPeriodStart: "2026-10-19",
        currentPeriodEnd: "2027-10-19",
        autoRenew: false,
        internalNotes: "Contrato anual",
      },
      `subscription-create-${suffix}`,
    );
    expect(created).toMatchObject({
      status: "updated",
      subscription: {
        userId: ownerId,
        membershipPlan: "ultra",
        billingCycle: "yearly",
        monthlyEquivalentCop: 300_000,
        isAvailable: true,
      },
    });
    if (created?.status !== "updated") throw new Error("Subscription was not created");

    const directory = await platform.listSubscriptions?.(developerId, {
      search: `subscription-owner-${suffix}@example.com`,
      status: "active",
      plan: "ultra",
      assignment: "available",
      page: 1,
      pageSize: 20,
    });
    expect(directory).toMatchObject({
      subscriptions: [{ id: created.subscription.id }],
      pagination: { total: 1 },
    });

    const tenant = await platform.createTenant(developerId, {
      displayName: "Subscription Tenant",
      slug: tenantSlug,
      membershipPlan: "ultra",
      requestId: `subscription-tenant-${suffix}`,
    });
    await ownerPool.query(
      `UPDATE user_memberships
          SET consumed_at = now(), consumed_tenant_id = $2
        WHERE id = $1`,
      [created.subscription.id, tenant.id],
    );
    await ownerPool.query("UPDATE tenants SET status = 'active' WHERE id = $1", [tenant.id]);

    const updated = await platform.updateSubscription?.(
      developerId,
      created.subscription.id,
      {
        membershipPlan: "pro",
        status: "suspended",
        billingCycle: "monthly",
        amountCop: 150_000,
        currentPeriodStart: "2026-11-01",
        currentPeriodEnd: "2026-12-01",
        autoRenew: true,
        internalNotes: "Suspendida mientras se confirma el pago",
      },
      `subscription-update-${suffix}`,
    );
    expect(updated).toMatchObject({
      status: "updated",
      subscription: {
        membershipPlan: "pro",
        status: "suspended",
        tenantId: tenant.id,
        isAvailable: false,
      },
    });
    expect(
      (
        await ownerPool.query<{ membership_plan: string; status: string }>(
          "SELECT membership_plan, status FROM tenants WHERE id = $1",
          [tenant.id],
        )
      ).rows[0],
    ).toEqual({ membership_plan: "pro", status: "suspended" });
    expect(
      (
        await ownerPool.query<{ action: string }>(
          `SELECT action FROM audit_events
            WHERE target_id = $1 AND action = 'subscription.updated'`,
          [created.subscription.id],
        )
      ).rows,
    ).toHaveLength(1);
  });
});
