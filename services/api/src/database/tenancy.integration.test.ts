import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashPassword } from "../auth/password.js";
import { createPostgresAuthService } from "../auth/postgres-auth-service.js";
import { createPostgresPlatformService } from "../platform/postgres-platform-service.js";
import { createPostgresTenancyService } from "../tenancy/postgres-tenancy-service.js";

const runtimeUrl = process.env.TEST_DATABASE_URL;
const ownerUrl = process.env.TEST_MIGRATION_DATABASE_URL;

describe.skipIf(!runtimeUrl || !ownerUrl)("PostgreSQL tenant isolation", () => {
  const suffix = Date.now().toString(36);
  const developerId = crypto.randomUUID();
  const memberId = crypto.randomUUID();
  const slug = `tenant-${suffix}`;
  const password = "integration-password-123";
  const invitedUsername = `owner-${suffix}`;
  let runtimePool: pg.Pool;
  let ownerPool: pg.Pool;

  beforeAll(async () => {
    runtimePool = new pg.Pool({ connectionString: runtimeUrl });
    ownerPool = new pg.Pool({ connectionString: ownerUrl });
    const passwordHash = await hashPassword(password);
    await ownerPool.query(
      `INSERT INTO users (id, username, email, display_name, password_hash, platform_role, must_change_password)
       VALUES ($1, $2, $3, 'Integration Developer', $4, 'developer', false),
              ($5, $6, $7, 'Integration Member', $4, NULL, false)`,
      [
        developerId,
        `developer-${suffix}`,
        `developer-${suffix}@example.com`,
        passwordHash,
        memberId,
        `member-${suffix}`,
        `member-${suffix}@example.com`,
      ],
    );
  });

  afterAll(async () => {
    if (ownerPool) {
      await ownerPool.query(
        "DELETE FROM audit_events WHERE tenant_id IN (SELECT id FROM tenants WHERE slug = $1)",
        [slug],
      );
      await ownerPool.query(
        "DELETE FROM tenant_memberships WHERE tenant_id IN (SELECT id FROM tenants WHERE slug = $1)",
        [slug],
      );
      await ownerPool.query("DELETE FROM tenants WHERE slug = $1", [slug]);
      await ownerPool.query("DELETE FROM auth_sessions WHERE user_id = ANY($1::uuid[])", [
        [developerId, memberId],
      ]);
      await ownerPool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [
        [developerId, memberId],
      ]);
      await ownerPool.query("DELETE FROM users WHERE username = $1", [invitedUsername]);
      await ownerPool.end();
    }
    if (runtimePool) await runtimePool.end();
  });

  it("authenticates with username and email and isolates tenant rows", async () => {
    const auth = createPostgresAuthService(runtimePool, 8);
    const byUsername = await auth.login(`developer-${suffix}`, password, {});
    expect(byUsername?.user.platformRole).toBe("developer");
    await auth.logout(byUsername?.token ?? "");

    const byEmail = await auth.login(`developer-${suffix}@example.com`, password, {});
    expect(byEmail?.user.id).toBe(developerId);

    const platform = createPostgresPlatformService(runtimePool);
    const tenant = await platform.createTenant(developerId, {
      displayName: "Tenant Integration",
      slug,
      requestId: `test-${suffix}`,
    });
    expect(tenant.status).toBe("draft");

    const tenancy = createPostgresTenancyService(runtimePool, "https://cobranzaap.tech");
    const invitation = await tenancy.createInvitation(
      { userId: developerId, platformRole: "developer", tenantRole: null },
      tenant.id,
      {
        email: `owner-${suffix}@example.com`,
        role: "owner",
        requestId: `invite-${suffix}`,
      },
    );
    expect(invitation?.acceptanceUrl).toContain("https://cobranzaap.tech/activar?token=");
    const invitationToken = new URL(invitation?.acceptanceUrl ?? "").searchParams.get("token");
    expect(invitationToken).toBeTruthy();
    const preview = await tenancy.previewInvitation(invitationToken ?? "");
    expect(preview).toMatchObject({ tenantSlug: slug, accountExists: false });
    const accepted = await tenancy.acceptInvitation(
      invitationToken ?? "",
      { username: invitedUsername, displayName: "Invited Owner", password },
      `accept-${suffix}`,
    );
    expect(accepted).toEqual({ status: "accepted", tenantSlug: slug });
    const ownerLogin = await auth.login(`owner-${suffix}@example.com`, password, {});
    expect(ownerLogin?.user.memberships).toContainEqual(
      expect.objectContaining({ tenantId: tenant.id, role: "owner" }),
    );
    const ownerOverview = await tenancy.overview(
      { userId: ownerLogin?.user.id ?? "", platformRole: null, tenantRole: "owner" },
      tenant.id,
    );
    expect(ownerOverview?.tenant.slug).toBe(slug);
    expect(ownerOverview?.metrics.members).toBe(1);

    await ownerPool.query(
      `INSERT INTO tenant_memberships (tenant_id, user_id, role, created_by)
       VALUES ($1, $2, 'owner', $3)`,
      [tenant.id, memberId, developerId],
    );

    const anonymous = await runtimePool.query<{ count: string }>(
      "SELECT count(*) FROM tenants WHERE slug = $1",
      [slug],
    );
    expect(Number(anonymous.rows[0]?.count)).toBe(0);

    const client = await runtimePool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.user_id', $1, true)", [memberId]);
      const visible = await client.query<{ count: string }>(
        "SELECT count(*) FROM tenants WHERE slug = $1",
        [slug],
      );
      expect(Number(visible.rows[0]?.count)).toBe(1);
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });
});
