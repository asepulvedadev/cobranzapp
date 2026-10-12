import { describe, expect, it } from "vitest";
import {
  borrowerCreateRequestSchema,
  borrowerDirectorySchema,
  borrowerReviewRequestSchema,
  createBranchRequestSchema,
  createPlatformTenantRequestSchema,
  currentUserSchema,
  loginRequestSchema,
  platformSystemStatusSchema,
  platformTenantDirectoryQuerySchema,
  platformTenantStatusUpdateRequestSchema,
  platformUserDirectoryQuerySchema,
  tenantMemberProfileRequestSchema,
  tenantOverviewSchema,
  tenantSettingsUpdateRequestSchema,
} from "./index.js";

describe("shared API contracts", () => {
  it("accepts username or email identifiers without accepting short passwords", () => {
    expect(
      loginRequestSchema.safeParse({ identifier: "asepulvedadev", password: "valid-password-123" })
        .success,
    ).toBe(true);
    expect(
      loginRequestSchema.safeParse({
        identifier: "asepulvedadev@gmail.com",
        password: "valid-password-123",
      }).success,
    ).toBe(true);
    expect(loginRequestSchema.safeParse({ identifier: "user", password: "short" }).success).toBe(
      false,
    );
  });

  it("keeps tenant memberships explicit in the authenticated identity", () => {
    expect(
      currentUserSchema.parse({
        id: "03d87dd0-dfc6-4948-bef1-a04f06b61ca6",
        username: "propietaria",
        email: "propietaria@example.com",
        displayName: "Propietaria Ejemplo",
        platformRole: null,
        mustChangePassword: false,
        mfaEnabled: true,
        memberships: [
          {
            tenantId: "1320b5cf-98c7-4c7e-8771-e3ce7c7699a5",
            tenantName: "Empresa Ejemplo",
            tenantSlug: "empresa-ejemplo",
            role: "owner",
          },
        ],
      }).memberships[0]?.role,
    ).toBe("owner");
  });

  it("normalizes developer directory pagination and rejects unknown states", () => {
    expect(platformTenantDirectoryQuerySchema.parse({ page: "2" })).toMatchObject({
      page: 2,
      pageSize: 20,
    });
    expect(platformUserDirectoryQuerySchema.safeParse({ status: "archived" }).success).toBe(false);
  });

  it("requires complete operational status counts", () => {
    expect(
      platformSystemStatusSchema.safeParse({
        api: { status: "operational", version: "test-sha" },
        database: { status: "operational", schemaVersion: "0015_totp" },
        jobs: {
          status: "operational",
          due: 0,
          scheduled: 1,
          processing: 0,
          dead: 0,
          expiredLeases: 0,
          oldestDueAt: null,
        },
        checkedAt: "2026-10-11T20:00:00.000Z",
      }).success,
    ).toBe(true);
  });

  it("requires explicit consent when a staff blood type is captured", () => {
    const base = {
      phone: null,
      homeAddress: null,
      workAddress: null,
      profilePhotoObjectKey: null,
      bloodType: "O+" as const,
      bloodTypeConsentVersion: null,
      emergencyContacts: [],
    };
    expect(tenantMemberProfileRequestSchema.safeParse(base).success).toBe(false);
    expect(
      tenantMemberProfileRequestSchema.safeParse({
        ...base,
        bloodTypeConsentVersion: "staff-profile-v1",
      }).success,
    ).toBe(true);
  });

  it("keeps borrower identity masked and requires an emergency contact", () => {
    const base = {
      fullName: "Cliente Ejemplo",
      country: "CO",
      documentType: "CC",
      documentNumber: "1234567890",
      phone: "+57 300 111 2233",
      homeAddress: "Calle 1 # 2-3",
      workAddress: "Carrera 4 # 5-6",
      profilePhotoObjectKey: null,
      consentVersion: "borrower-dossier-v1",
      consentEvidenceRef: "form-001",
      documents: [],
    };
    expect(borrowerCreateRequestSchema.safeParse({ ...base, emergencyContacts: [] }).success).toBe(
      false,
    );
    expect(
      borrowerCreateRequestSchema.safeParse({
        ...base,
        emergencyContacts: [
          { fullName: "Contacto", relationship: "Hermano", phone: "+57 300 444 5566" },
        ],
      }).success,
    ).toBe(true);
  });

  it("requires the full checklist before approving a borrower identity", () => {
    const review = {
      decision: "reviewed" as const,
      notes: "La evidencia coincide con la ficha manual.",
      legalNameConfirmed: true,
      identityFrontConfirmed: true,
      identityBackConfirmed: true,
      profilePhotoConfirmed: true,
    };
    expect(borrowerReviewRequestSchema.safeParse(review).success).toBe(true);
    expect(
      borrowerReviewRequestSchema.safeParse({ ...review, profilePhotoConfirmed: false }).success,
    ).toBe(false);
    expect(
      borrowerReviewRequestSchema.safeParse({
        ...review,
        decision: "rejected",
        notes: "No coincide el número con la evidencia.",
        legalNameConfirmed: false,
        identityFrontConfirmed: false,
        identityBackConfirmed: false,
        profilePhotoConfirmed: false,
      }).success,
    ).toBe(true);
  });

  it("keeps borrower verification totals independent from the visible page", () => {
    const result = borrowerDirectorySchema.parse({
      borrowers: [],
      pagination: { page: 1, pageSize: 20, total: 42, totalPages: 3 },
      identitySummary: { pending: 12, reviewed: 28, rejected: 2 },
    });
    expect(result.identitySummary).toEqual({ pending: 12, reviewed: 28, rejected: 2 });
    expect(
      borrowerDirectorySchema.parse({
        borrowers: [],
        pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
      }).identitySummary,
    ).toEqual({ pending: 0, reviewed: 0, rejected: 0 });
  });

  it("normalizes platform tenant creation and forbids returning to draft", () => {
    expect(
      createPlatformTenantRequestSchema.parse({
        displayName: "  Cobros del Norte  ",
        slug: "Cobros-Del-Norte",
        membershipPlan: "pro",
      }),
    ).toEqual({
      displayName: "Cobros del Norte",
      slug: "cobros-del-norte",
      membershipPlan: "pro",
    });
    expect(platformTenantStatusUpdateRequestSchema.safeParse({ status: "draft" }).success).toBe(
      false,
    );
  });

  it("keeps tenant overview scope and branding fields explicit", () => {
    const result = tenantOverviewSchema.safeParse({
      tenant: {
        id: "03d87dd0-dfc6-4948-bef1-a04f06b61ca6",
        slug: "empresa-ejemplo",
        displayName: "Empresa Ejemplo",
        status: "active",
        locale: "es-CO",
        timezone: "America/Bogota",
        currency: "COP",
        membershipPlan: "pro",
      },
      actorRole: "owner",
      metrics: {
        members: 1,
        branches: 1,
        teams: 1,
        pendingInvitations: 0,
        activeEmployeeSeats: 0,
      },
      membershipEntitlement: null,
      settings: {
        primaryColor: "#111111",
        accentColor: "#FBBF24",
        contactEmail: "operaciones@example.com",
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
    });
    expect(result.success).toBe(true);
  });

  it("normalizes workspace settings and branch inputs", () => {
    expect(
      tenantSettingsUpdateRequestSchema.parse({
        primaryColor: "#111111",
        accentColor: "#FBBF24",
        contactEmail: "OPERACIONES@EXAMPLE.COM",
        contactPhone: "",
        address: "",
        version: 2,
      }),
    ).toMatchObject({ contactEmail: "OPERACIONES@EXAMPLE.COM", contactPhone: "", address: "" });
    expect(
      createBranchRequestSchema.parse({ code: " Centro ", displayName: " Sede Centro " }),
    ).toEqual({ code: "centro", displayName: "Sede Centro" });
  });
});
