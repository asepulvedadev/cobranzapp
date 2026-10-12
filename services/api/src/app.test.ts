import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "./app.js";
import type { AuthenticatedUser, AuthService } from "./auth/types.js";
import type { PlatformService } from "./platform/types.js";
import type { SupportAccessRecord, SupportAccessService } from "./support-access/types.js";
import type { TenancyService } from "./tenancy/types.js";

const developer: AuthenticatedUser = {
  id: "8a44ba60-9500-4dd0-85b8-d428194165f2",
  username: "desarrollador",
  email: "dev@example.com",
  displayName: "Desarrollador",
  platformRole: "developer",
  mustChangePassword: true,
  memberships: [],
};

const tenantOwner: AuthenticatedUser = {
  ...developer,
  id: "88e9c535-a13b-4f99-a99c-b1bc4f3b9f45",
  username: "propietario",
  email: "owner@example.com",
  displayName: "Propietario",
  platformRole: null,
  mustChangePassword: false,
  memberships: [
    {
      tenantId: "5c58269f-ce16-4250-82e2-c0c16621b0fb",
      tenantName: "Empresa Uno",
      tenantSlug: "empresa-uno",
      role: "owner",
    },
  ],
};

const supportAccessRecord: SupportAccessRecord = {
  id: "5b511ded-bb78-4994-b170-7f47cc440111",
  tenantId: "5c58269f-ce16-4250-82e2-c0c16621b0fb",
  tenantName: "Empresa Uno",
  requestedByDisplayName: "Desarrollador",
  purpose: "Revisar la configuración de la empresa",
  requestedDurationMinutes: 60,
  status: "pending",
  requestedAt: "2026-10-11T00:00:00.000Z",
  reviewedByDisplayName: null,
  reviewedAt: null,
  expiresAt: null,
};

const proEntitlement = {
  catalogVersion: 1,
  version: 1,
  includedEmployeeSeats: 5,
  additionalEmployeeSeats: 0,
  employeeSeatLimit: 5,
  clientLimit: 100,
  prioritySupport: false,
};

function dependencies(overrides?: {
  authService?: Partial<AuthService>;
  supportAccessService?: Partial<SupportAccessService>;
}) {
  const authService: AuthService = {
    login: vi.fn(async () => ({ token: "session-token", user: developer })),
    authenticate: vi.fn(async () => developer),
    logout: vi.fn(async () => undefined),
    reauthenticate: vi.fn(async () => true),
    isRecentlyReauthenticated: vi.fn(async () => true),
    changePassword: vi.fn(async () => true),
    listSessions: vi.fn(async () => [
      {
        id: "0ecb798b-b0f6-4536-8a48-8ba09ca37cf0",
        userAgent: "Test Browser",
        createdAt: "2026-10-11T00:00:00.000Z",
        lastSeenAt: "2026-10-11T01:00:00.000Z",
        expiresAt: "2026-10-11T08:00:00.000Z",
        current: true,
      },
    ]),
    listSecurityActivity: vi.fn(async () => [
      {
        id: "c07dfc04-d8c5-48c6-a774-65a8d5e9cd33",
        action: "auth.login_succeeded",
        happenedAt: "2026-10-11T00:00:00.000Z",
      },
    ]),
    revokeSession: vi.fn(async () => "revoked"),
    revokeOtherSessions: vi.fn(async () => 2),
    ...overrides?.authService,
  };
  const platformService: PlatformService = {
    systemStatus: vi.fn(async () => ({
      schemaVersion: "0012_inactive_organization_scope.sql",
      jobs: {
        status: "operational",
        due: 0,
        scheduled: 1,
        processing: 0,
        dead: 0,
        expiredLeases: 0,
        oldestDueAt: null,
      },
      checkedAt: "2026-10-11T00:00:00.000Z",
    })),
    overview: vi.fn(async () => ({
      metrics: { tenants: 0, activeTenants: 0, users: 1, activeMemberships: 0 },
      tenants: [],
      activity: [],
    })),
    listTenants: vi.fn(async (_actor, query) => ({
      tenants: [],
      pagination: { page: query.page, pageSize: query.pageSize, total: 0, totalPages: 1 },
    })),
    listUsers: vi.fn(async (_actor, query) => ({
      users: [],
      pagination: { page: query.page, pageSize: query.pageSize, total: 0, totalPages: 1 },
    })),
    createTenant: vi.fn(async (_actor, input) => ({
      id: "5c58269f-ce16-4250-82e2-c0c16621b0fb",
      displayName: input.displayName,
      slug: input.slug,
      status: "draft",
      membershipPlan: input.membershipPlan,
      membershipEntitlement: proEntitlement,
      members: 0,
      readiness: {
        activeOwner: false,
        activeBranch: false,
        contactEmail: false,
        membershipPlan: true,
      },
      createdAt: "2026-10-11T00:00:00.000Z",
    })),
    updateMembershipPlan: vi.fn(async (_actor, _tenantId, membershipPlan) => ({
      status: "updated",
      membershipPlan,
      membershipEntitlement:
        membershipPlan === "pro"
          ? proEntitlement
          : {
              ...proEntitlement,
              includedEmployeeSeats: 50,
              employeeSeatLimit: 50,
              clientLimit: 200,
              prioritySupport: true,
            },
    })),
    updateMembershipEntitlement: vi.fn(async (_actor, _tenantId, additionalEmployeeSeats) => ({
      status: "updated",
      membershipEntitlement: {
        ...proEntitlement,
        version: 2,
        additionalEmployeeSeats,
        employeeSeatLimit: proEntitlement.includedEmployeeSeats + additionalEmployeeSeats,
      },
    })),
    updateTenantStatus: vi.fn(async (_actor, tenantId, status) => ({
      status: "updated",
      tenant: {
        id: tenantId,
        displayName: "Empresa Uno",
        slug: "empresa-uno",
        status,
        membershipPlan: "pro",
        membershipEntitlement: proEntitlement,
        members: 1,
        readiness: {
          activeOwner: true,
          activeBranch: true,
          contactEmail: true,
          membershipPlan: true,
        },
        createdAt: "2026-10-11T00:00:00.000Z",
      },
    })),
    updateUserStatus: vi.fn(async (_actor, _userId, status) => ({
      status: "updated",
      userStatus: status,
      revokedSessions: status === "disabled" ? 1 : 0,
    })),
  };
  const tenancyService: TenancyService = {
    createInvitation: vi.fn(async (_actor, _tenantId, input) => ({
      id: "ac08c04c-1026-4700-975c-38844928f89c",
      email: input.email,
      role: input.role,
      expiresAt: "2026-10-14T00:00:00.000Z",
      acceptanceUrl:
        "https://cobranzaap.tech/activar?token=valid-invitation-token-abcdefghijklmnopqrstuvwxyz",
    })),
    previewInvitation: vi.fn(async () => ({
      email: "owner@example.com",
      role: "owner",
      tenantName: "Empresa Uno",
      tenantSlug: "empresa-uno",
      expiresAt: "2026-10-14T00:00:00.000Z",
      accountExists: false,
    })),
    acceptInvitation: vi.fn(async () => ({ status: "accepted", tenantSlug: "empresa-uno" })),
    revokeInvitation: vi.fn(async () => ({ status: "revoked" })),
    overview: vi.fn(async () => ({
      tenant: {
        id: "5c58269f-ce16-4250-82e2-c0c16621b0fb",
        slug: "empresa-uno",
        displayName: "Empresa Uno",
        status: "draft",
        locale: "es-CO",
        timezone: "America/Bogota",
        currency: "COP",
        membershipPlan: "pro",
      },
      actorRole: "owner",
      metrics: {
        members: 1,
        branches: 0,
        teams: 0,
        pendingInvitations: 0,
        activeEmployeeSeats: 0,
      },
      membershipEntitlement: { ...proEntitlement, availableEmployeeSeats: 5 },
      settings: {
        primaryColor: "#171717",
        accentColor: "#FBBF24",
        contactEmail: null,
        contactPhone: null,
        address: null,
        version: 1,
      },
      settingsHistory: [],
      members: [],
      branches: [],
      teams: [],
      pendingInvitations: [],
      activity: [],
    })),
    updateSettings: vi.fn(async (_actor, _tenantId, input) => ({
      status: "updated",
      settings: {
        primaryColor: input.primaryColor,
        accentColor: input.accentColor,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        address: input.address,
        version: input.version + 1,
      },
    })),
    createBranch: vi.fn(async (_actor, _tenantId, input) => ({
      id: "9ec06ada-07c8-42ba-b1f8-af0fc43c75e4",
      code: input.code,
      displayName: input.displayName,
      status: "active",
    })),
    createTeam: vi.fn(async (_actor, _tenantId, input) => ({
      id: "4ffec9ec-1e7a-4a25-93f7-6b57776ce8af",
      branchId: input.branchId,
      branchName: input.branchId ? "Sede Centro" : null,
      displayName: input.displayName,
      status: "active",
      memberIds: [],
    })),
    updateBranchStatus: vi.fn(async (_actor, _tenantId, _branchId, status) => ({
      status: "updated",
      branchStatus: status,
    })),
    updateTeamStatus: vi.fn(async (_actor, _tenantId, _teamId, status) => ({
      status: "updated",
      teamStatus: status,
    })),
    addTeamMember: vi.fn(async () => ({ status: "updated" })),
    removeTeamMember: vi.fn(async () => ({ status: "updated" })),
    updateMember: vi.fn(async (_actor, _tenantId, userId, input) => ({
      status: "updated",
      member: {
        userId,
        displayName: "Cobrador Uno",
        email: "cobrador@example.com",
        username: "cobrador",
        role: input.role,
        status: input.status,
      },
    })),
  };
  const supportAccessService: SupportAccessService = {
    requestAccess: vi.fn(async () => ({ status: "created", access: supportAccessRecord })),
    listForDeveloper: vi.fn(async () => [supportAccessRecord]),
    listForTenant: vi.fn(async () => [supportAccessRecord]),
    reviewAccess: vi.fn(async () => ({
      status: "updated",
      access: { ...supportAccessRecord, status: "active", expiresAt: "2026-10-11T01:00:00.000Z" },
    })),
    cancelAccess: vi.fn(async () => ({
      status: "updated",
      access: { ...supportAccessRecord, status: "revoked" },
    })),
    findActiveAccess: vi.fn(async () => ({
      ...supportAccessRecord,
      status: "active",
      expiresAt: "2026-10-11T01:00:00.000Z",
    })),
    ...overrides?.supportAccessService,
  };
  return {
    allowedWebOrigins: ["https://cobranzaap.tech"],
    authService,
    checkDatabase: async () => undefined,
    isProduction: true,
    platformService,
    supportAccessService,
    tenancyService,
    version: "test",
  };
}

const apps: ReturnType<typeof buildApp>[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("health endpoints", () => {
  it("reports the process as healthy", async () => {
    const app = buildApp(dependencies());
    apps.push(app);
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ service: "api", status: "ok", version: "test" });
  });

  it("reports readiness failure when PostgreSQL is unavailable", async () => {
    const app = buildApp({
      ...dependencies(),
      checkDatabase: async () => {
        throw new Error("unavailable");
      },
    });
    apps.push(app);
    const response = await app.inject({ method: "GET", url: "/ready" });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ service: "api", status: "degraded" });
  });
});

describe("authentication", () => {
  it("accepts a username or email identifier and sets a secure session cookie", async () => {
    const deps = dependencies();
    const app = buildApp(deps);
    apps.push(app);
    const response = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      headers: { origin: "https://cobranzaap.tech" },
      payload: { identifier: "DEV@EXAMPLE.COM", password: "correct-password" },
    });
    expect(response.statusCode).toBe(200);
    expect(deps.authService.login).toHaveBeenCalledWith(
      "dev@example.com",
      "correct-password",
      expect.objectContaining({ requestId: expect.any(String) }),
    );
    expect(response.headers["set-cookie"]).toContain("HttpOnly");
    expect(response.headers["set-cookie"]).toContain("SameSite=Strict");
    expect(response.headers["set-cookie"]).toContain("Secure");
  });

  it("rejects state-changing requests from an unknown origin", async () => {
    const app = buildApp(dependencies());
    apps.push(app);
    const response = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      headers: { origin: "https://example.net" },
      payload: { identifier: "desarrollador", password: "correct-password" },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: { code: "ORIGIN_NOT_ALLOWED" } });
  });

  it("does not reveal which credential is incorrect", async () => {
    const app = buildApp(dependencies({ authService: { login: vi.fn(async () => null) } }));
    apps.push(app);
    const response = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      headers: { origin: "https://cobranzaap.tech" },
      payload: { identifier: "missing@example.com", password: "incorrect-pass" },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: { code: "INVALID_CREDENTIALS" } });
  });

  it("reauthenticates the current session without issuing another token", async () => {
    const deps = dependencies();
    const app = buildApp(deps);
    apps.push(app);
    const response = await app.inject({
      method: "POST",
      url: "/v1/auth/reauthenticate",
      headers: {
        cookie: "cobranzapp_session=session-token",
        origin: "https://cobranzaap.tech",
      },
      payload: { password: "correct-password" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ reauthenticated: true, validForMinutes: 10 });
    expect(deps.authService.reauthenticate).toHaveBeenCalledWith(
      developer.id,
      "session-token",
      "correct-password",
      expect.any(String),
    );
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("rejects an incorrect password during reauthentication", async () => {
    const app = buildApp(
      dependencies({ authService: { reauthenticate: vi.fn(async () => false) } }),
    );
    apps.push(app);
    const response = await app.inject({
      method: "POST",
      url: "/v1/auth/reauthenticate",
      headers: {
        cookie: "cobranzapp_session=session-token",
        origin: "https://cobranzaap.tech",
      },
      payload: { password: "incorrect-password" },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: { code: "REAUTHENTICATION_FAILED" } });
  });

  it("lists and revokes only sessions owned by the authenticated user", async () => {
    const deps = dependencies();
    const app = buildApp(deps);
    apps.push(app);
    const headers = { cookie: "cobranzapp_session=session-token" };
    const sessions = await app.inject({ method: "GET", url: "/v1/auth/sessions", headers });
    expect(sessions.statusCode).toBe(200);
    expect(sessions.json()).toMatchObject({ sessions: [{ current: true }] });

    const revoked = await app.inject({
      method: "DELETE",
      url: "/v1/auth/sessions/0ecb798b-b0f6-4536-8a48-8ba09ca37cf0",
      headers: { ...headers, origin: "https://cobranzaap.tech" },
    });
    expect(revoked.statusCode).toBe(204);
    expect(deps.authService.revokeSession).toHaveBeenCalledWith(
      developer.id,
      "0ecb798b-b0f6-4536-8a48-8ba09ca37cf0",
      "session-token",
      expect.any(String),
    );

    const others = await app.inject({
      method: "POST",
      url: "/v1/auth/sessions/revoke-others",
      headers: { ...headers, origin: "https://cobranzaap.tech" },
    });
    expect(others.statusCode).toBe(200);
    expect(others.json()).toEqual({ revoked: 2 });
    expect(deps.authService.revokeOtherSessions).toHaveBeenCalledWith(
      developer.id,
      "session-token",
      expect.any(String),
    );
  });

  it("returns only the authenticated user's security activity", async () => {
    const deps = dependencies();
    const app = buildApp(deps);
    apps.push(app);
    const response = await app.inject({
      method: "GET",
      url: "/v1/auth/security-activity",
      headers: { cookie: "cobranzapp_session=session-token" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      activity: [{ action: "auth.login_succeeded" }],
    });
    expect(deps.authService.listSecurityActivity).toHaveBeenCalledWith(developer.id);
  });

  it("audits logout and password changes with the request correlation id", async () => {
    const deps = dependencies();
    const app = buildApp(deps);
    apps.push(app);
    const headers = {
      cookie: "cobranzapp_session=session-token",
      origin: "https://cobranzaap.tech",
    };
    const changed = await app.inject({
      method: "POST",
      url: "/v1/auth/change-password",
      headers,
      payload: {
        currentPassword: "correct-password",
        newPassword: "new-secure-password-123",
        confirmation: "new-secure-password-123",
      },
    });
    expect(changed.statusCode).toBe(200);
    expect(deps.authService.changePassword).toHaveBeenCalledWith(
      developer.id,
      "correct-password",
      "new-secure-password-123",
      expect.any(String),
    );
    expect(changed.headers["set-cookie"]).toContain("Max-Age=0");

    const loggedOut = await app.inject({
      method: "POST",
      url: "/v1/auth/logout",
      headers,
    });
    expect(loggedOut.statusCode).toBe(204);
    expect(deps.authService.logout).toHaveBeenCalledWith("session-token", expect.any(String));
  });
});

describe("developer platform", () => {
  it("reports a sanitized system status only to the developer", async () => {
    const app = buildApp(dependencies());
    apps.push(app);
    const response = await app.inject({
      method: "GET",
      url: "/v1/platform/system-status",
      headers: { cookie: "cobranzapp_session=session-token" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      api: { status: "operational", version: "test" },
      database: {
        status: "operational",
        schemaVersion: "0012_inactive_organization_scope.sql",
      },
      jobs: {
        status: "operational",
        due: 0,
        scheduled: 1,
        processing: 0,
        dead: 0,
        expiredLeases: 0,
        oldestDueAt: null,
      },
      checkedAt: "2026-10-11T00:00:00.000Z",
    });
  });

  it("denies system status to a tenant user", async () => {
    const app = buildApp(
      dependencies({ authService: { authenticate: vi.fn(async () => tenantOwner) } }),
    );
    apps.push(app);
    const response = await app.inject({
      method: "GET",
      url: "/v1/platform/system-status",
      headers: { cookie: "cobranzapp_session=session-token" },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: { code: "DEVELOPER_REQUIRED" } });
  });

  it("returns the overview for an authenticated developer", async () => {
    const app = buildApp(dependencies());
    apps.push(app);
    const response = await app.inject({
      method: "GET",
      url: "/v1/platform/overview",
      headers: { cookie: "cobranzapp_session=session-token" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ metrics: { users: 1 }, tenants: [] });
  });

  it("filters and paginates the tenant directory for the developer", async () => {
    const deps = dependencies();
    const app = buildApp(deps);
    apps.push(app);
    const response = await app.inject({
      method: "GET",
      url: "/v1/platform/tenants?q=Acme&status=active&page=2&pageSize=10",
      headers: { cookie: "cobranzapp_session=session-token" },
    });
    expect(response.statusCode).toBe(200);
    expect(deps.platformService.listTenants).toHaveBeenCalledWith(developer.id, {
      search: "Acme",
      status: "active",
      page: 2,
      pageSize: 10,
    });
    expect(response.json()).toEqual({
      tenants: [],
      pagination: { page: 2, pageSize: 10, total: 0, totalPages: 1 },
    });
  });

  it("rejects invalid tenant directory filters", async () => {
    const deps = dependencies();
    const app = buildApp(deps);
    apps.push(app);
    const response = await app.inject({
      method: "GET",
      url: "/v1/platform/tenants?status=unknown&page=0",
      headers: { cookie: "cobranzapp_session=session-token" },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: "INVALID_TENANT_FILTERS" } });
    expect(deps.platformService.listTenants).not.toHaveBeenCalled();
  });

  it("denies the tenant directory to tenant users", async () => {
    const deps = dependencies({ authService: { authenticate: vi.fn(async () => tenantOwner) } });
    const app = buildApp(deps);
    apps.push(app);
    const response = await app.inject({
      method: "GET",
      url: "/v1/platform/tenants",
      headers: { cookie: "cobranzapp_session=session-token" },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: { code: "DEVELOPER_REQUIRED" } });
    expect(deps.platformService.listTenants).not.toHaveBeenCalled();
  });

  it("filters and paginates the user directory for the developer", async () => {
    const deps = dependencies();
    const app = buildApp(deps);
    apps.push(app);
    const response = await app.inject({
      method: "GET",
      url: "/v1/platform/users?q=ana&status=active&page=3&pageSize=10",
      headers: { cookie: "cobranzapp_session=session-token" },
    });
    expect(response.statusCode).toBe(200);
    expect(deps.platformService.listUsers).toHaveBeenCalledWith(developer.id, {
      search: "ana",
      status: "active",
      page: 3,
      pageSize: 10,
    });
  });

  it("disables a user and revokes sessions after recent reauthentication", async () => {
    const deps = dependencies();
    const app = buildApp(deps);
    apps.push(app);
    const userId = "164bf50a-2098-4acc-a250-6ad21df83e40";
    const response = await app.inject({
      method: "PATCH",
      url: `/v1/platform/users/${userId}/status`,
      headers: {
        cookie: "cobranzapp_session=session-token",
        origin: "https://cobranzaap.tech",
      },
      payload: { status: "disabled" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "disabled", revokedSessions: 1 });
    expect(deps.platformService.updateUserStatus).toHaveBeenCalledWith(
      developer.id,
      userId,
      "disabled",
      expect.any(String),
    );
  });

  it("does not let the general directory disable a protected developer account", async () => {
    const deps = dependencies();
    vi.mocked(deps.platformService.updateUserStatus).mockResolvedValue({ status: "protected" });
    const app = buildApp(deps);
    apps.push(app);
    const response = await app.inject({
      method: "PATCH",
      url: `/v1/platform/users/${developer.id}/status`,
      headers: {
        cookie: "cobranzapp_session=session-token",
        origin: "https://cobranzaap.tech",
      },
      payload: { status: "disabled" },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: { code: "USER_PROTECTED" } });
  });

  it("creates a draft tenant", async () => {
    const app = buildApp(dependencies());
    apps.push(app);
    const response = await app.inject({
      method: "POST",
      url: "/v1/platform/tenants",
      headers: {
        cookie: "cobranzapp_session=session-token",
        origin: "https://cobranzaap.tech",
      },
      payload: { displayName: "Empresa Uno", slug: "empresa-uno", membershipPlan: "pro" },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      tenant: { slug: "empresa-uno", status: "draft", membershipPlan: "pro" },
    });
  });

  it("updates the commercial plan with recent reauthentication", async () => {
    const deps = dependencies();
    const app = buildApp(deps);
    apps.push(app);
    const response = await app.inject({
      method: "PATCH",
      url: "/v1/platform/tenants/5c58269f-ce16-4250-82e2-c0c16621b0fb/membership-plan",
      headers: {
        cookie: "cobranzapp_session=session-token",
        origin: "https://cobranzaap.tech",
      },
      payload: { membershipPlan: "ultra" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      membershipPlan: "ultra",
      membershipEntitlement: { employeeSeatLimit: 50, clientLimit: 200 },
    });
    expect(deps.platformService.updateMembershipPlan).toHaveBeenCalledWith(
      developer.id,
      "5c58269f-ce16-4250-82e2-c0c16621b0fb",
      "ultra",
      expect.any(String),
    );
  });

  it("updates purchased employee capacity with recent reauthentication", async () => {
    const deps = dependencies();
    const app = buildApp(deps);
    apps.push(app);
    const response = await app.inject({
      method: "PATCH",
      url: "/v1/platform/tenants/5c58269f-ce16-4250-82e2-c0c16621b0fb/membership-entitlement",
      headers: {
        cookie: "cobranzapp_session=session-token",
        origin: "https://cobranzaap.tech",
      },
      payload: { additionalEmployeeSeats: 3 },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      membershipEntitlement: { additionalEmployeeSeats: 3, employeeSeatLimit: 8, version: 2 },
    });
    expect(deps.platformService.updateMembershipEntitlement).toHaveBeenCalledWith(
      developer.id,
      "5c58269f-ce16-4250-82e2-c0c16621b0fb",
      3,
      expect.any(String),
    );
  });

  it("rejects capacity reductions below active employee use", async () => {
    const deps = dependencies();
    vi.mocked(deps.platformService.updateMembershipEntitlement).mockResolvedValue({
      status: "seat_limit_conflict",
      activeEmployeeSeats: 7,
      employeeSeatLimit: 5,
    });
    const app = buildApp(deps);
    apps.push(app);
    const response = await app.inject({
      method: "PATCH",
      url: "/v1/platform/tenants/5c58269f-ce16-4250-82e2-c0c16621b0fb/membership-entitlement",
      headers: {
        cookie: "cobranzapp_session=session-token",
        origin: "https://cobranzaap.tech",
      },
      payload: { additionalEmployeeSeats: 0 },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: { code: "EMPLOYEE_SEAT_LIMIT_CONFLICT" } });
  });

  it("rejects invalid commercial plans", async () => {
    const deps = dependencies();
    const app = buildApp(deps);
    apps.push(app);
    const response = await app.inject({
      method: "PATCH",
      url: "/v1/platform/tenants/5c58269f-ce16-4250-82e2-c0c16621b0fb/membership-plan",
      headers: {
        cookie: "cobranzapp_session=session-token",
        origin: "https://cobranzaap.tech",
      },
      payload: { membershipPlan: "enterprise" },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: "INVALID_MEMBERSHIP_PLAN" } });
    expect(deps.platformService.updateMembershipPlan).not.toHaveBeenCalled();
  });

  it("creates a tenant invitation for the developer", async () => {
    const app = buildApp(dependencies());
    apps.push(app);
    const response = await app.inject({
      method: "POST",
      url: "/v1/platform/tenants/5c58269f-ce16-4250-82e2-c0c16621b0fb/invitations",
      headers: {
        cookie: "cobranzapp_session=session-token",
        origin: "https://cobranzaap.tech",
      },
      payload: { email: "owner@example.com", role: "owner" },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ invitation: { role: "owner" } });
  });

  it("changes a tenant operational status", async () => {
    const deps = dependencies();
    const app = buildApp(deps);
    apps.push(app);
    const response = await app.inject({
      method: "PATCH",
      url: "/v1/platform/tenants/5c58269f-ce16-4250-82e2-c0c16621b0fb/status",
      headers: {
        cookie: "cobranzapp_session=session-token",
        origin: "https://cobranzaap.tech",
      },
      payload: { status: "active" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ tenant: { status: "active" } });
    expect(deps.platformService.updateTenantStatus).toHaveBeenCalledWith(
      developer.id,
      "5c58269f-ce16-4250-82e2-c0c16621b0fb",
      "active",
      expect.any(String),
    );
  });

  it("requires recent password confirmation for a sensitive platform action", async () => {
    const deps = dependencies({
      authService: { isRecentlyReauthenticated: vi.fn(async () => false) },
    });
    const app = buildApp(deps);
    apps.push(app);
    const response = await app.inject({
      method: "PATCH",
      url: "/v1/platform/tenants/5c58269f-ce16-4250-82e2-c0c16621b0fb/status",
      headers: {
        cookie: "cobranzapp_session=session-token",
        origin: "https://cobranzaap.tech",
      },
      payload: { status: "active" },
    });
    expect(response.statusCode).toBe(428);
    expect(response.json()).toMatchObject({
      error: { code: "REAUTHENTICATION_REQUIRED" },
    });
    expect(deps.platformService.updateTenantStatus).not.toHaveBeenCalled();
  });
});

describe("temporary support access", () => {
  const tenantId = "5c58269f-ce16-4250-82e2-c0c16621b0fb";

  it("lets a developer request time-limited access", async () => {
    const deps = dependencies();
    const app = buildApp(deps);
    apps.push(app);
    const response = await app.inject({
      method: "POST",
      url: `/v1/platform/tenants/${tenantId}/support-access`,
      headers: {
        cookie: "cobranzapp_session=session-token",
        origin: "https://cobranzaap.tech",
      },
      payload: {
        purpose: "Revisar la configuración de la empresa",
        durationMinutes: 60,
      },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ access: { status: "pending" } });
    expect(deps.supportAccessService.requestAccess).toHaveBeenCalledWith(
      developer.id,
      tenantId,
      expect.objectContaining({ durationMinutes: 60 }),
    );
  });

  it("denies the support overview without an active approval", async () => {
    const deps = dependencies({
      supportAccessService: { findActiveAccess: vi.fn(async () => null) },
    });
    const app = buildApp(deps);
    apps.push(app);
    const response = await app.inject({
      method: "GET",
      url: `/v1/platform/tenants/${tenantId}/support-overview`,
      headers: { cookie: "cobranzapp_session=session-token" },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: { code: "SUPPORT_ACCESS_REQUIRED" } });
    expect(deps.tenancyService.overview).not.toHaveBeenCalled();
  });

  it("opens a read-only overview with a current approval", async () => {
    const deps = dependencies();
    const app = buildApp(deps);
    apps.push(app);
    const response = await app.inject({
      method: "GET",
      url: `/v1/platform/tenants/${tenantId}/support-overview`,
      headers: { cookie: "cobranzapp_session=session-token" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      access: { status: "active" },
      overview: { actorRole: "owner" },
    });
    expect(deps.tenancyService.overview).toHaveBeenCalledWith(
      expect.objectContaining({
        platformRole: "developer",
        tenantRole: null,
        supportAccessId: supportAccessRecord.id,
      }),
      tenantId,
    );
  });

  it("lets the tenant owner approve a pending request", async () => {
    const deps = dependencies({ authService: { authenticate: vi.fn(async () => tenantOwner) } });
    const app = buildApp(deps);
    apps.push(app);
    const response = await app.inject({
      method: "PATCH",
      url: `/v1/tenants/${tenantId}/support-access/${supportAccessRecord.id}`,
      headers: {
        cookie: "cobranzapp_session=session-token",
        origin: "https://cobranzaap.tech",
      },
      payload: { action: "approve" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ access: { status: "active" } });
    expect(deps.supportAccessService.reviewAccess).toHaveBeenCalledWith(
      expect.objectContaining({ tenantRole: "owner" }),
      tenantId,
      supportAccessRecord.id,
      "approve",
      expect.any(String),
    );
  });
});

describe("tenant onboarding", () => {
  it("previews and accepts a valid invitation", async () => {
    const app = buildApp(dependencies());
    apps.push(app);
    const token = "valid-invitation-token-abcdefghijklmnopqrstuvwxyz";
    const preview = await app.inject({ method: "GET", url: `/v1/invitations/${token}` });
    expect(preview.statusCode).toBe(200);
    expect(preview.json()).toMatchObject({ invitation: { tenantSlug: "empresa-uno" } });

    const acceptance = await app.inject({
      method: "POST",
      url: `/v1/invitations/${token}/accept`,
      headers: { origin: "https://cobranzaap.tech" },
      payload: {
        username: "nuevo.propietario",
        displayName: "Nuevo Propietario",
        password: "new-owner-password",
      },
    });
    expect(acceptance.statusCode).toBe(200);
    expect(acceptance.json()).toEqual({ tenantSlug: "empresa-uno" });
  });

  it("keeps an employee invitation pending when no seat is available", async () => {
    const deps = dependencies();
    vi.mocked(deps.tenancyService.acceptInvitation).mockResolvedValue({
      status: "seat_limit_reached",
      employeeSeatLimit: 5,
    });
    const app = buildApp(deps);
    apps.push(app);
    const response = await app.inject({
      method: "POST",
      url: "/v1/invitations/valid-invitation-token-abcdefghijklmnopqrstuvwxyz/accept",
      headers: { origin: "https://cobranzaap.tech" },
      payload: {
        username: "nuevo.cobrador",
        displayName: "Nuevo Cobrador",
        password: "new-collector-password",
      },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: { code: "EMPLOYEE_SEAT_LIMIT_REACHED" } });
  });

  it("lets an owner configure the workspace, branches and teams", async () => {
    const deps = dependencies({ authService: { authenticate: vi.fn(async () => tenantOwner) } });
    const app = buildApp(deps);
    apps.push(app);
    const headers = {
      cookie: "cobranzapp_session=session-token",
      origin: "https://cobranzaap.tech",
    };
    const tenantId = tenantOwner.memberships[0]?.tenantId;

    const settings = await app.inject({
      method: "PATCH",
      url: `/v1/tenants/${tenantId}/settings`,
      headers,
      payload: {
        primaryColor: "#171717",
        accentColor: "#FBBF24",
        contactEmail: "operaciones@example.com",
        contactPhone: "+57 300 123 4567",
        address: "Carrera 10 # 20-30, Bogotá",
        version: 1,
      },
    });
    expect(settings.statusCode).toBe(200);
    expect(settings.json()).toMatchObject({ settings: { version: 2 } });

    const branch = await app.inject({
      method: "POST",
      url: `/v1/tenants/${tenantId}/branches`,
      headers,
      payload: { code: "centro", displayName: "Sede Centro" },
    });
    expect(branch.statusCode).toBe(201);
    expect(branch.json()).toMatchObject({ branch: { code: "centro" } });

    const team = await app.inject({
      method: "POST",
      url: `/v1/tenants/${tenantId}/teams`,
      headers,
      payload: {
        branchId: "9ec06ada-07c8-42ba-b1f8-af0fc43c75e4",
        displayName: "Ruta Centro",
      },
    });
    expect(team.statusCode).toBe(201);
    expect(team.json()).toMatchObject({ team: { displayName: "Ruta Centro" } });

    const teamStatus = await app.inject({
      method: "PATCH",
      url: `/v1/tenants/${tenantId}/teams/4ffec9ec-1e7a-4a25-93f7-6b57776ce8af/status`,
      headers,
      payload: { status: "inactive" },
    });
    expect(teamStatus.statusCode).toBe(200);
    expect(teamStatus.json()).toEqual({ status: "inactive" });

    const branchStatus = await app.inject({
      method: "PATCH",
      url: `/v1/tenants/${tenantId}/branches/9ec06ada-07c8-42ba-b1f8-af0fc43c75e4/status`,
      headers,
      payload: { status: "inactive" },
    });
    expect(branchStatus.statusCode).toBe(200);
    expect(branchStatus.json()).toEqual({ status: "inactive" });

    const userId = "7727df33-e22e-4b17-9b4a-0e27f84b3da1";
    const teamId = "4ffec9ec-1e7a-4a25-93f7-6b57776ce8af";
    const assigned = await app.inject({
      method: "PUT",
      url: `/v1/tenants/${tenantId}/teams/${teamId}/members/${userId}`,
      headers,
    });
    expect(assigned.statusCode).toBe(200);
    expect(deps.tenancyService.addTeamMember).toHaveBeenCalledWith(
      expect.objectContaining({ tenantRole: "owner" }),
      tenantId,
      teamId,
      userId,
      expect.any(String),
    );

    const removed = await app.inject({
      method: "DELETE",
      url: `/v1/tenants/${tenantId}/teams/${teamId}/members/${userId}`,
      headers,
    });
    expect(removed.statusCode).toBe(204);
    expect(deps.tenancyService.removeTeamMember).toHaveBeenCalledWith(
      expect.objectContaining({ tenantRole: "owner" }),
      tenantId,
      teamId,
      userId,
      expect.any(String),
    );
  });

  it("blocks a branch deactivation while it still has active teams", async () => {
    const deps = dependencies({ authService: { authenticate: vi.fn(async () => tenantOwner) } });
    vi.mocked(deps.tenancyService.updateBranchStatus).mockResolvedValue({
      status: "has_active_teams",
    });
    const app = buildApp(deps);
    apps.push(app);
    const tenantId = tenantOwner.memberships[0]?.tenantId;
    const response = await app.inject({
      method: "PATCH",
      url: `/v1/tenants/${tenantId}/branches/9ec06ada-07c8-42ba-b1f8-af0fc43c75e4/status`,
      headers: {
        cookie: "cobranzapp_session=session-token",
        origin: "https://cobranzaap.tech",
      },
      payload: { status: "inactive" },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: { code: "BRANCH_HAS_ACTIVE_TEAMS" } });
  });

  it("lets an owner change a non-owner membership", async () => {
    const deps = dependencies({ authService: { authenticate: vi.fn(async () => tenantOwner) } });
    const app = buildApp(deps);
    apps.push(app);
    const tenantId = tenantOwner.memberships[0]?.tenantId;
    const userId = "7727df33-e22e-4b17-9b4a-0e27f84b3da1";
    const response = await app.inject({
      method: "PATCH",
      url: `/v1/tenants/${tenantId}/members/${userId}`,
      headers: {
        cookie: "cobranzapp_session=session-token",
        origin: "https://cobranzaap.tech",
      },
      payload: { role: "collector", status: "suspended" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      member: { userId, role: "collector", status: "suspended" },
    });
    expect(deps.tenancyService.updateMember).toHaveBeenCalledWith(
      expect.objectContaining({ tenantRole: "owner" }),
      tenantId,
      userId,
      expect.objectContaining({ role: "collector", status: "suspended" }),
    );
  });

  it("prevents an owner from activating an employee above capacity", async () => {
    const deps = dependencies({ authService: { authenticate: vi.fn(async () => tenantOwner) } });
    vi.mocked(deps.tenancyService.updateMember).mockResolvedValue({
      status: "seat_limit_reached",
      employeeSeatLimit: 5,
    });
    const app = buildApp(deps);
    apps.push(app);
    const tenantId = tenantOwner.memberships[0]?.tenantId;
    const response = await app.inject({
      method: "PATCH",
      url: `/v1/tenants/${tenantId}/members/7727df33-e22e-4b17-9b4a-0e27f84b3da1`,
      headers: {
        cookie: "cobranzapp_session=session-token",
        origin: "https://cobranzaap.tech",
      },
      payload: { role: "collector", status: "active" },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: { code: "EMPLOYEE_SEAT_LIMIT_REACHED" } });
  });

  it("lets an owner revoke a pending non-owner invitation", async () => {
    const deps = dependencies({ authService: { authenticate: vi.fn(async () => tenantOwner) } });
    const app = buildApp(deps);
    apps.push(app);
    const tenantId = tenantOwner.memberships[0]?.tenantId;
    const invitationId = "ac08c04c-1026-4700-975c-38844928f89c";
    const response = await app.inject({
      method: "DELETE",
      url: `/v1/tenants/${tenantId}/invitations/${invitationId}`,
      headers: {
        cookie: "cobranzapp_session=session-token",
        origin: "https://cobranzaap.tech",
      },
    });
    expect(response.statusCode).toBe(204);
    expect(deps.tenancyService.revokeInvitation).toHaveBeenCalledWith(
      expect.objectContaining({ tenantRole: "owner" }),
      tenantId,
      invitationId,
      expect.any(String),
    );
  });

  it("keeps owner invitations protected behind platform administration", async () => {
    const deps = dependencies({ authService: { authenticate: vi.fn(async () => tenantOwner) } });
    vi.mocked(deps.tenancyService.revokeInvitation).mockResolvedValue({ status: "protected" });
    const app = buildApp(deps);
    apps.push(app);
    const tenantId = tenantOwner.memberships[0]?.tenantId;
    const response = await app.inject({
      method: "DELETE",
      url: `/v1/tenants/${tenantId}/invitations/ac08c04c-1026-4700-975c-38844928f89c`,
      headers: {
        cookie: "cobranzapp_session=session-token",
        origin: "https://cobranzaap.tech",
      },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      error: { code: "PLATFORM_APPROVAL_REQUIRED" },
    });
  });
});
