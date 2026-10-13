"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import type { LoanProduct } from "../../../../lib/platform";
import { Modal } from "../../Modal";
import { useSensitiveFetch } from "../../ReauthenticationProvider";

const frequencyLabels: Record<LoanProduct["paymentFrequency"], string> = {
  daily: "Diaria",
  weekly: "Semanal",
  fortnightly: "Quincenal",
  monthly: "Mensual",
};

const rateBasisLabels: Record<LoanProduct["rateBasis"], string> = {
  flat_total: "Tasa plana total",
  periodic_simple: "Tasa simple por periodo",
  effective_annual: "Efectiva anual",
};

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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError(false);
    const form = new FormData(event.currentTarget);
    const response = await sensitiveFetch(
      `/api/v1/tenants/${tenantId}/loan-products/${product.id}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: product.name,
          principalMin: "1",
          principalMax: String(form.get("principalMax") ?? "").trim(),
          termCount: product.termCount,
          paymentFrequency: product.paymentFrequency,
          rateBasis: "flat_total",
          nominalRate: String(form.get("nominalRate") ?? "").trim(),
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
    setMessage("Regla ajustada. La frecuencia y el plazo se eligen al crear cada crédito.");
    setBusy(false);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button className="secondary-action-button" onClick={() => setOpen(true)} type="button">
        Ajustar intereses y cobro
      </button>
      {open ? (
        <Modal onClose={() => setOpen(false)} title="Ajustar producto de crédito">
          <form className="tenant-form compact-form credit-product-editor" onSubmit={submit}>
            <div className="credit-product-editor-heading">
              <strong>Ajustar producto</strong>
              <small>
                {frequencyLabels[product.paymentFrequency]} · {rateBasisLabels[product.rateBasis]}
              </small>
            </div>
            <label>
              Monto máximo por crédito (COP)
              <input
                defaultValue={product.principalMax}
                inputMode="decimal"
                name="principalMax"
                required
              />
            </label>
            <label>
              Porcentaje de interés total
              <input
                defaultValue={product.nominalRate}
                inputMode="decimal"
                name="nominalRate"
                required
              />
            </label>
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
                {busy ? "Guardando…" : "Guardar ajustes"}
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
