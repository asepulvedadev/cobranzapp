export type PaymentFrequency = "daily" | "weekly" | "fortnightly" | "monthly";
export type RateBasis = "flat_total" | "periodic_simple" | "effective_annual";

export type SchedulePreviewInput = {
  principal: string;
  termCount: number;
  paymentFrequency: PaymentFrequency;
  rateBasis: RateBasis;
  nominalRate: string;
  documentationFeeRate: string;
  startDate: string;
};

export type SchedulePeriod = {
  period: number;
  dueDate: string;
  principal: string;
  interest: string;
  installment: string;
  balance: string;
};

export type SchedulePreview = {
  currency: "COP";
  principal: string;
  documentationFee: string;
  netDisbursement: string;
  interestTotal: string;
  scheduledTotal: string;
  totalCost: string;
  periodicRate: string;
  periods: SchedulePeriod[];
};

const CENTS = 100n;
const RATE_SCALE = 100_000_000n;
const DAILY_PERIODS_PER_YEAR: Record<PaymentFrequency, number> = {
  daily: 365,
  weekly: 52,
  fortnightly: 26,
  monthly: 12,
};

function parseDecimal(value: string, scale: bigint, maxDecimals: number) {
  const match = /^\d+(?:\.(\d+))?$/.exec(value.trim());
  if (!match) throw new Error("INVALID_DECIMAL");
  const integer = value.trim().split(".")[0] ?? "0";
  const fraction = match[1] ?? "";
  if (fraction.length > maxDecimals) throw new Error("INVALID_DECIMAL_PRECISION");
  return (
    BigInt(integer) * scale + BigInt((fraction + "0".repeat(maxDecimals)).slice(0, maxDecimals))
  );
}

function parseCents(value: string) {
  return parseDecimal(value, CENTS, 2);
}

function parseRate(value: string) {
  return parseDecimal(value, RATE_SCALE, 8);
}

function roundDivide(numerator: bigint, denominator: bigint) {
  if (denominator <= 0n) throw new Error("INVALID_DIVISOR");
  return (numerator + denominator / 2n) / denominator;
}

function formatCents(value: bigint) {
  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;
  return `${sign}${absolute / CENTS}.${(absolute % CENTS).toString().padStart(2, "0")}`;
}

function formatRate(value: number) {
  return value.toFixed(8).replace(/0+$/, "").replace(/\.$/, "") || "0";
}

function parseDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("INVALID_DATE");
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error("INVALID_DATE");
  }
  return date;
}

function addMonths(date: Date, months: number) {
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

function dueDate(startDate: Date, frequency: PaymentFrequency, period: number) {
  const result = new Date(startDate.getTime());
  if (frequency === "daily") result.setUTCDate(result.getUTCDate() + period);
  if (frequency === "weekly") result.setUTCDate(result.getUTCDate() + period * 7);
  if (frequency === "fortnightly") result.setUTCDate(result.getUTCDate() + period * 14);
  if (frequency === "monthly") return addMonths(startDate, period).toISOString().slice(0, 10);
  return result.toISOString().slice(0, 10);
}

function splitAmount(total: bigint, count: number, index: number) {
  const base = total / BigInt(count);
  const remainder = total % BigInt(count);
  return base + (BigInt(index) <= remainder ? 1n : 0n);
}

function periodicRatePercent(rate: bigint, frequency: PaymentFrequency) {
  const annualRate = Number(rate) / Number(RATE_SCALE) / 100;
  const periods = DAILY_PERIODS_PER_YEAR[frequency];
  return ((1 + annualRate) ** (1 / periods) - 1) * 100;
}

function centsFromNumber(value: number) {
  if (!Number.isFinite(value) || value < 0) throw new Error("INVALID_CALCULATION");
  return BigInt(Math.round(value));
}

function allocateInterestFirst(periods: SchedulePeriod[], principal: bigint) {
  let remainingInterest = periods.reduce(
    (total, period) => total + parseCents(period.interest),
    0n,
  );
  let remainingPrincipal = principal;

  return periods.map((period, index) => {
    const installment = parseCents(period.installment);
    const interest = remainingInterest < installment ? remainingInterest : installment;
    const availableForPrincipal = installment - interest;
    const principalPart =
      index === periods.length - 1 || remainingPrincipal < availableForPrincipal
        ? remainingPrincipal
        : availableForPrincipal;
    remainingInterest -= interest;
    remainingPrincipal -= principalPart;
    return {
      ...period,
      principal: formatCents(principalPart),
      interest: formatCents(interest),
      installment: formatCents(principalPart + interest),
      balance: formatCents(remainingPrincipal),
    };
  });
}

/**
 * Builds a preview only. It never posts a loan, payment, journal or receipt.
 * The owner controls the product rate and frequency; every installment is rounded
 * to COP cents and the final period absorbs the remainder.
 */
export function buildSchedulePreview(input: SchedulePreviewInput): SchedulePreview {
  if (!Number.isInteger(input.termCount) || input.termCount < 1 || input.termCount > 365) {
    throw new Error("INVALID_TERM_COUNT");
  }
  const principal = parseCents(input.principal);
  const rate = parseRate(input.nominalRate);
  const feeRate = parseRate(input.documentationFeeRate);
  const startDate = parseDate(input.startDate);
  const ratePercent = Number(rate) / Number(RATE_SCALE);
  const documentationFee = roundDivide(principal * feeRate, 100n * RATE_SCALE);
  const principalParts = Array.from({ length: input.termCount }, (_, index) =>
    splitAmount(principal, input.termCount, index + 1),
  );
  const periods: SchedulePeriod[] = [];
  let balance = principal;

  if (input.rateBasis === "flat_total") {
    const totalInterest = roundDivide(principal * rate, 100n * RATE_SCALE);
    const interestParts = Array.from({ length: input.termCount }, (_, index) =>
      splitAmount(totalInterest, input.termCount, index + 1),
    );
    for (let index = 0; index < input.termCount; index += 1) {
      const principalPart = principalParts[index] ?? 0n;
      const interestPart = interestParts[index] ?? 0n;
      balance -= principalPart;
      periods.push({
        period: index + 1,
        dueDate: dueDate(startDate, input.paymentFrequency, index + 1),
        principal: formatCents(principalPart),
        interest: formatCents(interestPart),
        installment: formatCents(principalPart + interestPart),
        balance: formatCents(balance),
      });
    }
  } else if (input.rateBasis === "periodic_simple") {
    for (let index = 0; index < input.termCount; index += 1) {
      const principalPart = principalParts[index] ?? 0n;
      const interestPart = roundDivide(balance * rate, 100n * RATE_SCALE);
      balance -= principalPart;
      periods.push({
        period: index + 1,
        dueDate: dueDate(startDate, input.paymentFrequency, index + 1),
        principal: formatCents(principalPart),
        interest: formatCents(interestPart),
        installment: formatCents(principalPart + interestPart),
        balance: formatCents(balance),
      });
    }
  } else {
    const periodicRate = periodicRatePercent(rate, input.paymentFrequency) / 100;
    const principalNumber = Number(principal);
    const paymentNumber =
      periodicRate === 0
        ? principalNumber / input.termCount
        : (principalNumber * periodicRate) / (1 - (1 + periodicRate) ** -input.termCount);
    const regularPayment = centsFromNumber(paymentNumber);
    for (let index = 0; index < input.termCount; index += 1) {
      const interestPart = centsFromNumber(Number(balance) * periodicRate);
      const principalPart = index === input.termCount - 1 ? balance : regularPayment - interestPart;
      const installment = principalPart + interestPart;
      balance -= principalPart;
      periods.push({
        period: index + 1,
        dueDate: dueDate(startDate, input.paymentFrequency, index + 1),
        principal: formatCents(principalPart),
        interest: formatCents(interestPart),
        installment: formatCents(installment),
        balance: formatCents(balance),
      });
    }
  }

  const interestFirstPeriods = allocateInterestFirst(periods, principal);
  const interestTotal = interestFirstPeriods.reduce(
    (sum, period) => sum + parseCents(period.interest),
    0n,
  );
  const scheduledTotal = interestFirstPeriods.reduce(
    (sum, period) => sum + parseCents(period.installment),
    0n,
  );
  return {
    currency: "COP",
    principal: formatCents(principal),
    documentationFee: formatCents(documentationFee),
    netDisbursement: formatCents(principal - documentationFee),
    interestTotal: formatCents(interestTotal),
    scheduledTotal: formatCents(scheduledTotal),
    totalCost: formatCents(scheduledTotal + documentationFee),
    periodicRate:
      input.rateBasis === "effective_annual"
        ? formatRate(periodicRatePercent(rate, input.paymentFrequency))
        : formatRate(ratePercent),
    periods: interestFirstPeriods,
  };
}
