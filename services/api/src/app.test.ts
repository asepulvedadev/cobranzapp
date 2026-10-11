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
      metrics: { members: 1, branches: 0, pendingInvitations: 0 },
      members: [],
      branches: [],
      pendingInvitations: [],
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
});
