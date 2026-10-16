import { describe, expect, it } from "vitest";
import {
  flatRateTotal,
  formatCopInput,
  formatPercentage,
  normalizeCopInput,
  normalizeRateInput,
} from "./financial-display";

describe("financial display input helpers", () => {
  it("normalizes Colombian-friendly values before sending them to the API", () => {
    expect(normalizeCopInput("$ 5.000.000")).toBe("5000000");
    expect(formatCopInput("5000000")).toBe("5.000.000");
    expect(formatCopInput("$ 05.000.000")).toBe("5.000.000");
    expect(normalizeRateInput("10,5")).toBe("10");
    expect(formatPercentage("20.00000000")).toBe("20");
  });

  it("previews a flat total rate without applying the percentage twice", () => {
    expect(flatRateTotal("5000000", "10")).toBe(5_500_000);
  });

  it("rejects incomplete or negative preview values", () => {
    expect(flatRateTotal("", "10")).toBeNull();
    expect(flatRateTotal("100000", "-1")).toBeNull();
  });
});
