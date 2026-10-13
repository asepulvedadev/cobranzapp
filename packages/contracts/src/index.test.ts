import { describe, expect, it } from "vitest";
import {
  borrowerAddressGeocodeRequestSchema,
  borrowerAddressUpdateRequestSchema,
  borrowerCreateRequestSchema,
  borrowerDirectorySchema,
  borrowerReviewRequestSchema,
  createBranchRequestSchema,
  createPlatformTenantRequestSchema,
  currentUserSchema,
  loanProductCreateRequestSchema,
  loginRequestSchema,
  platformSystemStatusSchema,
  platformTenantDirectoryQuerySchema,
  platformTenantStatusUpdateRequestSchema,
  platformUserDirectoryQuerySchema,
  routeAssignmentUpdateRequestSchema,
  routeStatusUpdateRequestSchema,
  sharedClientVerificationRequestSchema,
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

  it("requires staff identity fields together when document registration starts", () => {
    const base = {
      phone: null,
      homeAddress: null,
      workAddress: null,
      profilePhotoObjectKey: null,
      bloodType: null,
      bloodTypeConsentVersion: null,
      emergencyContacts: [],
    };
    expect(
      tenantMemberProfileRequestSchema.safeParse({
        ...base,
        country: "CO",
        documentType: "CC",
      }).success,
    ).toBe(false);
    expect(
      tenantMemberProfileRequestSchema.safeParse({
        ...base,
        country: "CO",
        documentType: "CC",
        documentNumber: "1234567890",
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
      homeAddressConfirmed: true,
      workAddressConfirmed: true,
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
    expect(
      borrowerCreateRequestSchema.safeParse({
        ...base,
        homeAddressConfirmed: false,
        emergencyContacts: [
          { fullName: "Contacto", relationship: "Hermano", phone: "+57 300 444 5566" },
        ],
      }).success,
    ).toBe(false);
    expect(
      borrowerCreateRequestSchema.safeParse({
        ...base,
        workAddressConfirmed: undefined,
        emergencyContacts: [
          { fullName: "Contacto", relationship: "Hermano", phone: "+57 300 444 5566" },
        ],
      }).success,
    ).toBe(false);
  });

  it("only accepts address corrections after both addresses are confirmed", () => {
    const payload = {
      homeAddress: "Calle 10 # 20-30, Cúcuta",
      workAddress: "Carrera 5 # 6-7, Cúcuta",
      homeAddressConfirmed: true,
      workAddressConfirmed: true,
    };
    expect(borrowerAddressUpdateRequestSchema.safeParse(payload).success).toBe(true);
    expect(
      borrowerAddressUpdateRequestSchema.safeParse({ ...payload, workAddressConfirmed: false })
        .success,
    ).toBe(false);
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

  it("accepts a complete device location and rejects half a coordinate pair", () => {
    expect(
      borrowerAddressGeocodeRequestSchema.safeParse({
        addressKind: "home",
        latitude: 4.711,
        longitude: -74.0721,
      }).success,
    ).toBe(true);
    expect(
      borrowerAddressGeocodeRequestSchema.safeParse({
        addressKind: "work",
        latitude: 4.711,
      }).success,
    ).toBe(false);
  });

  it("requires explicit client consent before a shared verification lookup", () => {
    expect(
      sharedClientVerificationRequestSchema.safeParse({
        documentNumber: "1234567890",
      }).success,
    ).toBe(false);
    expect(
      sharedClientVerificationRequestSchema.safeParse({
        documentNumber: "1234567890",
        consentConfirmed: false,
      }).success,
    ).toBe(false);
    expect(
      sharedClientVerificationRequestSchema.safeParse({
        documentNumber: "1234567890",
        consentConfirmed: true,
      }).success,
    ).toBe(true);
  });

  it("keeps the credit term at one month, with a five-week exception", () => {
    const base = {
      name: "Producto de prueba",
      principalMin: "100000.00",
      principalMax: "1000000.00",
      rateBasis: "flat_total" as const,
      nominalRate: "10",
      documentationFeeRate: "0",
      complianceSourceRef: null,
    };
    expect(
      loanProductCreateRequestSchema.safeParse({
        ...base,
        paymentFrequency: "fortnightly",
        termCount: 2,
      }).success,
    ).toBe(true);
    expect(
      loanProductCreateRequestSchema.safeParse({
        ...base,
        paymentFrequency: "fortnightly",
        termCount: 3,
      }).success,
    ).toBe(false);
  });

  it("keeps borrower verification totals independent from the visible page", () => {
    const result = borrowerDirectorySchema.parse({
      borrowers: [],
      pagination: { page: 1, pageSize: 20, total: 42, totalPages: 3 },
      identitySummary: { pending: 12, reviewed: 28, rejected: 2 },
      borrowerSummary: { active: 40, archived: 2 },
    });
    expect(result.identitySummary).toEqual({ pending: 12, reviewed: 28, rejected: 2 });
    expect(result.borrowerSummary).toEqual({ active: 40, archived: 2 });
    const empty = borrowerDirectorySchema.parse({
      borrowers: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
    });
    expect(empty.identitySummary).toEqual({ pending: 0, reviewed: 0, rejected: 0 });
    expect(empty.borrowerSummary).toEqual({ active: 0, archived: 0 });
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

  it("limits route status changes to activation and archival", () => {
    expect(routeStatusUpdateRequestSchema.parse({ status: "active" })).toEqual({
      status: "active",
    });
    expect(routeStatusUpdateRequestSchema.parse({ status: "archived" })).toEqual({
      status: "archived",
    });
    expect(routeStatusUpdateRequestSchema.safeParse({ status: "draft" }).success).toBe(false);
  });

  it("allows an explicit collector assignment or a cleared assignment", () => {
    expect(
      routeAssignmentUpdateRequestSchema.parse({
        collectorId: "03d87dd0-dfc6-4948-bef1-a04f06b61ca6",
      }),
    ).toEqual({ collectorId: "03d87dd0-dfc6-4948-bef1-a04f06b61ca6" });
    expect(routeAssignmentUpdateRequestSchema.parse({ collectorId: null })).toEqual({
      collectorId: null,
    });
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
        activeCredits: 2,
        creditApplicationsInReview: 1,
      },
      membershipEntitlement: null,
      settings: {
        primaryColor: "#111111",
        accentColor: "#FBBF24",
        logoObjectKey: null,
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
