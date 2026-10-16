const copFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export function formatCop(value: string | number) {
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) ? copFormatter.format(amount) : "—";
}

export function normalizeCopInput(value: string) {
  return value.replace(/\D/g, "");
}

export function formatCopInput(value: string) {
  const digits = normalizeCopInput(value).replace(/^0+(?=\d)/, "");
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function normalizeRateInput(value: string) {
  const trimmed = value.trim();
  const digits = (trimmed.split(/[.,]/, 1)[0] ?? "").replace(/\D/g, "");
  return trimmed.startsWith("-") ? `-${digits}` : digits;
}

export function formatPercentage(value: string | number) {
  const rate = typeof value === "number" ? value : Number(value);
  return Number.isFinite(rate) ? String(Math.round(rate)) : "—";
}

export function flatRateTotal(principal: string, rate: string) {
  const parsedPrincipal = Number(normalizeCopInput(principal));
  const parsedRate = Number(normalizeRateInput(rate));
  if (!Number.isFinite(parsedPrincipal) || !Number.isFinite(parsedRate)) return null;
  if (parsedPrincipal <= 0 || parsedRate < 0) return null;
  return parsedPrincipal * (1 + parsedRate / 100);
}
