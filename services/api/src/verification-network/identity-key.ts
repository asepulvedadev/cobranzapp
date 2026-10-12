import { createHmac } from "node:crypto";

export type VerificationIdentity = {
  country: string;
  documentType: string;
  documentNumber: string;
};

function normalizePart(value: string) {
  return value
    .normalize("NFKC")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toUpperCase()
    .replace(/[\s.-]/g, "");
}

export function normalizeVerificationIdentity(identity: VerificationIdentity) {
  const country = normalizePart(identity.country);
  const documentType = normalizePart(identity.documentType);
  const documentNumber = normalizePart(identity.documentNumber);
  if (!/^[A-Z]{2}$/.test(country)) throw new Error("INVALID_DOCUMENT_COUNTRY");
  if (!/^[A-Z0-9_]{2,30}$/.test(documentType)) throw new Error("INVALID_DOCUMENT_TYPE");
  if (!/^[A-Z0-9]{4,32}$/.test(documentNumber)) throw new Error("INVALID_DOCUMENT_NUMBER");
  return { country, documentType, documentNumber };
}

export function verificationIdentityKey(identity: VerificationIdentity, secret: string) {
  const normalized = normalizeVerificationIdentity(identity);
  return createHmac("sha256", secret)
    .update(
      `cobranzapp:verification-network:v1:${normalized.country}:${normalized.documentType}:${normalized.documentNumber}`,
      "utf8",
    )
    .digest();
}
