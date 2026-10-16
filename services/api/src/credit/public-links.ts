import { createHmac, timingSafeEqual } from "node:crypto";

function signature(secret: string, purpose: string, value: string) {
  return createHmac("sha256", secret).update(`${purpose}\0${value}`).digest("base64url");
}

function matches(left: string, right: string) {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

export function createBorrowerPortalToken(secret: string, borrowerId: string, nonce: string) {
  const payload = `${borrowerId}.${nonce}`;
  return `${payload}.${signature(secret, "borrower-portal", payload)}`;
}

export function parseBorrowerPortalToken(secret: string, token: string) {
  const [borrowerId, nonce, supplied, extra] = token.split(".");
  if (extra || !borrowerId || !nonce || !supplied) return null;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(borrowerId) || !uuid.test(nonce)) return null;
  const payload = `${borrowerId}.${nonce}`;
  return matches(supplied, signature(secret, "borrower-portal", payload))
    ? { borrowerId, nonce }
    : null;
}

export function createPaymentReceiptToken(secret: string, paymentId: string) {
  return `${paymentId}.${signature(secret, "payment-receipt", paymentId)}`;
}

export function parsePaymentReceiptToken(secret: string, token: string) {
  const [paymentId, supplied, extra] = token.split(".");
  if (extra || !paymentId || !supplied) return null;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(paymentId)
  ) {
    return null;
  }
  return matches(supplied, signature(secret, "payment-receipt", paymentId)) ? paymentId : null;
}
