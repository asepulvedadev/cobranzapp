import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashPassword } from "../auth/password.js";
import { createPostgresAuthService } from "../auth/postgres-auth-service.js";
import { createPostgresPlatformService } from "../platform/postgres-platform-service.js";
import { createPostgresSupportAccessService } from "../support-access/postgres-support-access-service.js";
import { createPostgresTenancyService } from "../tenancy/postgres-tenancy-service.js";

const runtimeUrl = process.env.TEST_DATABASE_URL;
const ownerUrl = process.env.TEST_MIGRATION_DATABASE_URL;

describe.skipIf(!runtimeUrl || !ownerUrl)("PostgreSQL tenant isolation", () => {
  const suffix = Date.now().toString(36);
  const developerId = crypto.randomUUID();
  const memberId = crypto.randomUUID();
  const slug = `tenant-${suffix}`;
  const secondSlug = `tenant-secondary-${suffix}`;
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
        `DELETE FROM audit_events
          WHERE tenant_id IN (SELECT id FROM tenants WHERE slug = ANY($1::citext[]))
             OR actor_user_id = ANY($2::uuid[])`,
        [
          [slug, secondSlug],
          [developerId, memberId],
        ],
      );
      await ownerPool.query(
        "DELETE FROM tenant_memberships WHERE tenant_id IN (SELECT id FROM tenants WHERE slug = ANY($1::citext[]))",
        [[slug, secondSlug]],
      );
      await ownerPool.query("DELETE FROM tenants WHERE slug = ANY($1::citext[])", [
        [slug, secondSlug],
      ]);
      await ownerPool.query("DELETE FROM auth_sessions WHERE user_id = ANY($1::uuid[])", [
        [developerId, memberId],
      ]);
      await ownerPool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [
        [developerId, memberId],
      ]);
      await ownerPool.query(
        "DELETE FROM audit_events WHERE actor_user_id IN (SELECT id FROM users WHERE username = $1)",
        [invitedUsername],
      );
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
    await expect(
      auth.isRecentlyReauthenticated(developerId, byEmail?.token ?? "", 10),
    ).resolves.toBe(true);
    await ownerPool.query(
      `UPDATE auth_sessions
          SET reauthenticated_at = now() - interval '30 minutes'
        WHERE user_id = $1 AND revoked_at IS NULL`,
      [developerId],
    );
    await expect(
      auth.isRecentlyReauthenticated(developerId, byEmail?.token ?? "", 10),
    ).resolves.toBe(false);
    await expect(
      auth.reauthenticate(developerId, byEmail?.token ?? "", "incorrect-password", `bad-${suffix}`),
    ).resolves.toBe(false);
    await expect(
      auth.reauthenticate(developerId, byEmail?.token ?? "", password, `reauth-${suffix}`),
    ).resolves.toBe(true);
    await expect(
      auth.isRecentlyReauthenticated(developerId, byEmail?.token ?? "", 10),
    ).resolves.toBe(true);
    const otherSession = await auth.login(`developer-${suffix}`, password, {
      userAgent: "Integration Browser",
    });
    const sessions = await auth.listSessions(developerId, byEmail?.token ?? "");
    expect(sessions).toHaveLength(2);
    expect(sessions.find((session) => session.current)?.userAgent).toBeNull();
    const currentSessionId = sessions.find((session) => session.current)?.id ?? "";
    const otherSessionId = sessions.find((session) => !session.current)?.id ?? "";
    await expect(
      auth.revokeSession(developerId, currentSessionId, byEmail?.token ?? ""),
    ).resolves.toBe("current");
    await expect(
      auth.revokeSession(developerId, otherSessionId, byEmail?.token ?? ""),
    ).resolves.toBe("revoked");
    await expect(auth.authenticate(otherSession?.token ?? "")).resolves.toBeNull();
    const additionalSession = await auth.login(`developer-${suffix}`, password, {});
    await expect(auth.revokeOtherSessions(developerId, byEmail?.token ?? "")).resolves.toBe(1);
    await expect(auth.authenticate(additionalSession?.token ?? "")).resolves.toBeNull();
    await expect(auth.authenticate(byEmail?.token ?? "")).resolves.toMatchObject({
      id: developerId,
    });

    const platform = createPostgresPlatformService(runtimePool);
    const supportAccess = createPostgresSupportAccessService(runtimePool);
    const tenant = await platform.createTenant(developerId, {
      displayName: "Tenant Integration",
      slug,
      requestId: `test-${suffix}`,
    });
    const secondTenant = await platform.createTenant(developerId, {
      displayName: "Tenant Secondary",
      slug: secondSlug,
      requestId: `test-secondary-${suffix}`,
    });
    expect(tenant.status).toBe("draft");
    const platformOverview = await platform.overview(developerId);
    expect(platformOverview.activity).toContainEqual(
      expect.objectContaining({
        action: "tenant.created",
        actorUsername: `developer-${suffix}`,
        tenantId: tenant.id,
      }),
    );
    expect(platformOverview.tenants.find((item) => item.id === tenant.id)?.readiness).toEqual({
      activeOwner: false,
      activeBranch: false,
      contactEmail: false,
    });
    const supportRequest = await supportAccess.requestAccess(developerId, tenant.id, {
      purpose: "Revisar la configuración inicial de la empresa",
      durationMinutes: 60,
      requestId: `support-request-${suffix}`,
    });
    expect(supportRequest).toMatchObject({
      status: "created",
      access: { status: "pending", tenantId: tenant.id },
    });
    await expect(
      supportAccess.requestAccess(developerId, tenant.id, {
        purpose: "Solicitud duplicada para la misma empresa",
        durationMinutes: 30,
        requestId: `support-duplicate-${suffix}`,
      }),
    ).resolves.toMatchObject({ status: "exists", access: { id: supportRequest.access.id } });
    expect(await supportAccess.listForDeveloper(developerId)).toContainEqual(
      expect.objectContaining({ id: supportRequest.access.id, status: "pending" }),
    );

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
    await expect(
      auth.reauthenticate(
        ownerLogin?.user.id ?? "",
        ownerLogin?.token ?? "",
        password,
        `owner-reauth-${suffix}`,
      ),
    ).resolves.toBe(true);
    const ownerReauthenticationAudit = await ownerPool.query<{ count: string }>(
      `SELECT count(*)
         FROM audit_events
        WHERE actor_user_id = $1
          AND action = 'auth.reauthenticated'
          AND request_id = $2`,
      [ownerLogin?.user.id, `owner-reauth-${suffix}`],
    );
    expect(Number(ownerReauthenticationAudit.rows[0]?.count)).toBe(1);
    const ownerOverview = await tenancy.overview(
      { userId: ownerLogin?.user.id ?? "", platformRole: null, tenantRole: "owner" },
      tenant.id,
    );
    expect(ownerOverview?.tenant.slug).toBe(slug);
    expect(ownerOverview?.metrics.members).toBe(1);
    expect(ownerOverview?.settings.version).toBe(1);
    expect(ownerOverview?.settingsHistory).toContainEqual(
      expect.objectContaining({
        version: 1,
        changedByDisplayName: "Integration Developer",
      }),
    );

    await expect(
      platform.updateTenantStatus(developerId, tenant.id, "active", `activate-unready-${suffix}`),
    ).resolves.toMatchObject({
      status: "not_ready",
      missing: expect.arrayContaining(["active_branch", "contact_email"]),
    });

    const ownerActor = {
      userId: ownerLogin?.user.id ?? "",
      platformRole: null,
      tenantRole: "owner" as const,
    };
    expect(await supportAccess.listForTenant(ownerActor, tenant.id)).toContainEqual(
      expect.objectContaining({
        id: supportRequest.access.id,
        requestedByDisplayName: "Integration Developer",
      }),
    );
    await expect(
      supportAccess.reviewAccess(
        ownerActor,
        tenant.id,
        supportRequest.access.id,
        "approve",
        `support-approve-${suffix}`,
      ),
    ).resolves.toMatchObject({
      status: "updated",
      access: { status: "active", expiresAt: expect.any(String) },
    });
    await expect(supportAccess.findActiveAccess(developerId, tenant.id)).resolves.toMatchObject({
      id: supportRequest.access.id,
      status: "active",
    });
    await expect(
      supportAccess.reviewAccess(
        ownerActor,
        tenant.id,
        supportRequest.access.id,
        "approve",
        `support-reapprove-${suffix}`,
      ),
    ).resolves.toEqual({ status: "invalid_transition" });
    await ownerPool.query(
      "UPDATE tenant_support_access_requests SET approved_until = now() - interval '1 second' WHERE id = $1",
      [supportRequest.access.id],
    );
    await expect(supportAccess.findActiveAccess(developerId, tenant.id)).resolves.toBeNull();
    expect(await supportAccess.listForDeveloper(developerId)).toContainEqual(
      expect.objectContaining({ id: supportRequest.access.id, status: "expired" }),
    );
    const secondSupportRequest = await supportAccess.requestAccess(developerId, tenant.id, {
      purpose: "Validar nuevamente el proceso de configuración",
      durationMinutes: 30,
      requestId: `support-request-second-${suffix}`,
    });
    expect(secondSupportRequest).toMatchObject({ status: "created" });
    if (secondSupportRequest.status !== "created") throw new Error("Expected support request");
    await expect(
      supportAccess.cancelAccess(
        developerId,
        secondSupportRequest.access.id,
        `support-cancel-${suffix}`,
      ),
    ).resolves.toMatchObject({ status: "updated", access: { status: "revoked" } });
    const thirdSupportRequest = await supportAccess.requestAccess(developerId, tenant.id, {
      purpose: "Revisar un incidente reportado por la empresa",
      durationMinutes: 45,
      requestId: `support-request-third-${suffix}`,
    });
    expect(thirdSupportRequest).toMatchObject({ status: "created" });
    if (thirdSupportRequest.status !== "created") throw new Error("Expected support request");
    await supportAccess.reviewAccess(
      ownerActor,
      tenant.id,
      thirdSupportRequest.access.id,
      "approve",
      `support-approve-third-${suffix}`,
    );
    await expect(
      supportAccess.reviewAccess(
        ownerActor,
        tenant.id,
        thirdSupportRequest.access.id,
        "revoke",
        `support-revoke-${suffix}`,
      ),
    ).resolves.toMatchObject({ status: "updated", access: { status: "revoked" } });
    await expect(supportAccess.findActiveAccess(developerId, tenant.id)).resolves.toBeNull();
    const fourthSupportRequest = await supportAccess.requestAccess(developerId, tenant.id, {
      purpose: "Comprobar el flujo de rechazo de soporte",
      durationMinutes: 30,
      requestId: `support-request-fourth-${suffix}`,
    });
    expect(fourthSupportRequest).toMatchObject({ status: "created" });
    if (fourthSupportRequest.status !== "created") throw new Error("Expected support request");
    await expect(
      supportAccess.reviewAccess(
        ownerActor,
        tenant.id,
        fourthSupportRequest.access.id,
        "deny",
        `support-deny-${suffix}`,
      ),
    ).resolves.toMatchObject({ status: "updated", access: { status: "denied" } });
    const pendingInvitation = await tenancy.createInvitation(ownerActor, tenant.id, {
      email: `supervisor-${suffix}@example.com`,
      role: "supervisor",
      requestId: `invite-supervisor-${suffix}`,
    });
    const pendingToken = new URL(pendingInvitation?.acceptanceUrl ?? "").searchParams.get("token");
    expect((await tenancy.overview(ownerActor, tenant.id))?.pendingInvitations).toContainEqual(
      expect.objectContaining({ id: pendingInvitation?.id, role: "supervisor" }),
    );
    await expect(
      tenancy.revokeInvitation(
        ownerActor,
        tenant.id,
        pendingInvitation?.id ?? "",
        `revoke-supervisor-${suffix}`,
      ),
    ).resolves.toEqual({ status: "revoked" });
    await expect(tenancy.previewInvitation(pendingToken ?? "")).resolves.toBeNull();
    expect((await tenancy.overview(ownerActor, tenant.id))?.activity).toContainEqual(
      expect.objectContaining({ action: "invitation.revoked", actorUsername: invitedUsername }),
    );
    await ownerPool.query(
      `INSERT INTO tenant_memberships (tenant_id, user_id, role, created_by)
       VALUES ($1, $2, 'collector', $3)`,
      [tenant.id, memberId, developerId],
    );
    const memberLogin = await auth.login(`member-${suffix}`, password, {});
    expect(memberLogin?.user.memberships).toContainEqual(
      expect.objectContaining({ tenantId: tenant.id, role: "collector" }),
    );
    await expect(
      tenancy.updateMember(ownerActor, tenant.id, memberId, {
        role: "collector",
        status: "suspended",
        requestId: `member-suspend-${suffix}`,
      }),
    ).resolves.toMatchObject({ status: "updated", member: { status: "suspended" } });
    expect((await auth.authenticate(memberLogin?.token ?? ""))?.memberships).not.toContainEqual(
      expect.objectContaining({ tenantId: tenant.id }),
    );
    await expect(
      tenancy.updateMember(ownerActor, tenant.id, memberId, {
        role: "supervisor",
        status: "active",
        requestId: `member-restore-${suffix}`,
      }),
    ).resolves.toMatchObject({
      status: "updated",
      member: { role: "supervisor", status: "active" },
    });
    expect((await auth.authenticate(memberLogin?.token ?? ""))?.memberships).toContainEqual(
      expect.objectContaining({ tenantId: tenant.id, role: "supervisor" }),
    );
    await expect(
      tenancy.updateMember(ownerActor, tenant.id, ownerActor.userId, {
        role: "supervisor",
        status: "suspended",
        requestId: `member-self-${suffix}`,
      }),
    ).resolves.toEqual({ status: "protected" });
    const settings = await tenancy.updateSettings(ownerActor, tenant.id, {
      primaryColor: "#171717",
      accentColor: "#FBBF24",
      contactEmail: `operations-${suffix}@example.com`,
      contactPhone: "+57 300 123 4567",
      address: "Carrera 10 # 20-30, Bogotá",
      version: 1,
      requestId: `settings-${suffix}`,
    });
    expect(settings).toMatchObject({ status: "updated", settings: { version: 2 } });
    await expect(
      tenancy.updateSettings(ownerActor, tenant.id, {
        primaryColor: "#171717",
        accentColor: "#FBBF24",
        contactEmail: `stale-${suffix}@example.com`,
        contactPhone: null,
        address: null,
        version: 1,
        requestId: `settings-stale-${suffix}`,
      }),
    ).resolves.toEqual({ status: "stale" });

    const branch = await tenancy.createBranch(ownerActor, tenant.id, {
      code: "centro",
      displayName: "Sede Centro",
      requestId: `branch-${suffix}`,
    });
    expect(branch).toMatchObject({ code: "centro", status: "active" });
    const team = await tenancy.createTeam(ownerActor, tenant.id, {
      branchId: branch?.id ?? null,
      displayName: "Ruta Centro",
      requestId: `team-${suffix}`,
    });
    expect(team).toMatchObject({ displayName: "Ruta Centro", branchName: "Sede Centro" });
    await expect(
      tenancy.addTeamMember(
        ownerActor,
        tenant.id,
        team?.id ?? "",
        memberId,
        `team-member-${suffix}`,
      ),
    ).resolves.toEqual({ status: "updated" });

    const configuredOverview = await tenancy.overview(ownerActor, tenant.id);
    expect(configuredOverview?.metrics).toMatchObject({ branches: 1, teams: 1 });
    expect(configuredOverview?.settings.contactEmail).toBe(`operations-${suffix}@example.com`);
    expect(configuredOverview?.settingsHistory).toEqual([
      expect.objectContaining({
        version: 2,
        contactEmail: `operations-${suffix}@example.com`,
        changedByDisplayName: "Invited Owner",
      }),
      expect.objectContaining({
        version: 1,
        changedByDisplayName: "Integration Developer",
      }),
    ]);
    expect(configuredOverview?.teams[0]?.memberIds).toContain(memberId);
    expect(configuredOverview?.activity).toContainEqual(
      expect.objectContaining({
        action: "team.member_assigned",
        actorUsername: invitedUsername,
      }),
    );
    expect(
      (await platform.overview(developerId)).tenants.find((item) => item.id === tenant.id)
        ?.readiness,
    ).toEqual({ activeOwner: true, activeBranch: true, contactEmail: true });
    await expect(
      tenancy.removeTeamMember(
        ownerActor,
        tenant.id,
        team?.id ?? "",
        memberId,
        `team-member-remove-${suffix}`,
      ),
    ).resolves.toEqual({ status: "updated" });
    await expect(
      tenancy.addTeamMember(
        ownerActor,
        tenant.id,
        team?.id ?? "",
        memberId,
        `team-member-reassign-${suffix}`,
      ),
    ).resolves.toEqual({ status: "updated" });
    await expect(
      platform.updateTenantStatus(developerId, tenant.id, "active", `activate-${suffix}`),
    ).resolves.toMatchObject({ status: "updated", tenant: { status: "active" } });
    await expect(
      platform.updateTenantStatus(developerId, tenant.id, "suspended", `suspend-${suffix}`),
    ).resolves.toMatchObject({ status: "updated", tenant: { status: "suspended" } });
    await expect(
      platform.updateTenantStatus(developerId, tenant.id, "active", `restore-${suffix}`),
    ).resolves.toMatchObject({ status: "updated", tenant: { status: "active" } });

    const existingInvitation = await tenancy.createInvitation(
      { userId: developerId, platformRole: "developer", tenantRole: null },
      secondTenant.id,
      {
        email: `owner-${suffix}@example.com`,
        role: "owner",
        requestId: `invite-existing-${suffix}`,
      },
    );
    const existingToken = new URL(existingInvitation?.acceptanceUrl ?? "").searchParams.get(
      "token",
    );
    await expect(tenancy.previewInvitation(existingToken ?? "")).resolves.toMatchObject({
      accountExists: true,
      tenantSlug: secondSlug,
    });
    await expect(
      tenancy.acceptInvitation(
        existingToken ?? "",
        { existingUserId: ownerLogin?.user.id ?? "" },
        `accept-existing-${suffix}`,
      ),
    ).resolves.toEqual({ status: "accepted", tenantSlug: secondSlug });

    const otherBranch = await tenancy.createBranch(
      { userId: developerId, platformRole: "developer", tenantRole: null },
      secondTenant.id,
      {
        code: "norte",
        displayName: "Sede Norte",
        requestId: `branch-other-${suffix}`,
      },
    );
    await expect(
      tenancy.createTeam(ownerActor, tenant.id, {
        branchId: otherBranch?.id ?? null,
        displayName: "Equipo cruzado",
        requestId: `team-cross-tenant-${suffix}`,
      }),
    ).resolves.toBeNull();
    await expect(
      tenancy.addTeamMember(
        ownerActor,
        tenant.id,
        otherBranch?.id ?? "",
        memberId,
        `team-member-cross-${suffix}`,
      ),
    ).resolves.toEqual({ status: "team_not_found" });

    const anonymous = await runtimePool.query<{ count: string }>(
      "SELECT count(*) FROM tenants WHERE slug = ANY($1::citext[])",
      [[slug, secondSlug]],
    );
    expect(Number(anonymous.rows[0]?.count)).toBe(0);

    const client = await runtimePool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.user_id', $1, true)", [memberId]);
      const visible = await client.query<{ count: string }>(
        "SELECT count(*) FROM tenants WHERE slug = ANY($1::citext[])",
        [[slug, secondSlug]],
      );
      expect(Number(visible.rows[0]?.count)).toBe(1);
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }

    await expect(
      tenancy.updateMember(ownerActor, tenant.id, memberId, {
        role: "supervisor",
        status: "revoked",
        requestId: `member-revoke-${suffix}`,
      }),
    ).resolves.toMatchObject({ status: "updated", member: { status: "revoked" } });
    expect((await tenancy.overview(ownerActor, tenant.id))?.teams[0]?.memberIds).not.toContain(
      memberId,
    );
    expect((await auth.authenticate(memberLogin?.token ?? ""))?.memberships).not.toContainEqual(
      expect.objectContaining({ tenantId: tenant.id }),
    );
    await expect(
      tenancy.updateMember(ownerActor, tenant.id, memberId, {
        role: "collector",
        status: "active",
        requestId: `member-reinstate-${suffix}`,
      }),
    ).resolves.toEqual({ status: "invalid_transition" });
  });
});
