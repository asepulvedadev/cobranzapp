import { describe, expect, it } from "vitest";
import { borrowerDirectorySearchParts } from "./postgres-borrower-service.js";

describe("borrower directory search", () => {
  it("keeps names as text without treating embedded content as a document number", () => {
    expect(borrowerDirectorySearchParts("  Laura Walteros  ")).toEqual({
      text: "Laura Walteros",
      digits: null,
      documentLast4: null,
    });
  });

  it("normalizes formatted phone or identity numbers and searches identities by their last four", () => {
    expect(borrowerDirectorySearchParts("1.234.567.890")).toEqual({
      text: "1.234.567.890",
      digits: "1234567890",
      documentLast4: "7890",
    });
  });

  it("does not create an active filter from whitespace", () => {
    expect(borrowerDirectorySearchParts("   ")).toEqual({
      text: null,
      digits: null,
      documentLast4: null,
    });
  });
});
