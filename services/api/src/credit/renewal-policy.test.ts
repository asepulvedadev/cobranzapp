import { buildSchedulePreview } from "@cobranzapp/financial";
import { describe, expect, it } from "vitest";
import { renewalPaymentProgress, renewedPrincipalFromSchedule } from "./renewal-policy.js";

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

  it("renews the outstanding principal plus the new cash and charges a new full interest cycle", () => {
    const current = buildSchedulePreview({
      principal: "300",
      termCount: 6,
      paymentFrequency: "weekly",
      rateBasis: "flat_total",
      nominalRate: "20",
      documentationFeeRate: "0",
      startDate: "2026-10-16",
    });
    const renewedPrincipal = renewedPrincipalFromSchedule(current, 2, "60");
    const renewed = buildSchedulePreview({
      principal: renewedPrincipal,
      termCount: 6,
      paymentFrequency: "weekly",
      rateBasis: "flat_total",
      nominalRate: "20",
      documentationFeeRate: "0",
      startDate: "2026-11-01",
    });

    expect(renewedPrincipal).toBe("300.00");
    expect(renewed.interestTotal).toBe("60.00");
    expect(renewed.scheduledTotal).toBe("360.00");
  });
});
