import {
  flatRateTotal,
  formatCop,
  normalizeCopInput,
  normalizeRateInput,
} from "../../../../lib/financial-display";

export function FinancialRuleSummary({ principal, rate }: { principal: string; rate: string }) {
  const normalizedPrincipal = normalizeCopInput(principal);
  const normalizedRate = normalizeRateInput(rate);
  const total = flatRateTotal(normalizedPrincipal, normalizedRate);
  const interest = total === null ? null : total - Number(normalizedPrincipal);

  return (
    <div aria-live="polite" className="financial-rule-summary">
      <span>Vista previa</span>
      {total === null ? (
        <p>Escribe el monto y el porcentaje para comprobar el resultado antes de guardar.</p>
      ) : (
        <dl>
          <div>
            <dt>Monto prestado</dt>
            <dd>{formatCop(normalizedPrincipal)}</dd>
          </div>
          <div>
            <dt>Interés ({normalizedRate}%)</dt>
            <dd>{formatCop(interest ?? 0)}</dd>
          </div>
          <div>
            <dt>Total en cuotas</dt>
            <dd>{formatCop(total)}</dd>
          </div>
        </dl>
      )}
      <small>
        Ejemplo con tasa plana total. La simulación exacta distribuye redondeos entre cuotas.
      </small>
    </div>
  );
}
