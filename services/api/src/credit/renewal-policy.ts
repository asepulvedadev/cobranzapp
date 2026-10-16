export const renewalRequiredPercentage = 40 as const;

type RenewalSchedule = {
  scheduledTotal: string;
  periods: { installment: string; principal?: string }[];
};

function parseCents(value: string) {
  const [integer, fraction = ""] = value.split(".");
  return BigInt(integer ?? "0") * 100n + BigInt(fraction.padEnd(2, "0").slice(0, 2));
}

function formatCents(value: bigint) {
  return `${value / 100n}.${(value % 100n).toString().padStart(2, "0")}`;
}

export function renewalPaymentProgress(schedule: RenewalSchedule, paidInstallments: number) {
  const paid = schedule.periods
    .slice(0, paidInstallments)
    .reduce((total, period) => total + parseCents(period.installment), 0n);
  const total = parseCents(schedule.scheduledTotal);
  const eligible = total > 0n && paid * 100n >= total * BigInt(renewalRequiredPercentage);
  const percentage = total > 0n ? Number((paid * 10_000n) / total) / 100 : 0;

  return {
    paidAmount: formatCents(paid),
    paidPercentage: Math.min(100, percentage),
    eligible,
    requiredPercentage: renewalRequiredPercentage,
  };
}

export function renewedPrincipalFromSchedule(
  schedule: RenewalSchedule,
  paidInstallments: number,
  additionalAmount: string,
) {
  const outstandingPrincipal = schedule.periods
    .slice(paidInstallments)
    .reduce((total, period) => total + parseCents(period.principal ?? "0"), 0n);
  return formatCents(outstandingPrincipal + parseCents(additionalAmount));
}
