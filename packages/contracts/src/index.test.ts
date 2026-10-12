import { describe, expect, it } from "vitest";
import {
  currentUserSchema,
  loginRequestSchema,
  platformSystemStatusSchema,
  platformTenantDirectoryQuerySchema,
  platformUserDirectoryQuerySchema,
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
});
