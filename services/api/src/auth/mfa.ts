import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import * as OTPAuth from "otpauth";

const issuer = "cobranzapp";

export function parseMfaEncryptionKey(value: string) {
  const key = Buffer.from(value, "base64");
  if (key.length !== 32 || key.toString("base64").replace(/=+$/, "") !== value.replace(/=+$/, "")) {
    throw new Error("MFA_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  }
  return key;
}

export function createMfaSecret() {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

function totp(secret: string, label: string) {
  return new OTPAuth.TOTP({
    algorithm: "SHA1",
    digits: 6,
    issuer,
    label,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
}

export function createMfaUri(label: string, secret: string) {
  return totp(secret, label).toString();
}

export function generateMfaToken(secret: string, timestamp = Date.now()) {
  return totp(secret, "verification").generate({ timestamp });
}

export function verifyMfaToken(
  secret: string,
  token: string,
  lastUsedCounter: number | null,
  timestamp = Date.now(),
) {
  if (!/^\d{6}$/.test(token)) return null;
  const authenticator = totp(secret, "verification");
  const delta = authenticator.validate({ token, timestamp, window: 1 });
  if (delta === null) return null;
  const counter = authenticator.counter({ timestamp }) + delta;
  return lastUsedCounter !== null && counter <= lastUsedCounter ? null : counter;
}

export function encryptMfaSecret(secret: string, key: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return [
    "v1",
    iv.toString("base64url"),
    encrypted.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
  ].join(".");
}

export function decryptMfaSecret(envelope: string, key: Buffer) {
  const [version, iv, encrypted, tag, extra] = envelope.split(".");
  if (version !== "v1" || !iv || !encrypted || !tag || extra)
    throw new Error("Invalid MFA secret envelope");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function normalizeRecoveryCode(code: string) {
  return code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

export function hashRecoveryCode(code: string) {
  return createHash("sha256").update(normalizeRecoveryCode(code)).digest();
}

export function createRecoveryCodes(count = 8) {
  return Array.from({ length: count }, () => {
    const raw = randomBytes(10).toString("hex").toUpperCase();
    return raw.match(/.{1,5}/g)?.join("-") ?? raw;
  });
}
