import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "./app.js";
import type { AuthenticatedUser, AuthService } from "./auth/types.js";
import type { PlatformService } from "./platform/types.js";
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

function dependencies(overrides?: { authService?: Partial<AuthService> }) {
  const authService: AuthService = {
    login: vi.fn(async () => ({ token: "session-token", user: developer })),
    authenticate: vi.fn(async () => developer),
    logout: vi.fn(async () => undefined),
    changePassword: vi.fn(async () => true),
    ...overrides?.authService,
  };
  const platformService: PlatformService = {
    overview: vi.fn(async () => ({
      metrics: { tenants: 0, activeTenants: 0, users: 1, activeMemberships: 0 },
      tenants: [],
    })),
    createTenant: vi.fn(async (_actor, input) => ({
      id: "5c58269f-ce16-4250-82e2-c0c16621b0fb",
      displayName: input.displayName,
      slug: input.slug,
      status: "draft",
      members: 0,
      createdAt: "2026-10-11T00:00:00.000Z",
    })),
    updateTenantStatus: vi.fn(async (_actor, tenantId, status) => ({
      status: "updated",
      tenant: {
        id: tenantId,
        displayName: "Empresa Uno",
        slug: "empresa-uno",
        status,
        members: 1,
        createdAt: "2026-10-11T00:00:00.000Z",
      },
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
    overview: vi.fn(async () => ({
      tenant: {
        id: "5c58269f-ce16-4250-82e2-c0c16621b0fb",
        slug: "empresa-uno",
        displayName: "Empresa Uno",
        status: "draft",
        locale: "es-CO",
        timezone: "America/Bogota",
        currency: "COP",
      },
      actorRole: "owner",
      metrics: { members: 1, branches: 0, teams: 0, pendingInvitations: 0 },
      settings: {
        primaryColor: "#171717",
        accentColor: "#FBBF24",
        contactEmail: null,
        contactPhone: null,
        address: null,
        version: 1,
      },
      members: [],
      branches: [],
      teams: [],
      pendingInvitations: [],
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
    })),
  };
  return {
    allowedWebOrigins: ["https://cobranzaap.tech"],
    authService,
    checkDatabase: async () => undefined,
    isProduction: true,
    platformService,
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
      expect.any(Object),
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
});

describe("developer platform", () => {
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
      payload: { displayName: "Empresa Uno", slug: "empresa-uno" },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ tenant: { slug: "empresa-uno", status: "draft" } });
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
  });
});
