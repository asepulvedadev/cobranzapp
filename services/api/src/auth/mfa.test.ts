import { describe, expect, it } from "vitest";
import {
  createMfaSecret,
  createMfaUri,
  createRecoveryCodes,
  decryptMfaSecret,
  encryptMfaSecret,
  generateMfaToken,
  hashRecoveryCode,
  parseMfaEncryptionKey,
  verifyMfaToken,
} from "./mfa.js";

describe("TOTP MFA primitives", () => {
  it("encrypts secrets with authenticated encryption", () => {
    const key = Buffer.alloc(32, 7);
    const encrypted = encryptMfaSecret("JBSWY3DPEHPK3PXP", key);
    expect(encrypted).not.toContain("JBSWY3DPEHPK3PXP");
    expect(decryptMfaSecret(encrypted, key)).toBe("JBSWY3DPEHPK3PXP");
    expect(() => decryptMfaSecret(encrypted, Buffer.alloc(32, 8))).toThrow();
  });

  it("accepts a current token once and rejects replay", () => {
    const secret = createMfaSecret();
    const timestamp = 1_791_760_000_000;
    const token = generateMfaToken(secret, timestamp);
    const counter = verifyMfaToken(secret, token, null, timestamp);
    expect(counter).toBeTypeOf("number");
    expect(verifyMfaToken(secret, token, counter, timestamp)).toBeNull();
    expect(createMfaUri("persona@example.com", secret)).toContain("otpauth://totp/");
  });

  it("creates independent one-time recovery codes", () => {
    const codes = createRecoveryCodes();
    expect(codes).toHaveLength(8);
    expect(new Set(codes)).toHaveLength(8);
    expect(hashRecoveryCode(codes[0] ?? "")).toEqual(
      hashRecoveryCode((codes[0] ?? "").toLowerCase().replaceAll("-", " ")),
    );
  });

  it("requires exactly 32 bytes of base64 key material", () => {
    const encoded = Buffer.alloc(32, 9).toString("base64");
    expect(parseMfaEncryptionKey(encoded)).toEqual(Buffer.alloc(32, 9));
    expect(() => parseMfaEncryptionKey("not-a-key")).toThrow();
  });
});
