import { describe, expect, it } from "vitest";
import {
  createBorrowerPortalToken,
  createPaymentReceiptToken,
  parseBorrowerPortalToken,
  parsePaymentReceiptToken,
} from "./public-links.js";

const secret = "a-secure-public-link-secret-with-at-least-32-characters";
const borrowerId = "94b5de2f-a26d-4ae4-8ae1-bef9b1f583ab";
const nonce = "c5f35c1d-6e63-43ff-b03a-bfe383ca0c8f";
const paymentId = "2653fc66-c243-490c-9ed1-c326375438a5";

describe("public link signatures", () => {
  it("accepts an authentic borrower portal token and rejects a changed nonce", () => {
    const token = createBorrowerPortalToken(secret, borrowerId, nonce);
    expect(parseBorrowerPortalToken(secret, token)).toEqual({ borrowerId, nonce });
    expect(parseBorrowerPortalToken(secret, token.replace(nonce, paymentId))).toBeNull();
  });

  it("accepts an authentic receipt token and rejects a changed payment id", () => {
    const token = createPaymentReceiptToken(secret, paymentId);
    expect(parsePaymentReceiptToken(secret, token)).toBe(paymentId);
    expect(parsePaymentReceiptToken(secret, token.replace(paymentId, borrowerId))).toBeNull();
  });
});
