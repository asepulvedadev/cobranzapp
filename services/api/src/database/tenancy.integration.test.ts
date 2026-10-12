import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generateMfaToken } from "../auth/mfa.js";
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
  const customerId = crypto.randomUUID();
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
              ($5, $6, $7, 'Integration Member', $4, NULL, false),
              ($8, $9, $10, 'Integration Customer', $4, NULL, false)`,
      [
        developerId,
        `developer-${suffix}`,
        `developer-${suffix}@example.com`,
        passwordHash,
        memberId,
        `member-${suffix}`,
        `member-${suffix}@example.com`,
        customerId,
        `customer-${suffix}`,
        `customer-${suffix}@example.com`,
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
          [developerId, memberId, customerId],
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
        [developerId, memberId, customerId],
      ]);
      await ownerPool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [
        [developerId, memberId, customerId],
      ]);
      await ownerPool.query(
        "DELETE FROM audit_events WHERE actor_user_id IN (SELECT id FROM users WHERE username = $1)",
        [invitedUsername],
      );
      await ownerPool.query("DELETE FROM users WHERE username = $1", [invitedUsername]);
      await ownerPool.query("DELETE FROM users WHERE email::text LIKE $1", [
        `%${suffix}@example.com`,
      ]);
      await ownerPool.end();
    }
    if (runtimePool) await runtimePool.end();
  });

  it("authenticates with username and email and isolates tenant rows", async () => {
    const auth = createPostgresAuthService(runtimePool, 8, Buffer.alloc(32, 7));
    const byUsername = await auth.login(`developer-${suffix}`, password, {
      requestId: `login-username-${suffix}`,
    });
    expect(byUsername?.user.platformRole).toBe("developer");
    await auth.logout(byUsername?.token ?? "", `logout-${suffix}`);

    const byEmail = await auth.login(`developer-${suffix}@example.com`, password, {
      requestId: `login-email-${suffix}`,
    });
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
      requestId: `login-other-${suffix}`,
      userAgent: "Integration Browser",
    });
    const sessions = await auth.listSessions(developerId, byEmail?.token ?? "");
    expect(sessions).toHaveLength(2);
    expect(sessions.find((session) => session.current)?.userAgent).toBeNull();
    const currentSessionId = sessions.find((session) => session.current)?.id ?? "";
    const otherSessionId = sessions.find((session) => !session.current)?.id ?? "";
    await expect(
      auth.revokeSession(
        developerId,
        currentSessionId,
        byEmail?.token ?? "",
        `revoke-current-${suffix}`,
      ),
    ).resolves.toBe("current");
    await expect(
      auth.revokeSession(
        developerId,
        otherSessionId,
        byEmail?.token ?? "",
        `revoke-other-${suffix}`,
      ),
    ).resolves.toBe("revoked");
    await expect(auth.authenticate(otherSession?.token ?? "")).resolves.toBeNull();
    const additionalSession = await auth.login(`developer-${suffix}`, password, {
      requestId: `login-additional-${suffix}`,
    });
    await expect(
      auth.revokeOtherSessions(developerId, byEmail?.token ?? "", `revoke-others-${suffix}`),
    ).resolves.toBe(1);
    await expect(auth.authenticate(additionalSession?.token ?? "")).resolves.toBeNull();
    const securityActivity = await auth.listSecurityActivity(developerId);
    expect(securityActivity.map((event) => event.action)).toEqual(
      expect.arrayContaining([
        "auth.login_succeeded",
        "auth.logged_out",
        "auth.session_revoked",
        "auth.other_sessions_revoked",
        "auth.reauthenticated",
      ]),
    );
    await expect(auth.authenticate(byEmail?.token ?? "")).resolves.toMatchObject({
      id: developerId,
    });
    const enrollment = await auth.beginMfaEnrollment(developerId, `mfa-start-${suffix}`);
    expect(enrollment).toMatchObject({
      status: "created",
      secret: expect.any(String),
      uri: expect.stringContaining("otpauth://totp/"),
    });
    if (enrollment.status !== "created") throw new Error("MFA enrollment was not created");
    const confirmation = await auth.confirmMfaEnrollment(
      developerId,
      byEmail?.token ?? "",
      generateMfaToken(enrollment.secret),
      `mfa-enable-${suffix}`,
    );
    expect(confirmation).toMatchObject({
      status: "enabled",
      recoveryCodes: expect.arrayContaining([expect.stringMatching(/^[A-F0-9-]+$/)]),
    });
    if (confirmation.status !== "enabled") throw new Error("MFA enrollment was not confirmed");
    await expect(auth.getMfaStatus(developerId)).resolves.toMatchObject({
      enabled: true,
      setupPending: false,
    });
    await expect(auth.authenticate(byEmail?.token ?? "")).resolves.toMatchObject({
      id: developerId,
      mfaEnabled: true,
    });
    const recoveryCodes = await ownerPool.query<{ count: string }>(
      "SELECT count(*) AS count FROM auth_mfa_recovery_codes WHERE user_id = $1 AND used_at IS NULL",
      [developerId],
    );
    expect(Number(recoveryCodes.rows[0]?.count)).toBe(8);
    const secondEnrollment = await auth.beginMfaEnrollment(
      developerId,
      `mfa-already-enabled-${suffix}`,
    );
    expect(secondEnrollment).toEqual({ status: "already_enabled" });
    const enabledResult = await auth.confirmMfaEnrollment(
      developerId,
      byEmail?.token ?? "",
      "000000",
      `mfa-already-confirmed-${suffix}`,
    );
    expect(enabledResult).toEqual({ status: "already_enabled" });
    const lockedChallenge = await auth.login(`developer-${suffix}@example.com`, password, {
      requestId: `mfa-lock-${suffix}`,
    });
    if (lockedChallenge?.status !== "mfa_required") {
      throw new Error("MFA lock challenge was not created");
    }
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await expect(
        auth.verifyMfaChallenge(
          lockedChallenge.challengeToken,
          "000000",
          `mfa-lock-${attempt}-${suffix}`,
        ),
      ).resolves.toEqual({ status: attempt === 5 ? "locked" : "invalid" });
    }
    await expect(
      auth.verifyMfaChallenge(
        lockedChallenge.challengeToken,
        generateMfaToken(enrollment.secret, Date.now() + 30_000),
        `mfa-locked-${suffix}`,
      ),
    ).resolves.toEqual({ status: "locked" });
    const challenged = await auth.login(`developer-${suffix}@example.com`, password, {
      requestId: `mfa-login-${suffix}`,
      userAgent: "MFA Integration Browser",
    });
    expect(challenged).toMatchObject({ status: "mfa_required" });
    if (challenged?.status !== "mfa_required") {
      throw new Error("MFA login challenge was not created");
    }
    const verified = await auth.verifyMfaChallenge(
      challenged.challengeToken,
      generateMfaToken(enrollment.secret, Date.now() + 30_000),
      `mfa-verified-${suffix}`,
    );
    expect(verified).toMatchObject({ status: "authenticated" });
    if (verified.status !== "authenticated") throw new Error("MFA challenge was not verified");
    await expect(auth.authenticate(verified.token)).resolves.toMatchObject({
      id: developerId,
      mfaEnabled: true,
    });
    await expect(
      auth.verifyMfaChallenge(
        challenged.challengeToken,
        generateMfaToken(enrollment.secret, Date.now() + 60_000),
        `mfa-reused-${suffix}`,
      ),
    ).resolves.toEqual({ status: "invalid" });
    await expect(
      auth.disableMfa(
        developerId,
        byEmail?.token ?? "",
        "not-a-recovery-code",
        `mfa-bad-${suffix}`,
      ),
    ).resolves.toEqual({ status: "invalid" });
    const disabled = await auth.disableMfa(
      developerId,
      byEmail?.token ?? "",
      confirmation.recoveryCodes[0] ?? "",
      `mfa-disable-${suffix}`,
    );
    expect(disabled).toMatchObject({ status: "disabled" });
    await expect(auth.getMfaStatus(developerId)).resolves.toMatchObject({ enabled: false });
    await expect(auth.authenticate(byEmail?.token ?? "")).resolves.toMatchObject({
      id: developerId,
      mfaEnabled: false,
    });
    const platform = createPostgresPlatformService(runtimePool);
    const supportAccess = createPostgresSupportAccessService(runtimePool);
    await expect(platform.systemStatus(developerId)).resolves.toMatchObject({
      schemaVersion: "0016_verification_network_foundation.sql",
      jobs: {
        status: expect.stringMatching(/^(operational|attention)$/),
        due: expect.any(Number),
        scheduled: expect.any(Number),
        processing: expect.any(Number),
        dead: expect.any(Number),
        expiredLeases: expect.any(Number),
      },
      checkedAt: expect.any(String),
    });
    await expect(
      platform.listUsers(developerId, {
        search: `member-${suffix}`,
        status: "active",
        page: 1,
        pageSize: 10,
      }),
    ).resolves.toMatchObject({
      users: [
        {
          id: memberId,
          username: `member-${suffix}`,
          status: "active",
          platformRole: null,
        },
      ],
      pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
    });
    const memberSession = await auth.login(`member-${suffix}`, password, {
      requestId: `member-login-${suffix}`,
    });
    await expect(
      platform.updateUserStatus(developerId, memberId, "disabled", `disable-member-${suffix}`),
    ).resolves.toMatchObject({ status: "updated", userStatus: "disabled", revokedSessions: 1 });
    await expect(auth.authenticate(memberSession?.token ?? "")).resolves.toBeNull();
    await expect(
      auth.login(`member-${suffix}`, password, { requestId: `disabled-login-${suffix}` }),
    ).resolves.toBeNull();
    await expect(
      platform.updateUserStatus(developerId, developerId, "disabled", `disable-self-${suffix}`),
    ).resolves.toEqual({ status: "protected" });
    await expect(
      platform.updateUserStatus(developerId, memberId, "active", `enable-member-${suffix}`),
    ).resolves.toMatchObject({ status: "updated", userStatus: "active" });
    await expect(
      auth.login(`member-${suffix}`, password, { requestId: `enabled-login-${suffix}` }),
    ).resolves.toMatchObject({ user: { id: memberId } });
    expect(
      (
        await ownerPool.query<{ metadata: { from: string; to: string } }>(
          `SELECT metadata
             FROM audit_events
            WHERE target_id = $1 AND action = 'user.status_changed'
            ORDER BY happened_at DESC
            LIMIT 1`,
          [memberId],
        )
      ).rows[0]?.metadata,
    ).toMatchObject({ from: "disabled", to: "active" });
    const tenant = await platform.createTenant(developerId, {
      displayName: "Tenant Integration",
      slug,
      membershipPlan: "pro",
      requestId: `test-${suffix}`,
    });
    const secondTenant = await platform.createTenant(developerId, {
      displayName: "Tenant Secondary",
      slug: secondSlug,
      membershipPlan: "ultra",
      requestId: `test-secondary-${suffix}`,
    });
    expect(tenant.status).toBe("draft");
    expect(tenant).toMatchObject({
      membershipPlan: "pro",
      membershipEntitlement: {
        version: 1,
        includedEmployeeSeats: 5,
        additionalEmployeeSeats: 0,
        employeeSeatLimit: 5,
        clientLimit: 100,
      },
      readiness: { membershipPlan: true },
    });
    expect(secondTenant).toMatchObject({
      membershipPlan: "ultra",
      membershipEntitlement: { includedEmployeeSeats: 50, employeeSeatLimit: 50 },
    });
    await expect(
      platform.updateMembershipPlan(developerId, tenant.id, "ultra", `membership-plan-${suffix}`),
    ).resolves.toMatchObject({
      status: "updated",
      membershipPlan: "ultra",
      membershipEntitlement: { version: 2, employeeSeatLimit: 50, clientLimit: 200 },
    });
    await expect(
      platform.updateMembershipEntitlement(
        developerId,
        tenant.id,
        3,
        `membership-capacity-${suffix}`,
      ),
    ).resolves.toMatchObject({
      status: "updated",
      membershipEntitlement: {
        version: 3,
        additionalEmployeeSeats: 3,
        employeeSeatLimit: 53,
      },
    });
    expect(
      (
        await ownerPool.query<{ membership_plan: string }>(
          "SELECT membership_plan FROM tenants WHERE id = $1",
          [tenant.id],
        )
      ).rows[0]?.membership_plan,
    ).toBe("ultra");
    expect(
      (
        await ownerPool.query<{ metadata: { from: string; to: string } }>(
          `SELECT metadata
             FROM audit_events
            WHERE tenant_id = $1 AND action = 'tenant.membership_plan_changed'
            ORDER BY happened_at DESC
            LIMIT 1`,
          [tenant.id],
        )
      ).rows[0]?.metadata,
    ).toMatchObject({ from: "pro", to: "ultra" });
    await ownerPool.query("UPDATE tenants SET membership_plan = NULL WHERE id = $1", [
      secondTenant.id,
    ]);
    await expect(
      platform.updateTenantStatus(
        developerId,
        secondTenant.id,
        "active",
        `activate-without-plan-${suffix}`,
      ),
    ).resolves.toMatchObject({
      status: "not_ready",
      missing: expect.arrayContaining(["membership_plan"]),
    });
    await expect(
      platform.updateMembershipPlan(
        developerId,
        secondTenant.id,
        "ultra",
        `restore-plan-${suffix}`,
      ),
    ).resolves.toMatchObject({ status: "updated", membershipPlan: "ultra" });
    await ownerPool.query(
      `INSERT INTO outbox_events (
         tenant_id, event_type, aggregate_type, aggregate_id,
         idempotency_key, status, max_attempts
       ) VALUES ($1, 'test.dead', 'tenant', $1, $2, 'dead', 1)`,
      [tenant.id, `platform-status-${suffix}`],
    );
    const alertedSystemStatus = await platform.systemStatus(developerId);
    expect(alertedSystemStatus.jobs.status).toBe("attention");
    expect(alertedSystemStatus.jobs.dead).toBeGreaterThan(0);
    await expect(
      platform.listTenants(developerId, {
        search: secondSlug,
        status: "draft",
        page: 99,
        pageSize: 1,
      }),
    ).resolves.toMatchObject({
      tenants: [{ id: secondTenant.id, slug: secondSlug, status: "draft" }],
      pagination: { page: 1, pageSize: 1, total: 1, totalPages: 1 },
    });
    const platformOverview = await platform.overview(developerId);
    expect(platformOverview.activity).toContainEqual(
      expect.objectContaining({
        action: "tenant.created",
        actorUsername: `developer-${suffix}`,
        tenantId: tenant.id,
      }),
    );
    await expect(
      platform.listActivity(developerId, {
        search: "Tenant Integration",
        action: "tenant.created",
        page: 99,
        pageSize: 1,
      }),
    ).resolves.toMatchObject({
      activity: [
        {
          action: "tenant.created",
          actorUsername: `developer-${suffix}`,
          tenantId: tenant.id,
          tenantName: "Tenant Integration",
        },
      ],
      availableActions: expect.arrayContaining(["tenant.created"]),
      pagination: { page: 1, pageSize: 1, total: 1, totalPages: 1 },
    });
    expect(platformOverview.tenants.find((item) => item.id === tenant.id)?.readiness).toEqual({
      activeOwner: false,
      activeBranch: false,
      contactEmail: false,
      membershipPlan: true,
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
    const ownerLogin = await auth.login(`owner-${suffix}@example.com`, password, {
      requestId: `login-owner-${suffix}`,
    });
    expect(ownerLogin?.user.memberships).toContainEqual(
      expect.objectContaining({ tenantId: tenant.id, role: "owner" }),
    );
    const ownerActor = {
      userId: ownerLogin?.user.id ?? "",
      platformRole: null,
      tenantRole: "owner" as const,
    };
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
    expect(ownerOverview?.tenant.membershipPlan).toBe("ultra");
    expect(ownerOverview?.metrics.members).toBe(1);
    expect(ownerOverview?.metrics.activeEmployeeSeats).toBe(0);
    expect(ownerOverview?.membershipEntitlement).toMatchObject({
      version: 3,
      includedEmployeeSeats: 50,
      additionalEmployeeSeats: 3,
      employeeSeatLimit: 53,
      availableEmployeeSeats: 53,
      clientLimit: 200,
    });

    await expect(
      platform.updateMembershipEntitlement(
        developerId,
        tenant.id,
        0,
        `membership-capacity-reset-${suffix}`,
      ),
    ).resolves.toMatchObject({
      status: "updated",
      membershipEntitlement: { additionalEmployeeSeats: 0, employeeSeatLimit: 50 },
    });
    await expect(
      platform.updateMembershipPlan(developerId, tenant.id, "pro", `membership-pro-${suffix}`),
    ).resolves.toMatchObject({
      status: "updated",
      membershipEntitlement: { employeeSeatLimit: 5 },
    });
    const seatInvitations = await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        tenancy.createInvitation(ownerActor, tenant.id, {
          email: `seat-${index + 1}-${suffix}@example.com`,
          role: index % 2 === 0 ? "collector" : "supervisor",
          requestId: `seat-invite-${index + 1}-${suffix}`,
        }),
      ),
    );
    const seatTokens = seatInvitations.map(
      (invitation) => new URL(invitation?.acceptanceUrl ?? "").searchParams.get("token") ?? "",
    );
    const seatResults = await Promise.all(
      seatTokens.map((token, index) =>
        tenancy.acceptInvitation(
          token,
          {
            username: `seat-${index + 1}-${suffix}`,
            displayName: `Empleado ${index + 1}`,
            password,
          },
          `seat-accept-${index + 1}-${suffix}`,
        ),
      ),
    );
    expect(seatResults.filter((result) => result.status === "accepted")).toHaveLength(5);
    expect(seatResults).toContainEqual({ status: "seat_limit_reached", employeeSeatLimit: 5 });
    expect((await tenancy.overview(ownerActor, tenant.id))?.membershipEntitlement).toMatchObject({
      employeeSeatLimit: 5,
      availableEmployeeSeats: 0,
    });
    await expect(
      platform.updateMembershipEntitlement(
        developerId,
        tenant.id,
        1,
        `membership-capacity-six-${suffix}`,
      ),
    ).resolves.toMatchObject({
      status: "updated",
      membershipEntitlement: { employeeSeatLimit: 6 },
    });
    const rejectedSeatIndex = seatResults.findIndex(
      (result) => result.status === "seat_limit_reached",
    );
    await expect(
      tenancy.acceptInvitation(
        seatTokens[rejectedSeatIndex] ?? "",
        {
          username: `seat-${rejectedSeatIndex + 1}-${suffix}`,
          displayName: `Empleado ${rejectedSeatIndex + 1}`,
          password,
        },
        `seat-accept-expanded-${suffix}`,
      ),
    ).resolves.toMatchObject({ status: "accepted" });
    await expect(
      platform.updateMembershipEntitlement(
        developerId,
        tenant.id,
        0,
        `membership-capacity-too-small-${suffix}`,
      ),
    ).resolves.toEqual({
      status: "seat_limit_conflict",
      activeEmployeeSeats: 6,
      employeeSeatLimit: 5,
    });
    await expect(
      platform.updateMembershipEntitlement(
        developerId,
        tenant.id,
        2,
        `membership-capacity-seven-${suffix}`,
      ),
    ).resolves.toMatchObject({
      status: "updated",
      membershipEntitlement: { employeeSeatLimit: 7 },
    });
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
    expect(
      (
        await ownerPool.query(
          `SELECT tenant_id, event_type, aggregate_type, aggregate_id, status, available_at
             FROM outbox_events
            WHERE aggregate_id = $1`,
          [supportRequest.access.id],
        )
      ).rows[0],
    ).toMatchObject({
      tenant_id: tenant.id,
      event_type: "support_access.expire",
      aggregate_type: "support_access",
      aggregate_id: supportRequest.access.id,
      status: "pending",
      available_at: expect.any(Date),
    });
    await expect(supportAccess.findActiveAccess(developerId, tenant.id)).resolves.toMatchObject({
      id: supportRequest.access.id,
      status: "active",
    });
    await expect(
      tenancy.overview(
        {
          userId: developerId,
          platformRole: "developer",
          tenantRole: null,
          supportAccessId: supportRequest.access.id,
        },
        tenant.id,
      ),
    ).resolves.toMatchObject({ actorRole: "support", tenant: { id: tenant.id } });
    await expect(
      tenancy.overview(
        { userId: developerId, platformRole: "developer", tenantRole: null },
        tenant.id,
      ),
    ).resolves.toBeNull();
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
       VALUES ($1, $2, 'collector', $4),
              ($1, $3, 'customer', $4)`,
      [tenant.id, memberId, customerId, developerId],
    );
    const memberLogin = await auth.login(`member-${suffix}`, password, {
      requestId: `login-member-${suffix}`,
    });
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
    const unassignedBranch = await tenancy.createBranch(ownerActor, tenant.id, {
      code: "sur",
      displayName: "Sede Sur",
      requestId: `branch-unassigned-${suffix}`,
    });
    const unassignedTeam = await tenancy.createTeam(ownerActor, tenant.id, {
      branchId: unassignedBranch?.id ?? null,
      displayName: "Ruta Sur",
      requestId: `team-unassigned-${suffix}`,
    });
    expect(unassignedTeam).toMatchObject({ displayName: "Ruta Sur", branchName: "Sede Sur" });
    await expect(
      tenancy.updateMember(ownerActor, tenant.id, memberId, {
        role: "collector",
        status: "active",
        requestId: `member-collector-scope-${suffix}`,
      }),
    ).resolves.toMatchObject({ status: "updated", member: { role: "collector" } });

    const collectorOverview = await tenancy.overview(
      { userId: memberId, platformRole: null, tenantRole: "collector" },
      tenant.id,
    );
    expect(collectorOverview?.metrics).toEqual({
      members: 0,
      branches: 1,
      teams: 1,
      pendingInvitations: 0,
      activeEmployeeSeats: 0,
    });
    expect(collectorOverview?.branches.map((item) => item.id)).toEqual([branch?.id]);
    expect(collectorOverview?.teams.map((item) => item.id)).toEqual([team?.id]);
    expect(collectorOverview?.teams[0]?.memberIds).toEqual([]);

    await ownerPool.query("UPDATE teams SET status = 'inactive' WHERE tenant_id = $1 AND id = $2", [
      tenant.id,
      team?.id,
    ]);
    const collectorWithoutActiveScope = await tenancy.overview(
      { userId: memberId, platformRole: null, tenantRole: "collector" },
      tenant.id,
    );
    expect(collectorWithoutActiveScope?.branches).toEqual([]);
    expect(collectorWithoutActiveScope?.teams).toEqual([]);
    await ownerPool.query("UPDATE teams SET status = 'active' WHERE tenant_id = $1 AND id = $2", [
      tenant.id,
      team?.id,
    ]);
    await expect(
      tenancy.updateBranchStatus(
        ownerActor,
        tenant.id,
        branch?.id ?? "",
        "inactive",
        `branch-blocked-${suffix}`,
      ),
    ).resolves.toEqual({ status: "has_active_teams" });
    await expect(
      tenancy.updateTeamStatus(
        ownerActor,
        tenant.id,
        team?.id ?? "",
        "inactive",
        `team-inactive-${suffix}`,
      ),
    ).resolves.toEqual({ status: "updated", teamStatus: "inactive" });
    await expect(
      tenancy.updateBranchStatus(
        ownerActor,
        tenant.id,
        branch?.id ?? "",
        "inactive",
        `branch-inactive-${suffix}`,
      ),
    ).resolves.toEqual({ status: "updated", branchStatus: "inactive" });
    await expect(
      tenancy.updateTeamStatus(
        ownerActor,
        tenant.id,
        team?.id ?? "",
        "active",
        `team-blocked-${suffix}`,
      ),
    ).resolves.toEqual({ status: "branch_inactive" });
    await expect(
      tenancy.updateBranchStatus(
        ownerActor,
        tenant.id,
        branch?.id ?? "",
        "active",
        `branch-active-${suffix}`,
      ),
    ).resolves.toEqual({ status: "updated", branchStatus: "active" });
    await expect(
      tenancy.updateTeamStatus(
        ownerActor,
        tenant.id,
        team?.id ?? "",
        "active",
        `team-active-${suffix}`,
      ),
    ).resolves.toEqual({ status: "updated", teamStatus: "active" });

    const customerOverview = await tenancy.overview(
      { userId: customerId, platformRole: null, tenantRole: "customer" },
      tenant.id,
    );
    expect(customerOverview).toMatchObject({
      actorRole: "customer",
      metrics: { members: 0, branches: 0, teams: 0, pendingInvitations: 0 },
      members: [],
      branches: [],
      teams: [],
      pendingInvitations: [],
      activity: [],
    });

    const configuredOverview = await tenancy.overview(ownerActor, tenant.id);
    expect(configuredOverview?.metrics).toMatchObject({ branches: 2, teams: 2 });
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
    expect(configuredOverview?.activity).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "branch.status_changed" }),
        expect.objectContaining({ action: "team.status_changed" }),
      ]),
    );
    expect(
      (await platform.overview(developerId)).tenants.find((item) => item.id === tenant.id)
        ?.readiness,
    ).toEqual({
      activeOwner: true,
      activeBranch: true,
      contactEmail: true,
      membershipPlan: true,
    });
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

    const nextPassword = "updated-integration-password-123";
    await expect(
      auth.changePassword(developerId, password, nextPassword, `password-change-${suffix}`),
    ).resolves.toBe(true);
    await expect(auth.authenticate(byEmail?.token ?? "")).resolves.toBeNull();
    await expect(
      auth.login(`developer-${suffix}`, password, { requestId: `old-password-${suffix}` }),
    ).resolves.toBeNull();
    await expect(
      auth.login(`developer-${suffix}`, nextPassword, { requestId: `new-password-${suffix}` }),
    ).resolves.toMatchObject({ user: { id: developerId } });
    await expect(auth.listSecurityActivity(developerId)).resolves.toContainEqual(
      expect.objectContaining({ action: "auth.password_changed" }),
    );
  });
});
