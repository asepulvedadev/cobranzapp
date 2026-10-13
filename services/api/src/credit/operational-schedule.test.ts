import { describe, expect, it } from "vitest";
import { dueDateFor, operationalPaymentState } from "./operational-schedule.js";

describe("operational credit schedule", () => {
  it("keeps monthly dates at the end of shorter months", () => {
    const start = new Date("2026-01-31T12:00:00.000Z");
    expect(dueDateFor(start, "monthly", 1).toISOString()).toBe("2026-02-28T12:00:00.000Z");
  });

  it("counts only unpaid periods before today as overdue", () => {
    const state = operationalPaymentState(
      {
        status: "active",
        paymentFrequency: "weekly",
        requestedTermCount: 5,
        paidInstallments: 1,
        createdAt: new Date("2026-01-01T12:00:00.000Z"),
      },
      new Date("2026-01-31T12:00:00.000Z"),
    );
    expect(state).toEqual({ nextDueDate: "2026-01-15", overdueInstallments: 3 });
  });

  it("does not mark completed or non-active credits as overdue", () => {
    expect(
      operationalPaymentState({
        status: "paid",
        paymentFrequency: "daily",
        requestedTermCount: 30,
        paidInstallments: 30,
        createdAt: new Date("2025-01-01T12:00:00.000Z"),
      }),
    ).toEqual({ nextDueDate: null, overdueInstallments: 0 });
  });
});
