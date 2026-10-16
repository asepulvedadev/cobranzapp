import type { LoanAnalytics, LoanProduct, Route } from "@cobranzapp/contracts";
import type { IdentityExtractor } from "@cobranzapp/hermes-ocr";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "./app.js";
import type { AuthenticatedUser, AuthService } from "./auth/types.js";
import type { BorrowerService } from "./borrowers/types.js";
import type { CreditService } from "./credit/types.js";
import type { PlatformService } from "./platform/types.js";
import type { RouteService } from "./routes/types.js";
import type { SupportAccessRecord, SupportAccessService } from "./support-access/types.js";
import type { TenancyService } from "./tenancy/types.js";

const developer: AuthenticatedUser = {
  id: "8a44ba60-9500-4dd0-85b8-d428194165f2",
  username: "desarrollador",
  email: "dev@example.com",
  displayName: "Desarrollador",
  platformRole: "developer",
  mustChangePassword: true,
  mfaEnabled: false,
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
  mfaEnabled: false,
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
  borrowerService?: BorrowerService;
  creditService?: CreditService;
  routeService?: RouteService;
  supportAccessService?: Partial<SupportAccessService>;
  identityExtractor?: IdentityExtractor;
}) {
  const authService: AuthService = {
    login: vi.fn(async () => ({
      status: "authenticated",
      token: "session-token",
      user: developer,
    })),
    verifyMfaChallenge: vi.fn(async () => ({
      status: "authenticated",
      token: "mfa-session-token",
      user: { ...developer, mfaEnabled: true },
    })),
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
    getMfaStatus: vi.fn(async () => ({
      enabled: false,
      setupPending: false,
      setupExpiresAt: null,
    })),
    beginMfaEnrollment: vi.fn(async () => ({
      status: "created",
      secret: "JBSWY3DPEHPK3PXP",
      uri: "otpauth://totp/cobranzapp:test",
      expiresAt: "2026-10-11T00:10:00.000Z",
    })),
    confirmMfaEnrollment: vi.fn(async () => ({
      status: "enabled",
      recoveryCodes: ["ABCDE-ABCDE-ABCDE-ABCDE"],
      revokedSessions: 1,
    })),
    disableMfa: vi.fn(async () => ({ status: "disabled", revokedSessions: 1 })),
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
    getOwnerSubscriptionSummary: vi.fn(async () => ({
      availableCount: 2,
      availableSubscriptions: [
        { membershipPlan: "pro" as const, activatedAt: "2026-10-11T00:00:00.000Z" },
        { membershipPlan: "ultra" as const, activatedAt: "2026-10-11T01:00:00.000Z" },
      ],
    })),
    listActivity: vi.fn(async (_actor, query) => ({
      activity: [
        {
          id: "f9563417-c0c1-4c8e-8470-61d288680561",
          action: "tenant.created",
          actorDisplayName: "Desarrollador",
          actorUsername: "desarrollador",
          tenantId: "5c58269f-ce16-4250-82e2-c0c16621b0fb",
          tenantName: "Empresa Uno",
          happenedAt: "2026-10-11T00:00:00.000Z",
        },
      ],
      availableActions: ["tenant.created", "tenant.status_changed"],
      pagination: { page: query.page, pageSize: query.pageSize, total: 1, totalPages: 1 },
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
    createTenantForOwner: vi.fn(async (_actor, input) => ({
      status: "created" as const,
      tenantId: "f1d80b2d-c1d8-4b30-9f02-12f4e1f7c8b6",
      tenantName: input.displayName,
      tenantSlug: "empresa-nueva",
      role: "owner" as const,
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
    updateUserMembership: vi.fn(async (_actor, _userId, input) => ({
      status: "updated" as const,
      membershipPlan: input.membershipPlan,
      activatedAt: "2026-10-11T02:00:00.000Z",
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
    borrowerService: overrides?.borrowerService,
    identityExtractor: overrides?.identityExtractor,
    creditService: overrides?.creditService,
    routeService: overrides?.routeService,
    checkDatabase: async () => undefined,
    isProduction: true,
    platformService,
    supportAccessService,
    tenancyService,
    version: "test",
  };
}

function multipartImage(field: string, bytes: Buffer, boundary = "cobranzapp-test-boundary") {
  return {
    boundary,
    payload: Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${field}"; filename="cedula.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`,
      ),
      bytes,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]),
  };
}

describe("collection route status", () => {
  it("activates a route through the owner-only status endpoint", async () => {
    const route: Route = {
      id: "f9a9ef72-e2d6-44c6-8d89-30d7e1f9b9c8",
      name: "Ruta Centro",
      description: null,
      status: "active",
      branchId: null,
      branchName: null,
      assignedCollectorId: null,
      assignedCollectorName: null,
      stops: [
        {
          id: "193a2db4-2349-4a48-8833-746a2a334260",
          borrowerId: "56d33f0e-b1a8-4a55-9061-2ccf283ce0f5",
          borrowerName: "Cliente de prueba",
          addressKind: "home",
          address: "Calle 1 # 2-3",
          position: 1,
        },
      ],
      createdAt: "2026-10-11T00:00:00.000Z",
      updatedAt: "2026-10-11T00:01:00.000Z",
    };
    const updateStatus = vi.fn(async () => ({ status: "updated" as const, route }));
    const routeService: RouteService = {
      list: vi.fn(async () => []),
      create: vi.fn(),
      addStop: vi.fn(),
      updateStatus,
      assignCollector: vi.fn(),
    };
    const app = buildApp(
      dependencies({
        authService: { authenticate: vi.fn(async () => tenantOwner) },
        routeService,
      }),
    );
    apps.push(app);
    const response = await app.inject({
      method: "PATCH",
      url: "/v1/tenants/5c58269f-ce16-4250-82e2-c0c16621b0fb/routes/f9a9ef72-e2d6-44c6-8d89-30d7e1f9b9c8",
      headers: {
        origin: "https://cobranzaap.tech",
        cookie: "cobranzapp_session=session-token",
      },
      payload: { status: "active" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ route });
    expect(updateStatus).toHaveBeenCalledWith(
      {
        userId: tenantOwner.id,
        platformRole: null,
        tenantRole: "owner",
      },
      "5c58269f-ce16-4250-82e2-c0c16621b0fb",
      "f9a9ef72-e2d6-44c6-8d89-30d7e1f9b9c8",
      { status: "active", requestId: expect.any(String) },
    );
  });

  it("assigns a route to a collector through the manager endpoint", async () => {
    const route: Route = {
      id: "f9a9ef72-e2d6-44c6-8d89-30d7e1f9b9c8",
      name: "Ruta Centro",
      description: null,
      status: "active",
      branchId: null,
      branchName: null,
      assignedCollectorId: "193a2db4-2349-4a48-8833-746a2a334260",
      assignedCollectorName: "Cobrador de prueba",
      stops: [],
      createdAt: "2026-10-11T00:00:00.000Z",
      updatedAt: "2026-10-11T00:01:00.000Z",
    };
    const assignCollector = vi.fn(async () => ({ status: "updated" as const, route }));
    const routeService: RouteService = {
      list: vi.fn(async () => []),
      create: vi.fn(),
      addStop: vi.fn(),
      updateStatus: vi.fn(),
      assignCollector,
    };
    const app = buildApp(
      dependencies({
        authService: { authenticate: vi.fn(async () => tenantOwner) },
        routeService,
      }),
    );
    apps.push(app);
    const response = await app.inject({
      method: "PATCH",
      url: "/v1/tenants/5c58269f-ce16-4250-82e2-c0c16621b0fb/routes/f9a9ef72-e2d6-44c6-8d89-30d7e1f9b9c8/assignment",
      headers: {
        origin: "https://cobranzaap.tech",
        cookie: "cobranzapp_session=session-token",
      },
      payload: { collectorId: "193a2db4-2349-4a48-8833-746a2a334260" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ route });
    expect(assignCollector).toHaveBeenCalledWith(
      {
        userId: tenantOwner.id,
        platformRole: null,
        tenantRole: "owner",
      },
      "5c58269f-ce16-4250-82e2-c0c16621b0fb",
      "f9a9ef72-e2d6-44c6-8d89-30d7e1f9b9c8",
      {
        collectorId: "193a2db4-2349-4a48-8833-746a2a334260",
        requestId: expect.any(String),
      },
    );
  });
});

describe("borrower creation security", () => {
  it("uses Hermes to extract all identity fields before creating the borrower", async () => {
    const extraction = {
      fields: {
        firstNames: "ANA MARIA",
        lastNames: "PEREZ LOPEZ",
        fullName: "ANA MARIA PEREZ LOPEZ",
        documentNumber: "1234567890",
        documentType: "CC" as const,
        country: "CO" as const,
        nationality: "COL",
        birthDate: "1990-01-02",
        birthPlace: "BOGOTA",
        sex: "F",
        height: "1.65",
        bloodType: "O+",
        issueDate: "2010-03-04",
        issuePlace: "BOGOTA",
        expirationDate: "2030-03-04",
        serialNumber: "A123",
        mrzLines: ["ICCOL1234567890<<<<<<<<<<<<"],
        barcodeData: null,
      },
      confidence: 0.97,
      warnings: [],
      sources: { front: true, back: false },
    };
    const extract = vi.fn(async () => extraction);
    const app = buildApp(
      dependencies({
        authService: { authenticate: vi.fn(async () => tenantOwner) },
        identityExtractor: { extract },
      }),
    );
    apps.push(app);
    const multipart = multipartImage("front", Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01]));
    const response = await app.inject({
      method: "POST",
      url: "/v1/tenants/5c58269f-ce16-4250-82e2-c0c16621b0fb/borrowers/identity-extract",
      headers: {
        origin: "https://cobranzaap.tech",
        cookie: "cobranzapp_session=session-token",
        "content-type": `multipart/form-data; boundary=${multipart.boundary}`,
      },
      payload: multipart.payload,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ extraction });
    expect(extract).toHaveBeenCalledWith({
      front: expect.objectContaining({ mediaType: "image/jpeg", side: "front" }),
    });
  });

  it("requires recent reauthentication before creating a dossier", async () => {
    const create = vi.fn();
    const app = buildApp(
      dependencies({
        authService: {
          authenticate: vi.fn(async () => tenantOwner),
          isRecentlyReauthenticated: vi.fn(async () => false),
        },
        borrowerService: { create } as unknown as BorrowerService,
      }),
    );
    apps.push(app);
    const response = await app.inject({
      method: "POST",
      url: "/v1/tenants/5c58269f-ce16-4250-82e2-c0c16621b0fb/borrowers",
      headers: {
        origin: "https://cobranzaap.tech",
        cookie: "cobranzapp_session=session-token",
      },
      payload: {
        fullName: "Cliente de prueba",
        country: "CO",
        documentType: "CC",
        documentNumber: "1234567890",
        phone: "3000000000",
        homeAddress: "Calle 1 # 2-3",
        workAddress: "Carrera 4 # 5-6",
        homeAddressConfirmed: true,
        workAddressConfirmed: true,
        profilePhotoObjectKey: null,
        consentVersion: "borrower-dossier-v1",
        consentEvidenceRef: "test-consent",
        emergencyContacts: [
          { fullName: "Contacto Uno", relationship: "Familiar", phone: "3110000000" },
        ],
        documents: [],
      },
    });
    expect(response.statusCode).toBe(428);
    expect(response.json()).toMatchObject({ error: { code: "REAUTHENTICATION_REQUIRED" } });
    expect(create).not.toHaveBeenCalled();
  });

  it("keeps the address confirmation invariant at the HTTP boundary", async () => {
    const app = buildApp(
      dependencies({
        authService: {
          authenticate: vi.fn(async () => tenantOwner),
          isRecentlyReauthenticated: vi.fn(async () => true),
        },
        borrowerService: {
          create: vi.fn(async () => ({ status: "addresses_unconfirmed" })),
        } as unknown as BorrowerService,
      }),
    );
    apps.push(app);
    const response = await app.inject({
      method: "POST",
      url: "/v1/tenants/5c58269f-ce16-4250-82e2-c0c16621b0fb/borrowers",
      headers: {
        origin: "https://cobranzaap.tech",
        cookie: "cobranzapp_session=session-token",
      },
      payload: {
        fullName: "Cliente de prueba",
        country: "CO",
        documentType: "CC",
        documentNumber: "1234567890",
        phone: "3000000000",
        homeAddress: "Calle 1 # 2-3",
        workAddress: "Carrera 4 # 5-6",
        homeAddressConfirmed: true,
        workAddressConfirmed: true,
        profilePhotoObjectKey: null,
        consentVersion: "borrower-dossier-v1",
        consentEvidenceRef: "test-consent",
        emergencyContacts: [
          { fullName: "Contacto Uno", relationship: "Familiar", phone: "3110000000" },
        ],
        documents: [],
      },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: { code: "BORROWER_ADDRESSES_UNCONFIRMED" },
    });
  });

  it("updates home and work addresses together after reauthentication", async () => {
    const updatedBorrower = {
      id: "193a2db4-2349-4a48-8833-746a2a334260",
      fullName: "Cliente de prueba",
      homeAddress: "Calle 10 # 20-30, Bogotá",
      workAddress: "Carrera 7 # 80-10, Bogotá",
      homeAddressStatus: "confirmed",
      workAddressStatus: "confirmed",
    };
    const updateAddresses = vi.fn(async () => ({
      status: "updated" as const,
      borrower: updatedBorrower,
    }));
    const app = buildApp(
      dependencies({
        authService: { authenticate: vi.fn(async () => tenantOwner) },
        borrowerService: { updateAddresses } as unknown as BorrowerService,
      }),
    );
    apps.push(app);
    const tenantId = tenantOwner.memberships[0]?.tenantId;
    const borrowerId = updatedBorrower.id;
    const response = await app.inject({
      method: "PATCH",
      url: `/v1/tenants/${tenantId}/borrowers/${borrowerId}/addresses`,
      headers: {
        origin: "https://cobranzaap.tech",
        cookie: "cobranzapp_session=session-token",
      },
      payload: {
        homeAddress: "Calle 10 # 20-30, Bogotá",
        workAddress: "Carrera 7 # 80-10, Bogotá",
        homeAddressConfirmed: true,
        workAddressConfirmed: true,
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ borrower: updatedBorrower });
    expect(updateAddresses).toHaveBeenCalledWith(
      { userId: tenantOwner.id, platformRole: null, tenantRole: "owner" },
      tenantId,
      borrowerId,
      expect.objectContaining({
        homeAddress: "Calle 10 # 20-30, Bogotá",
        workAddress: "Carrera 7 # 80-10, Bogotá",
        homeAddressConfirmed: true,
        workAddressConfirmed: true,
        requestId: expect.any(String),
      }),
    );
  });

  it("maps a service-level address confirmation rejection", async () => {
    const updateAddresses = vi.fn(async () => ({ status: "addresses_unconfirmed" as const }));
    const app = buildApp(
      dependencies({
        authService: { authenticate: vi.fn(async () => tenantOwner) },
        borrowerService: { updateAddresses } as unknown as BorrowerService,
      }),
    );
    apps.push(app);
    const response = await app.inject({
      method: "PATCH",
      url: `/v1/tenants/${tenantOwner.memberships[0]?.tenantId}/borrowers/193a2db4-2349-4a48-8833-746a2a334260/addresses`,
      headers: {
        origin: "https://cobranzaap.tech",
        cookie: "cobranzapp_session=session-token",
      },
      payload: {
        homeAddress: "Calle 10 # 20-30, Bogotá",
        workAddress: "Carrera 7 # 80-10, Bogotá",
        homeAddressConfirmed: true,
        workAddressConfirmed: true,
      },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: { code: "BORROWER_ADDRESSES_UNCONFIRMED" },
    });
    expect(updateAddresses).toHaveBeenCalled();
  });

  it("does not geocode an address that has not been confirmed", async () => {
    const geocodeAddress = vi.fn(async () => ({ status: "unconfirmed" as const }));
    const app = buildApp(
      dependencies({
        authService: { authenticate: vi.fn(async () => tenantOwner) },
        borrowerService: { geocodeAddress } as unknown as BorrowerService,
      }),
    );
    apps.push(app);
    const response = await app.inject({
      method: "POST",
      url: `/v1/tenants/${tenantOwner.memberships[0]?.tenantId}/borrowers/193a2db4-2349-4a48-8833-746a2a334260/geocode`,
      headers: {
        origin: "https://cobranzaap.tech",
        cookie: "cobranzapp_session=session-token",
      },
      payload: { addressKind: "home" },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      error: { code: "BORROWER_ADDRESSES_UNCONFIRMED" },
    });
    expect(geocodeAddress).toHaveBeenCalled();
  });

  it("rejects a geocode result when the address changed during lookup", async () => {
    const geocodeAddress = vi.fn(async () => ({ status: "stale" as const }));
    const app = buildApp(
      dependencies({
        authService: { authenticate: vi.fn(async () => tenantOwner) },
        borrowerService: { geocodeAddress } as unknown as BorrowerService,
      }),
    );
    apps.push(app);
    const response = await app.inject({
      method: "POST",
      url: `/v1/tenants/${tenantOwner.memberships[0]?.tenantId}/borrowers/193a2db4-2349-4a48-8833-746a2a334260/geocode`,
      headers: {
        origin: "https://cobranzaap.tech",
        cookie: "cobranzapp_session=session-token",
      },
      payload: { addressKind: "work" },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      error: { code: "BORROWER_ADDRESS_CHANGED" },
    });
  });
});

describe("loan application review queue", () => {
  it("allows an owner to start review after recent reauthentication", async () => {
    const application = {
      id: "f9a9ef72-e2d6-44c6-8d89-30d7e1f9b9c8",
      borrowerId: "193a2db4-2349-4a48-8833-746a2a334260",
      borrowerName: "Cliente de prueba",
      loanProductId: "56d33f0e-b1a8-4a55-9061-2ccf283ce0f5",
      loanProductName: "Capital de trabajo",
      requestedPrincipal: "500000.00",
      requestedTermCount: 4,
      purpose: "Compra de inventario",
      status: "under_review" as const,
      createdAt: "2026-10-11T00:00:00.000Z",
      updatedAt: "2026-10-11T00:01:00.000Z",
    };
    const startApplicationReview = vi.fn(async () => ({
      status: "review_started" as const,
      application,
    }));
    const app = buildApp(
      dependencies({
        authService: { authenticate: vi.fn(async () => tenantOwner) },
        creditService: { startApplicationReview } as unknown as CreditService,
      }),
    );
    apps.push(app);
    const response = await app.inject({
      method: "POST",
      url: "/v1/tenants/5c58269f-ce16-4250-82e2-c0c16621b0fb/loan-applications/f9a9ef72-e2d6-44c6-8d89-30d7e1f9b9c8/review",
      headers: {
        origin: "https://cobranzaap.tech",
        cookie: "cobranzapp_session=session-token",
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ application });
    expect(startApplicationReview).toHaveBeenCalledWith(
      {
        userId: tenantOwner.id,
        platformRole: null,
        tenantRole: "owner",
      },
      "5c58269f-ce16-4250-82e2-c0c16621b0fb",
      "f9a9ef72-e2d6-44c6-8d89-30d7e1f9b9c8",
      expect.any(String),
    );
  });

  it("keeps the review transition restricted to owners and supervisors", async () => {
    const startApplicationReview = vi.fn();
    const collector: AuthenticatedUser = {
      ...tenantOwner,
      id: "8b8f4a23-3207-497f-a4b6-778cb8f4d1d0",
      platformRole: null,
      memberships: [{ ...tenantOwner.memberships[0], role: "collector" }],
    };
    const app = buildApp(
      dependencies({
        authService: { authenticate: vi.fn(async () => collector) },
        creditService: { startApplicationReview } as unknown as CreditService,
      }),
    );
    apps.push(app);
    const response = await app.inject({
      method: "POST",
      url: "/v1/tenants/5c58269f-ce16-4250-82e2-c0c16621b0fb/loan-applications/f9a9ef72-e2d6-44c6-8d89-30d7e1f9b9c8/review",
      headers: {
        origin: "https://cobranzaap.tech",
        cookie: "cobranzapp_session=session-token",
      },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: { code: "SCOPE_DENIED" } });
    expect(startApplicationReview).not.toHaveBeenCalled();
  });

  it("allows an owner to approve and activate a pending collector request", async () => {
    const application = {
      id: "f9a9ef72-e2d6-44c6-8d89-30d7e1f9b9c8",
      borrowerId: "193a2db4-2349-4a48-8833-746a2a334260",
      borrowerName: "Cliente de prueba",
      loanProductId: "56d33f0e-b1a8-4a55-9061-2ccf283ce0f5",
      loanProductName: "Capital de trabajo",
      requestedPrincipal: "500000.00",
      paymentFrequency: "weekly" as const,
      requestedTermCount: 4,
      paidInstallments: 0,
      purpose: null,
      status: "active" as const,
      createdAt: "2026-10-11T00:00:00.000Z",
      updatedAt: "2026-10-11T00:01:00.000Z",
    };
    const approveApplication = vi.fn(async () => ({
      status: "approved" as const,
      application,
    }));
    const app = buildApp(
      dependencies({
        authService: { authenticate: vi.fn(async () => tenantOwner) },
        creditService: { approveApplication } as unknown as CreditService,
      }),
    );
    apps.push(app);
    const response = await app.inject({
      method: "POST",
      url: "/v1/tenants/5c58269f-ce16-4250-82e2-c0c16621b0fb/loan-applications/f9a9ef72-e2d6-44c6-8d89-30d7e1f9b9c8/approve",
      headers: {
        origin: "https://cobranzaap.tech",
        cookie: "cobranzapp_session=session-token",
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ application });
    expect(approveApplication).toHaveBeenCalledWith(
      {
        userId: tenantOwner.id,
        platformRole: null,
        tenantRole: "owner",
      },
      "5c58269f-ce16-4250-82e2-c0c16621b0fb",
      "f9a9ef72-e2d6-44c6-8d89-30d7e1f9b9c8",
      expect.any(String),
    );
  });

  it("does not let a collector approve a credit", async () => {
    const approveApplication = vi.fn();
    const collector: AuthenticatedUser = {
      ...tenantOwner,
      id: "8b8f4a23-3207-497f-a4b6-778cb8f4d1d0",
      memberships: [{ ...tenantOwner.memberships[0], role: "collector" }],
    };
    const app = buildApp(
      dependencies({
        authService: { authenticate: vi.fn(async () => collector) },
        creditService: { approveApplication } as unknown as CreditService,
      }),
    );
    apps.push(app);
    const response = await app.inject({
      method: "POST",
      url: "/v1/tenants/5c58269f-ce16-4250-82e2-c0c16621b0fb/loan-applications/f9a9ef72-e2d6-44c6-8d89-30d7e1f9b9c8/approve",
      headers: {
        origin: "https://cobranzaap.tech",
        cookie: "cobranzapp_session=session-token",
      },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: { code: "SCOPE_DENIED" } });
    expect(approveApplication).not.toHaveBeenCalled();
  });
});

describe("owner credit analytics", () => {
  const analytics: LoanAnalytics = {
    period: { from: "2026-10-01", to: "2026-10-16", preset: "month" },
    metrics: {
      activePrincipalOutstanding: "850000.00",
      approvedPrincipal: "1200000.00",
      collectedAmount: "350000.00",
      renewalCount: 3,
      activeCreditCount: 8,
    },
    renewalsByMember: [
      {
        userId: "8b8f4a23-3207-497f-a4b6-778cb8f4d1d0",
        displayName: "Cobrador Uno",
        role: "collector",
        total: 3,
        pending: 1,
        activated: 2,
      },
    ],
  };

  it("returns date-filtered financial indicators only to the owner", async () => {
    const getAnalytics = vi.fn(async () => ({ status: "found" as const, analytics }));
    const app = buildApp(
      dependencies({
        authService: { authenticate: vi.fn(async () => tenantOwner) },
        creditService: { getAnalytics } as unknown as CreditService,
      }),
    );
    apps.push(app);

    const response = await app.inject({
      method: "GET",
      url: `/v1/tenants/${tenantOwner.memberships[0]?.tenantId}/credit-analytics?from=2026-10-01&to=2026-10-16&preset=month`,
      headers: { cookie: "cobranzapp_session=session-token" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ analytics });
    expect(getAnalytics).toHaveBeenCalledWith(
      expect.objectContaining({ userId: tenantOwner.id, tenantRole: "owner" }),
      tenantOwner.memberships[0]?.tenantId,
      { from: "2026-10-01", to: "2026-10-16", preset: "month" },
    );
  });

  it("does not expose company financial indicators to collectors", async () => {
    const getAnalytics = vi.fn();
    const collector: AuthenticatedUser = {
      ...tenantOwner,
      memberships: [{ ...tenantOwner.memberships[0], role: "collector" }],
    };
    const app = buildApp(
      dependencies({
        authService: { authenticate: vi.fn(async () => collector) },
        creditService: { getAnalytics } as unknown as CreditService,
      }),
    );
    apps.push(app);
    const response = await app.inject({
      method: "GET",
      url: `/v1/tenants/${tenantOwner.memberships[0]?.tenantId}/credit-analytics?from=2026-10-01&to=2026-10-16&preset=month`,
      headers: { cookie: "cobranzapp_session=session-token" },
    });
    expect(response.statusCode).toBe(403);
    expect(getAnalytics).not.toHaveBeenCalled();
  });
});

describe("loan product configuration permissions", () => {
  const product: LoanProduct = {
    id: "56d33f0e-b1a8-4a55-9061-2ccf283ce0f5",
    name: "Crédito estándar",
    status: "draft",
    currency: "COP",
    principalMin: "1.00",
    principalMax: "100000.00",
    termCount: 30,
    paymentFrequency: "daily",
    rateBasis: "flat_total",
    nominalRate: "10.00",
    documentationFeeRate: "0.00",
    complianceStatus: "pending",
    complianceSourceRef: "configuracion-automatica",
    createdAt: "2026-10-11T00:00:00.000Z",
    updatedAt: "2026-10-11T00:00:00.000Z",
  };

  it("blocks supervisors from changing the owner financial rule", async () => {
    const supervisor: AuthenticatedUser = {
      ...tenantOwner,
      id: "8b8f4a23-3207-497f-a4b6-778cb8f4d1d0",
      memberships: [{ ...tenantOwner.memberships[0], role: "supervisor" }],
    };
    const createProduct = vi.fn();
    const app = buildApp(
      dependencies({
        authService: { authenticate: vi.fn(async () => supervisor) },
        creditService: { createProduct } as unknown as CreditService,
      }),
    );
    apps.push(app);
    const response = await app.inject({
      method: "POST",
      url: "/v1/tenants/5c58269f-ce16-4250-82e2-c0c16621b0fb/loan-products",
      headers: {
        origin: "https://cobranzaap.tech",
        cookie: "cobranzapp_session=session-token",
      },
      payload: {
        name: "Crédito estándar",
        principalMin: "1",
        principalMax: "100000",
        termCount: 30,
        paymentFrequency: "daily",
        rateBasis: "flat_total",
        nominalRate: "10",
        documentationFeeRate: "0",
        complianceSourceRef: "configuracion-automatica",
      },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      error: {
        code: "SCOPE_DENIED",
        message: "Solo el propietario puede configurar productos de crédito.",
      },
    });
    expect(createProduct).not.toHaveBeenCalled();
  });

  it("allows the owner to create the financial rule", async () => {
    const createProduct = vi.fn(async () => ({ status: "created" as const, product }));
    const app = buildApp(
      dependencies({
        authService: { authenticate: vi.fn(async () => tenantOwner) },
        creditService: { createProduct } as unknown as CreditService,
      }),
    );
    apps.push(app);
    const response = await app.inject({
      method: "POST",
      url: "/v1/tenants/5c58269f-ce16-4250-82e2-c0c16621b0fb/loan-products",
      headers: {
        origin: "https://cobranzaap.tech",
        cookie: "cobranzapp_session=session-token",
      },
      payload: {
        name: "Crédito estándar",
        principalMin: "1",
        principalMax: "100000",
        termCount: 30,
        paymentFrequency: "daily",
        rateBasis: "flat_total",
        nominalRate: "10",
        documentationFeeRate: "0",
        complianceSourceRef: "configuracion-automatica",
      },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ product });
    expect(createProduct).toHaveBeenCalledWith(
      {
        userId: tenantOwner.id,
        platformRole: null,
        tenantRole: "owner",
      },
      "5c58269f-ce16-4250-82e2-c0c16621b0fb",
      expect.objectContaining({ principalMax: "100000", nominalRate: "10" }),
    );
  });
});

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
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("DENY");
    expect(response.headers["referrer-policy"]).toBe("no-referrer");
    expect(response.headers["strict-transport-security"]).toBe(
      "max-age=31536000; includeSubDomains",
    );
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

  it("publishes the versioned authentication contract", async () => {
    const app = buildApp(dependencies());
    apps.push(app);
    const response = await app.inject({ method: "GET", url: "/v1/openapi.json" });
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("public, max-age=300");
    expect(response.json()).toMatchObject({
      openapi: "3.1.0",
      info: { title: "cobranzapp API", version: "test" },
      paths: {
        "/v1/auth/login": { post: { operationId: "login" } },
        "/v1/auth/me": { get: { operationId: "getCurrentUser" } },
      },
    });
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

  it("requires and verifies MFA before issuing a session", async () => {
    const deps = dependencies({
      authService: {
        login: vi.fn(async () => ({
          status: "mfa_required",
          challengeToken: "challenge-token",
          expiresAt: "2026-10-11T00:05:00.000Z",
        })),
      },
    });
    const app = buildApp(deps);
    apps.push(app);
    const login = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      headers: { origin: "https://cobranzaap.tech" },
      payload: { identifier: "desarrollador", password: "correct-password" },
    });
    expect(login.statusCode).toBe(202);
    expect(login.json()).toEqual({
      mfaRequired: true,
      expiresAt: "2026-10-11T00:05:00.000Z",
    });
    expect(login.headers["set-cookie"]).toContain("cobranzapp_mfa_challenge=challenge-token");
    expect(login.headers["set-cookie"]).not.toContain("cobranzapp_session=");

    const verified = await app.inject({
      method: "POST",
      url: "/v1/auth/mfa/verify-login",
      headers: {
        origin: "https://cobranzaap.tech",
        cookie: "cobranzapp_mfa_challenge=challenge-token",
      },
      payload: { code: "123456" },
    });
    expect(verified.statusCode).toBe(200);
    expect(verified.headers["set-cookie"]).toEqual(
      expect.arrayContaining([
        expect.stringContaining("cobranzapp_session=mfa-session-token"),
        expect.stringContaining("cobranzapp_mfa_challenge=;"),
      ]),
    );
    expect(deps.authService.verifyMfaChallenge).toHaveBeenCalledWith(
      "challenge-token",
      "123456",
      expect.any(String),
    );
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

  it("exposes the current MFA status without caching it", async () => {
    const deps = dependencies();
    const app = buildApp(deps);
    apps.push(app);
    const response = await app.inject({
      method: "GET",
      url: "/v1/auth/mfa",
      headers: { cookie: "cobranzapp_session=session-token" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.json()).toEqual({
      mfa: { enabled: false, setupPending: false, setupExpiresAt: null },
    });
    expect(deps.authService.getMfaStatus).toHaveBeenCalledWith(developer.id);
  });

  it("starts and confirms TOTP enrollment after recent reauthentication", async () => {
    const deps = dependencies();
    const app = buildApp(deps);
    apps.push(app);
    const headers = {
      cookie: "cobranzapp_session=session-token",
      origin: "https://cobranzaap.tech",
    };
    const setup = await app.inject({ method: "POST", url: "/v1/auth/mfa/setup", headers });
    expect(setup.statusCode).toBe(201);
    expect(setup.headers["cache-control"]).toBe("no-store");
    expect(setup.json()).toMatchObject({
      enrollment: {
        secret: "JBSWY3DPEHPK3PXP",
        qrDataUrl: expect.stringMatching(/^data:image\/png;base64,/),
      },
    });
    expect(setup.json().enrollment).not.toHaveProperty("uri");

    const enabled = await app.inject({
      method: "POST",
      url: "/v1/auth/mfa/enable",
      headers,
      payload: { code: "123456" },
    });
    expect(enabled.statusCode).toBe(200);
    expect(enabled.json()).toEqual({
      mfa: { enabled: true },
      recoveryCodes: ["ABCDE-ABCDE-ABCDE-ABCDE"],
      revokedSessions: 1,
    });
    expect(deps.authService.confirmMfaEnrollment).toHaveBeenCalledWith(
      developer.id,
      "session-token",
      "123456",
      expect.any(String),
    );
  });

  it("disables MFA with a current authentication or recovery code", async () => {
    const deps = dependencies();
    const app = buildApp(deps);
    apps.push(app);
    const response = await app.inject({
      method: "DELETE",
      url: "/v1/auth/mfa",
      headers: {
        cookie: "cobranzapp_session=session-token",
        origin: "https://cobranzaap.tech",
      },
      payload: { code: "ABCDE-ABCDE-ABCDE-ABCDE" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ mfa: { enabled: false }, revokedSessions: 1 });
    expect(deps.authService.disableMfa).toHaveBeenCalledWith(
      developer.id,
      "session-token",
      "ABCDE-ABCDE-ABCDE-ABCDE",
      expect.any(String),
    );
  });

  it("requires recent reauthentication before changing MFA", async () => {
    const deps = dependencies({
      authService: { isRecentlyReauthenticated: vi.fn(async () => false) },
    });
    const app = buildApp(deps);
    apps.push(app);
    const response = await app.inject({
      method: "POST",
      url: "/v1/auth/mfa/setup",
      headers: {
        cookie: "cobranzapp_session=session-token",
        origin: "https://cobranzaap.tech",
      },
    });
    expect(response.statusCode).toBe(428);
    expect(response.json()).toMatchObject({ error: { code: "REAUTHENTICATION_REQUIRED" } });
    expect(deps.authService.beginMfaEnrollment).not.toHaveBeenCalled();
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

  it("filters and paginates the platform audit directory", async () => {
    const deps = dependencies();
    const app = buildApp(deps);
    apps.push(app);
    const response = await app.inject({
      method: "GET",
      url: "/v1/platform/activity?q=empresa&action=tenant.created&page=2&pageSize=10",
      headers: { cookie: "cobranzapp_session=session-token" },
    });
    expect(response.statusCode).toBe(200);
    expect(deps.platformService.listActivity).toHaveBeenCalledWith(developer.id, {
      search: "empresa",
      action: "tenant.created",
      page: 2,
      pageSize: 10,
    });
    expect(response.json()).toMatchObject({
      activity: [{ action: "tenant.created", tenantName: "Empresa Uno" }],
      availableActions: ["tenant.created", "tenant.status_changed"],
      pagination: { page: 2, pageSize: 10, total: 1, totalPages: 1 },
    });
  });

  it("rejects invalid platform audit filters", async () => {
    const app = buildApp(dependencies());
    apps.push(app);
    const response = await app.inject({
      method: "GET",
      url: "/v1/platform/activity?action=DROP%20TABLE&pageSize=500",
      headers: { cookie: "cobranzapp_session=session-token" },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: "INVALID_ACTIVITY_FILTERS" } });
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

  it("activates a second owner subscription and returns its activation timestamp", async () => {
    const deps = dependencies();
    const app = buildApp(deps);
    apps.push(app);
    const userId = "164bf50a-2098-4acc-a250-6ad21df83e40";
    const response = await app.inject({
      method: "PATCH",
      url: `/v1/platform/users/${userId}/membership`,
      headers: {
        cookie: "cobranzapp_session=session-token",
        origin: "https://cobranzaap.tech",
      },
      payload: { membershipPlan: "ultra" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      membershipPlan: "ultra",
      activatedAt: "2026-10-11T02:00:00.000Z",
    });
    expect(deps.platformService.updateUserMembership).toHaveBeenCalledWith(
      developer.id,
      userId,
      { membershipPlan: "ultra" },
      expect.any(String),
    );
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

  it("creates an additional owner company without requiring a code", async () => {
    const deps = dependencies({
      authService: { authenticate: vi.fn(async () => tenantOwner) },
    });
    const app = buildApp(deps);
    apps.push(app);
    const response = await app.inject({
      method: "POST",
      url: "/v1/account/tenants",
      headers: {
        cookie: "cobranzapp_session=session-token",
        origin: "https://cobranzaap.tech",
      },
      payload: { displayName: "Empresa Nueva", password: "owner-password-12" },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      tenant: {
        tenantId: "f1d80b2d-c1d8-4b30-9f02-12f4e1f7c8b6",
        tenantName: "Empresa Nueva",
        tenantSlug: "empresa-nueva",
        role: "owner",
      },
    });
    expect(deps.platformService.createTenantForOwner).toHaveBeenCalledWith(
      tenantOwner.id,
      expect.objectContaining({ displayName: "Empresa Nueva", code: undefined }),
    );
  });

  it("returns the owner's available subscriptions for onboarding", async () => {
    const deps = dependencies({
      authService: { authenticate: vi.fn(async () => tenantOwner) },
    });
    const app = buildApp(deps);
    apps.push(app);
    const response = await app.inject({
      method: "GET",
      url: "/v1/account/subscriptions",
      headers: { cookie: "cobranzapp_session=session-token" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      availableCount: 2,
      availableSubscriptions: [
        { membershipPlan: "pro", activatedAt: "2026-10-11T00:00:00.000Z" },
        { membershipPlan: "ultra", activatedAt: "2026-10-11T01:00:00.000Z" },
      ],
    });
    expect(deps.platformService.getOwnerSubscriptionSummary).toHaveBeenCalledWith(tenantOwner.id);
  });

  it("explains when an owner has no available subscription for a company", async () => {
    const deps = dependencies({
      authService: { authenticate: vi.fn(async () => tenantOwner) },
    });
    vi.mocked(deps.platformService.createTenantForOwner).mockResolvedValue({
      status: "no_subscription",
    });
    const app = buildApp(deps);
    apps.push(app);
    const response = await app.inject({
      method: "POST",
      url: "/v1/account/tenants",
      headers: {
        cookie: "cobranzapp_session=session-token",
        origin: "https://cobranzaap.tech",
      },
      payload: { displayName: "Empresa Sin Plan", password: "owner-password-12" },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      error: {
        code: "SUBSCRIPTION_REQUIRED",
        message:
          "Tu cuenta no tiene una suscripción disponible. Solicita al desarrollador que active una.",
      },
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

  it("protects and updates the signed-in member operational profile", async () => {
    const deps = dependencies({ authService: { authenticate: vi.fn(async () => tenantOwner) } });
    const profile = {
      userId: tenantOwner.id,
      phone: null,
      homeAddress: null,
      workAddress: null,
      profilePhotoObjectKey: null,
      bloodType: null,
      bloodTypeConsentVersion: null,
      bloodTypeConsentedAt: null,
      emergencyContacts: [],
    } as const;
    deps.tenancyService.getMemberProfile = vi.fn(async () => profile);
    deps.tenancyService.updateMemberProfile = vi.fn(async (_actor, _tenantId, _userId, input) => ({
      status: "updated" as const,
      profile: {
        ...profile,
        phone: input.phone,
        emergencyContacts: input.emergencyContacts.map((contact, index) => ({
          ...contact,
          id: `9ec06ada-07c8-42ba-b1f8-af0fc43c75e${index}`,
        })),
      },
    }));
    const app = buildApp(deps);
    apps.push(app);
    const tenantId = tenantOwner.memberships[0]?.tenantId;
    const headers = {
      cookie: "cobranzapp_session=session-token",
      origin: "https://cobranzaap.tech",
    };
    const read = await app.inject({
      method: "GET",
      url: `/v1/tenants/${tenantId}/members/${tenantOwner.id}/profile`,
      headers,
    });
    expect(read.statusCode).toBe(200);
    expect(read.json()).toMatchObject({ profile: { userId: tenantOwner.id } });
    const update = await app.inject({
      method: "PUT",
      url: `/v1/tenants/${tenantId}/members/${tenantOwner.id}/profile`,
      headers,
      payload: {
        phone: "+57 300 111 2233",
        homeAddress: null,
        workAddress: null,
        profilePhotoObjectKey: null,
        bloodType: null,
        bloodTypeConsentVersion: null,
        emergencyContacts: [],
      },
    });
    expect(update.statusCode).toBe(200);
    expect(update.json()).toMatchObject({ profile: { phone: "+57 300 111 2233" } });
    expect(deps.tenancyService.updateMemberProfile).toHaveBeenCalledWith(
      expect.objectContaining({ tenantRole: "owner" }),
      tenantId,
      tenantOwner.id,
      expect.objectContaining({ phone: "+57 300 111 2233" }),
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

  it("does not expose shared verification before the operational key is configured", async () => {
    const deps = dependencies({ authService: { authenticate: vi.fn(async () => tenantOwner) } });
    const app = buildApp(deps);
    apps.push(app);
    const tenantId = tenantOwner.memberships[0]?.tenantId;
    const response = await app.inject({
      method: "POST",
      url: `/v1/tenants/${tenantId}/verification-network/query`,
      headers: {
        cookie: "cobranzapp_session=session-token",
        origin: "https://cobranzaap.tech",
      },
      payload: {
        country: "CO",
        documentType: "CC",
        documentNumber: "12345678",
        consentToken: "a".repeat(40),
        purpose: "credit_evaluation",
      },
    });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ error: { code: "VERIFICATION_NETWORK_DISABLED" } });
  });

  it("rejects a shared client lookup without explicit consent", async () => {
    const verifyShared = vi.fn();
    const deps = dependencies({
      authService: { authenticate: vi.fn(async () => tenantOwner) },
      borrowerService: { verifyShared } as unknown as BorrowerService,
    });
    const app = buildApp(deps);
    apps.push(app);
    const tenantId = tenantOwner.memberships[0]?.tenantId;
    const response = await app.inject({
      method: "POST",
      url: `/v1/tenants/${tenantId}/client-verification`,
      headers: {
        cookie: "cobranzapp_session=session-token",
        origin: "https://cobranzaap.tech",
      },
      payload: { documentNumber: "1234567890" },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: { code: "CLIENT_VERIFICATION_CONSENT_REQUIRED" },
    });
    expect(verifyShared).not.toHaveBeenCalled();
  });
});
