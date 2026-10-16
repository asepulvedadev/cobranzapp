"use client";

import { type FormEvent, useState } from "react";
import { formatCop, normalizeCopInput } from "../../../../lib/financial-display";
import type { LoanProduct } from "../../../../lib/platform";
import { Modal } from "../../Modal";
import { useSensitiveFetch } from "../../ReauthenticationProvider";

const frequencyLabels: Record<LoanProduct["paymentFrequency"], string> = {
  daily: "diarias",
  weekly: "semanales",
  fortnightly: "quincenales",
  monthly: "mensuales",
};

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
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [principal, setPrincipal] = useState(product.principalMin.split(".")[0] ?? "");

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
          principal: normalizeCopInput(principal),
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
    <>
      <button className="primary-action compact-action" onClick={() => setOpen(true)} type="button">
        Simular cuotas
      </button>
      {open ? (
        <Modal
          className="schedule-preview-modal"
          onClose={() => setOpen(false)}
          title="Simular cuotas"
        >
          <div className="schedule-modal-context">
            <strong>{product.name}</strong>
            <span>
              {product.nominalRate}% de interés total · cuotas{" "}
              {frequencyLabels[product.paymentFrequency]}
            </span>
          </div>
          <p className="form-help">
            Esta simulación no crea deuda, no aprueba el crédito y no registra pagos.
          </p>
          <form className="tenant-form compact-form schedule-preview-form" onSubmit={submit}>
            <div className="borrower-form-row">
              <label>
                Monto a prestar
                <span className="financial-input-shell">
                  <b>COP</b>
                  <input
                    inputMode="numeric"
                    name="principal"
                    onChange={(event) => setPrincipal(event.target.value)}
                    pattern="[0-9]+"
                    required
                    value={principal}
                  />
                </span>
              </label>
              <label>
                Número de cuotas
                <input
                  defaultValue={product.termCount}
                  max={product.termCount}
                  min="1"
                  name="termCount"
                  required
                  type="number"
                />
              </label>
            </div>
            <label>
              Fecha estimada del desembolso
              <input
                defaultValue={product.createdAt.slice(0, 10)}
                name="startDate"
                required
                type="date"
              />
            </label>
            <button disabled={busy} type="submit">
              {busy ? "Calculando…" : "Calcular cuotas"}
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
                  Recibe<strong>{formatCop(preview.netDisbursement)}</strong>
                </span>
                <span>
                  Interés total<strong>{formatCop(preview.interestTotal)}</strong>
                </span>
                <span className="schedule-total-emphasis">
                  Total a pagar<strong>{formatCop(preview.scheduledTotal)}</strong>
                </span>
                <span>
                  Valor aproximado de cuota
                  <strong>{formatCop(preview.periods[0]?.installment ?? "0")}</strong>
                </span>
              </div>
              <small>
                Tasa por periodo: {preview.periodicRate}% · Otros cargos:{" "}
                {formatCop(preview.documentationFee)}
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
                        <td data-label="Cuota">{period.period}</td>
                        <td data-label="Vence">{period.dueDate}</td>
                        <td data-label="Capital">{formatCop(period.principal)}</td>
                        <td data-label="Interés">{formatCop(period.interest)}</td>
                        <td data-label="Total">{formatCop(period.installment)}</td>
                        <td data-label="Saldo">{formatCop(period.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </Modal>
      ) : null}
    </>
  );
}
