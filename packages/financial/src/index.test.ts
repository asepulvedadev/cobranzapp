import { describe, expect, it } from "vitest";
import { buildSchedulePreview } from "./index.js";

describe("buildSchedulePreview", () => {
  it("supports daily flat products and puts the final date one day after disbursement", () => {
    const result = buildSchedulePreview({
      principal: "100000",
      termCount: 3,
      paymentFrequency: "daily",
      rateBasis: "flat_total",
      nominalRate: "10",
      documentationFeeRate: "10",
      startDate: "2026-10-12",
    });
    expect(result.netDisbursement).toBe("90000.00");
    expect(result.interestTotal).toBe("10000.00");
    expect(result.scheduledTotal).toBe("110000.00");
    expect(result.periods.map((period) => period.dueDate)).toEqual([
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
    ]);
    expect(result.periods.map(({ interest, principal }) => ({ interest, principal }))).toEqual([
      { interest: "10000.00", principal: "26666.68" },
      { interest: "0.00", principal: "36666.66" },
      { interest: "0.00", principal: "36666.66" },
    ]);
    expect(result.periods.at(-1)?.balance).toBe("0.00");
  });

  it("charges all interest before amortizing principal", () => {
    const result = buildSchedulePreview({
      principal: "300",
      termCount: 6,
      paymentFrequency: "weekly",
      rateBasis: "flat_total",
      nominalRate: "20",
      documentationFeeRate: "0",
      startDate: "2026-10-16",
    });

    expect(
      result.periods.map(({ installment, interest, principal, balance }) => ({
        installment,
        interest,
        principal,
        balance,
      })),
    ).toEqual([
      { installment: "60.00", interest: "60.00", principal: "0.00", balance: "300.00" },
      { installment: "60.00", interest: "0.00", principal: "60.00", balance: "240.00" },
      { installment: "60.00", interest: "0.00", principal: "60.00", balance: "180.00" },
      { installment: "60.00", interest: "0.00", principal: "60.00", balance: "120.00" },
      { installment: "60.00", interest: "0.00", principal: "60.00", balance: "60.00" },
      { installment: "60.00", interest: "0.00", principal: "60.00", balance: "0.00" },
    ]);
  });

  it("supports fortnightly simple interest and allocates the remaining balance", () => {
    const result = buildSchedulePreview({
      principal: "100000",
      termCount: 2,
      paymentFrequency: "fortnightly",
      rateBasis: "periodic_simple",
      nominalRate: "5",
      documentationFeeRate: "0",
      startDate: "2026-01-31",
    });
    expect(result.periods.map((period) => period.dueDate)).toEqual(["2026-02-14", "2026-02-28"]);
    expect(result.periods.map((period) => period.installment)).toEqual(["55000.00", "52500.00"]);
    expect(result.scheduledTotal).toBe("107500.00");
  });

  it("supports monthly effective annual rates and keeps the last balance at zero", () => {
    const result = buildSchedulePreview({
      principal: "1000000",
      termCount: 12,
      paymentFrequency: "monthly",
      rateBasis: "effective_annual",
      nominalRate: "24",
      documentationFeeRate: "1",
      startDate: "2026-01-31",
    });
    expect(result.periods[0]?.dueDate).toBe("2026-02-28");
    expect(result.periods).toHaveLength(12);
    expect(result.periods.at(-1)?.balance).toBe("0.00");
    expect(result.totalCost).toMatch(/^\d+\.\d{2}$/);
  });

  it("rejects invalid calendar dates", () => {
    expect(() =>
      buildSchedulePreview({
        principal: "1000",
        termCount: 1,
        paymentFrequency: "daily",
        rateBasis: "flat_total",
        nominalRate: "0",
        documentationFeeRate: "0",
        startDate: "2026-02-30",
      }),
    ).toThrow("INVALID_DATE");
  });
});
