import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";

function deriveKey(secret: string, purpose: string) {
  return createHash("sha256").update(`${purpose}\0${secret}`).digest();
}

export function normalizeBorrowerDocumentNumber(value: string) {
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (normalized.length < 4 || normalized.length > 32) throw new Error("INVALID_DOCUMENT_NUMBER");
  return normalized;
}

/** Preserve the operator's address wording while removing accidental spacing
 * and line breaks from mobile paste/autofill. */
export function normalizeBorrowerAddress(value: string) {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length < 3 || normalized.length > 240) {
    throw new Error("INVALID_BORROWER_ADDRESS");
  }
  return normalized;
}

export function borrowerDocumentLookupHmac(
  secret: string,
  input: { tenantId: string; country: string; documentType: string; documentNumber: string },
) {
  const country = input.country.trim().toUpperCase();
  const documentType = input.documentType.trim().toUpperCase();
  const number = normalizeBorrowerDocumentNumber(input.documentNumber);
  return createHmac("sha256", deriveKey(secret, "borrower-lookup"))
    .update(`${input.tenantId}|${country}|${documentType}|${number}`)
    .digest();
}

/** Stable cross-company lookup key. It contains no tenant identifier and is
 * only used by the minimal shared verification aggregate. */
export function borrowerSharedDocumentLookupHmac(
  secret: string,
  input: { country: string; documentType: string; documentNumber: string },
) {
  const country = input.country.trim().toUpperCase();
  const documentType = input.documentType.trim().toUpperCase();
  const number = normalizeBorrowerDocumentNumber(input.documentNumber);
  return createHmac("sha256", deriveKey(secret, "borrower-shared-lookup"))
    .update(`${country}|${documentType}|${number}`)
    .digest();
}

export function encryptBorrowerDocumentNumber(secret: string, documentNumber: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(secret, "borrower-document"), iv);
  const ciphertext = Buffer.concat([
    cipher.update(normalizeBorrowerDocumentNumber(documentNumber), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${ciphertext.toString("base64url")}`;
}

export function decryptBorrowerDocumentNumber(secret: string, payload: string) {
  const [version, ivEncoded, tagEncoded, ciphertextEncoded] = payload.split(":");
  if (version !== "v1" || !ivEncoded || !tagEncoded || !ciphertextEncoded) {
    throw new Error("INVALID_DOCUMENT_CIPHERTEXT");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    deriveKey(secret, "borrower-document"),
    Buffer.from(ivEncoded, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextEncoded, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export type BorrowerOcrFields = {
  fullName: string | null;
  documentNumber: string | null;
  country: string | null;
  documentType: string | null;
};

export function encryptBorrowerOcrFields(secret: string, fields: BorrowerOcrFields) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(secret, "borrower-ocr"), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(fields), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${ciphertext.toString("base64url")}`;
}

export function decryptBorrowerOcrFields(secret: string, payload: string): BorrowerOcrFields {
  const [version, ivEncoded, tagEncoded, ciphertextEncoded] = payload.split(":");
  if (!ivEncoded || !tagEncoded || !ciphertextEncoded || version !== "v1") {
    throw new Error("INVALID_OCR_CIPHERTEXT");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    deriveKey(secret, "borrower-ocr"),
    Buffer.from(ivEncoded, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));
  const raw = Buffer.concat([
    decipher.update(Buffer.from(ciphertextEncoded, "base64url")),
    decipher.final(),
  ]).toString("utf8");
  const parsed = JSON.parse(raw) as Partial<BorrowerOcrFields>;
  return {
    fullName: typeof parsed.fullName === "string" ? parsed.fullName : null,
    documentNumber: typeof parsed.documentNumber === "string" ? parsed.documentNumber : null,
    country: typeof parsed.country === "string" ? parsed.country : null,
    documentType: typeof parsed.documentType === "string" ? parsed.documentType : null,
  };
}
