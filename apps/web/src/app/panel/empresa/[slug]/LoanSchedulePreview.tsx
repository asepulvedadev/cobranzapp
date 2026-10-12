"use client";

import { type FormEvent, useState } from "react";
import type { LoanProduct } from "../../../../lib/platform";
import { useSensitiveFetch } from "../../ReauthenticationProvider";

type Preview = {
  netDisbursement: string;
  documentationFee: string;
  interestTotal: string;
  scheduledTotal: string;
  totalCost: string;
  periodicRate: string;
  periods: Array<{
    period: number;
    dueDate: string;
    principal: string;
    interest: string;
    installment: string;
    balance: string;
  }>;
};

export function LoanSchedulePreview({
  product,
  tenantId,
}: {
  product: LoanProduct;
  tenantId: string;
}) {
  const sensitiveFetch = useSensitiveFetch();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await sensitiveFetch(
      `/api/v1/tenants/${tenantId}/loan-products/${product.id}/schedule-preview`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          principal: String(form.get("principal") ?? "").trim(),
          termCount: Number(form.get("termCount")),
          startDate: String(form.get("startDate") ?? ""),
        }),
      },
    ).catch(() => null);
    if (!response?.ok) {
      const body = (await response?.json().catch(() => ({}))) as { error?: { message?: string } };
      setMessage(body.error?.message ?? "No fue posible proyectar las cuotas.");
      setPreview(null);
      setBusy(false);
      return;
    }
    const body = (await response.json()) as { preview: Preview };
    setPreview(body.preview);
    setBusy(false);
  }

  return (
    <details className="credit-schedule-preview">
      <summary>Ver proyección de cuotas</summary>
      <p className="form-help">Es una proyección informativa. No crea deuda ni registra pagos.</p>
      <form className="tenant-form compact-form" onSubmit={submit}>
        <div className="borrower-form-row">
          <label>
            Monto COP
            <input
              defaultValue={product.principalMin}
              inputMode="decimal"
              name="principal"
              required
            />
          </label>
          <label>
            Periodos
            <input
              defaultValue={product.termCount}
              min="1"
              max={product.termCount}
              name="termCount"
              required
              type="number"
            />
          </label>
        </div>
        <label>
          Fecha de desembolso estimada
          <input
            defaultValue={product.createdAt.slice(0, 10)}
            name="startDate"
            required
            type="date"
          />
        </label>
        <button disabled={busy} type="submit">
          {busy ? "Calculando…" : "Calcular proyección"}
        </button>
      </form>
      {message ? (
        <p className="tenant-form-message form-message-error" role="status">
          {message}
        </p>
      ) : null}
      {preview ? (
        <div className="schedule-preview-result" aria-live="polite">
          <div className="schedule-preview-summary">
            <span>
              Entrega neta<strong>COP {preview.netDisbursement}</strong>
            </span>
            <span>
              Intereses<strong>COP {preview.interestTotal}</strong>
            </span>
            <span>
              Total cuotas<strong>COP {preview.scheduledTotal}</strong>
            </span>
            <span>
              Costo total<strong>COP {preview.totalCost}</strong>
            </span>
          </div>
          <small>
            Tasa por periodo calculada: {preview.periodicRate}% · Cargo documental: COP{" "}
            {preview.documentationFee}
          </small>
          <div className="schedule-preview-table-wrap">
            <table className="schedule-preview-table">
              <thead>
                <tr>
                  <th>Cuota</th>
                  <th>Vence</th>
                  <th>Capital</th>
                  <th>Interés</th>
                  <th>Total</th>
                  <th>Saldo</th>
                </tr>
              </thead>
              <tbody>
                {preview.periods.map((period) => (
                  <tr key={period.period}>
                    <td>{period.period}</td>
                    <td>{period.dueDate}</td>
                    <td>COP {period.principal}</td>
                    <td>COP {period.interest}</td>
                    <td>COP {period.installment}</td>
                    <td>COP {period.balance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </details>
  );
}
