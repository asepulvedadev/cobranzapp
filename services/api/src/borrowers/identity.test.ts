import { describe, expect, it } from "vitest";
import { normalizeBorrowerAddress } from "./identity.js";

describe("borrower address normalization", () => {
  it("preserves the address wording while collapsing pasted whitespace", () => {
    expect(normalizeBorrowerAddress("  Calle 10  #  20-30,\nBogotá  ")).toBe(
      "Calle 10 # 20-30, Bogotá",
    );
  });

  it("rejects addresses that are too short", () => {
    expect(() => normalizeBorrowerAddress("ab")).toThrow("INVALID_BORROWER_ADDRESS");
  });

  it("rejects unbounded pasted values", () => {
    expect(() => normalizeBorrowerAddress("a".repeat(241))).toThrow("INVALID_BORROWER_ADDRESS");
  });
});
