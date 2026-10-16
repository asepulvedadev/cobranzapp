import { describe, expect, it } from "vitest";
import { renewalPaymentProgress } from "./renewal-policy.js";

const schedule = {
  scheduledTotal: "125000.00",
  periods: [
    { installment: "25000.00" },
    { installment: "25000.00" },
    { installment: "25000.00" },
    { installment: "25000.00" },
    { installment: "25000.00" },
  ],
};

describe("renewalPaymentProgress", () => {
  it("requires at least forty percent of principal plus interest", () => {
    expect(renewalPaymentProgress(schedule, 1)).toMatchObject({
      paidAmount: "25000.00",
      paidPercentage: 20,
      eligible: false,
    });
    expect(renewalPaymentProgress(schedule, 2)).toMatchObject({
      paidAmount: "50000.00",
      paidPercentage: 40,
      eligible: true,
      requiredPercentage: 40,
    });
  });

  it("uses money paid instead of the number of installments", () => {
    const unevenSchedule = {
      scheduledTotal: "100.00",
      periods: [{ installment: "39.99" }, { installment: "60.01" }],
    };
    expect(renewalPaymentProgress(unevenSchedule, 1).eligible).toBe(false);
  });
});
