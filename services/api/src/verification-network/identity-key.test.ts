import { describe, expect, it } from "vitest";
import { normalizeVerificationIdentity, verificationIdentityKey } from "./identity-key.js";

describe("verification network identity key", () => {
  it("normalizes Colombian document input without persisting the number", () => {
    expect(
      normalizeVerificationIdentity({
        country: " co ",
        documentType: " cédula ",
        documentNumber: "1.234-567 890",
      }),
    ).toEqual({ country: "CO", documentType: "CEDULA", documentNumber: "1234567890" });
  });

  it("is deterministic for equivalent input and changes with the secret", () => {
    const identity = { country: "CO", documentType: "CC", documentNumber: "12345678" };
    expect(verificationIdentityKey(identity, "secret")).toEqual(
      verificationIdentityKey({ ...identity, documentNumber: "12.345.678" }, "secret"),
    );
    expect(verificationIdentityKey(identity, "secret")).not.toEqual(
      verificationIdentityKey(identity, "other-secret"),
    );
  });

  it("rejects malformed identity fields", () => {
    expect(() =>
      verificationIdentityKey(
        { country: "COL", documentType: "CC", documentNumber: "1234" },
        "secret",
      ),
    ).toThrow("INVALID_DOCUMENT_COUNTRY");
  });
});
