import { describe, expect, it } from "vitest";
import { buildBrandLogoSource } from "./brand-assets";

describe("private company logo source", () => {
  it("sends the native session cookie", () => {
    expect(buildBrandLogoSource("tenant-123", "cobranzapp_session=private-token")).toEqual({
      uri: "https://cobranzaap.tech/api/v1/tenants/tenant-123/brand-logo",
      headers: { Cookie: "cobranzapp_session=private-token" },
    });
  });

  it("does not invent a public credential for browser sessions", () => {
    expect(buildBrandLogoSource("tenant-123")).toEqual({
      uri: "https://cobranzaap.tech/api/v1/tenants/tenant-123/brand-logo",
    });
  });
});
