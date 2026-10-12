import { describe, expect, it } from "vitest";
import { apiErrorSchema } from "./index.js";
import { createOpenApiDocument } from "./openapi.js";

describe("OpenAPI contract", () => {
  it("publishes OpenAPI 3.1 with cookie authentication and stable errors", () => {
    const document = createOpenApiDocument("test-sha");
    expect(document.openapi).toBe("3.1.0");
    expect(document.info.version).toBe("test-sha");
    expect(document.paths["/v1/auth/login"].post.responses["202"]).toBeDefined();
    expect(document.paths["/v1/platform/overview"].get.operationId).toBe("getPlatformOverview");
    expect(document.paths["/v1/platform/system-status"].get.operationId).toBe(
      "getPlatformSystemStatus",
    );
    expect(document.paths["/v1/platform/tenants"].get.operationId).toBe("listPlatformTenants");
    expect(document.paths["/v1/platform/users"].get.operationId).toBe("listPlatformUsers");
    expect(document.paths["/v1/platform/support-access"].get.operationId).toBe(
      "listPlatformSupportAccess",
    );
    expect(document.paths["/v1/platform/activity"].get.operationId).toBe("listPlatformActivity");
    expect(document.components.securitySchemes.cookieAuth.name).toBe("cobranzapp_session");
    expect(
      apiErrorSchema.safeParse({ error: { code: "AUTH_REQUIRED", message: "x" } }).success,
    ).toBe(false);
  });
});
