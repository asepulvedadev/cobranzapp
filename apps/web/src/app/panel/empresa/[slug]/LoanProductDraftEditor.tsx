"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import {
  formatCopInput,
  formatPercentage,
  normalizeCopInput,
  normalizeRateInput,
} from "../../../../lib/financial-display";
import type { LoanProduct } from "../../../../lib/platform";
import { Modal } from "../../Modal";
import { useSensitiveFetch } from "../../ReauthenticationProvider";
import { FinancialRuleSummary } from "./FinancialRuleSummary";

export function LoanProductDraftEditor({
  product,
  tenantId,
}: {
  product: LoanProduct;
  tenantId: string;
}) {
  const router = useRouter();
  const sensitiveFetch = useSensitiveFetch();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [principalMax, setPrincipalMax] = useState(
    formatCopInput(product.principalMax.split(".")[0] ?? ""),
  );
  const [nominalRate, setNominalRate] = useState(formatPercentage(product.nominalRate));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError(false);
    const response = await sensitiveFetch(
      `/api/v1/tenants/${tenantId}/loan-products/${product.id}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: product.name,
          principalMin: "1",
          principalMax: normalizeCopInput(principalMax),
          termCount: product.termCount,
          paymentFrequency: product.paymentFrequency,
          rateBasis: "flat_total",
          nominalRate: normalizeRateInput(nominalRate),
          documentationFeeRate: "0",
          complianceSourceRef: "configuracion-automatica",
        }),
      },
    ).catch(() => null);
    if (!response?.ok) {
      const body = (await response?.json().catch(() => ({}))) as { error?: { message?: string } };
      setMessage(body.error?.message ?? "No fue posible ajustar el producto.");
      setError(true);
      setBusy(false);
      return;
    }
    setBusy(false);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button className="secondary-action-button" onClick={() => setOpen(true)} type="button">
        Editar regla
      </button>
      {open ? (
        <Modal
          className="financial-rule-modal"
          onClose={() => setOpen(false)}
          title="Editar producto de crédito"
        >
          <form className="tenant-form credit-product-form" onSubmit={submit}>
            <div className="financial-form-intro">
              <strong>{product.name}</strong>
              <p>Comprueba el total estimado antes de guardar los cambios.</p>
            </div>
            <label>
              Monto máximo por crédito
              <span className="financial-input-shell">
                <b>COP</b>
                <input
                  inputMode="numeric"
                  name="principalMax"
                  onChange={(event) => setPrincipalMax(formatCopInput(event.target.value))}
                  pattern="[0-9.]+"
                  required
                  value={principalMax}
                />
              </span>
              <small>Los puntos de miles se agregan automáticamente.</small>
            </label>
            <label>
              Interés total sobre el préstamo
              <span className="financial-input-shell financial-rate-input">
                <input
                  inputMode="numeric"
                  name="nominalRate"
                  onChange={(event) => setNominalRate(normalizeRateInput(event.target.value))}
                  pattern="[0-9]+"
                  required
                  value={nominalRate}
                />
                <b>%</b>
              </span>
              <small>Escribe un porcentaje entero. Ejemplo: 10 significa diez por ciento.</small>
            </label>
            <FinancialRuleSummary principal={principalMax} rate={nominalRate} />
            {message ? (
              <p
                className={`tenant-form-message${error ? " form-message-error" : ""}`}
                role="status"
              >
                {message}
              </p>
            ) : null}
            <div className="credit-product-editor-actions">
              <button disabled={busy} type="submit">
                {busy ? "Guardando…" : "Guardar cambios"}
              </button>
              <button disabled={busy} onClick={() => setOpen(false)} type="button">
                Cancelar
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </>
  );
}
