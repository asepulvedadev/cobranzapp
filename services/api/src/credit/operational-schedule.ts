import type { LoanApplication } from "@cobranzapp/contracts";

export type OperationalPaymentInput = {
  status: LoanApplication["status"];
  paymentFrequency: LoanApplication["paymentFrequency"];
  requestedTermCount: number;
  paidInstallments: number;
  createdAt: Date;
};

export function addMonths(date: Date, months: number) {
  const result = new Date(date.getTime());
  const originalDay = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(originalDay, lastDay));
  return result;
}

export function dueDateFor(
  startDate: Date,
  frequency: LoanApplication["paymentFrequency"],
  period: number,
) {
  const result = new Date(startDate.getTime());
  if (frequency === "daily") result.setUTCDate(result.getUTCDate() + period);
  if (frequency === "weekly") result.setUTCDate(result.getUTCDate() + period * 7);
  if (frequency === "fortnightly") result.setUTCDate(result.getUTCDate() + period * 14);
  if (frequency === "monthly") return addMonths(startDate, period);
  return result;
}

export function operationalPaymentState(row: OperationalPaymentInput, now = new Date()) {
  if (row.status !== "active" || row.paidInstallments >= row.requestedTermCount) {
    return { nextDueDate: null, overdueInstallments: 0 };
  }
  const today = new Date(now.getTime());
  today.setUTCHours(0, 0, 0, 0);
  const nextPeriod = row.paidInstallments + 1;
  let overdueInstallments = 0;
  for (let period = nextPeriod; period <= row.requestedTermCount; period += 1) {
    if (dueDateFor(row.createdAt, row.paymentFrequency, period).getTime() < today.getTime()) {
      overdueInstallments += 1;
    }
  }
  return {
    nextDueDate: dueDateFor(row.createdAt, row.paymentFrequency, nextPeriod)
      .toISOString()
      .slice(0, 10),
    overdueInstallments,
  };
}
