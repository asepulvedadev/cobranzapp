"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import type { LoanProduct } from "../../../../lib/platform";
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
          name: String(form.get("name") ?? "").trim(),
          principalMin: String(form.get("principalMin") ?? "").trim(),
          principalMax: String(form.get("principalMax") ?? "").trim(),
          termCount: Number(form.get("termCount")),
          paymentFrequency: String(form.get("paymentFrequency") ?? "daily"),
          rateBasis: String(form.get("rateBasis") ?? "flat_total"),
          nominalRate: String(form.get("nominalRate") ?? "").trim(),
          documentationFeeRate: String(form.get("documentationFeeRate") ?? "0").trim(),
          complianceSourceRef: String(form.get("complianceSourceRef") ?? "").trim() || null,
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
    setMessage("Producto ajustado. La revisión normativa debe iniciarse de nuevo.");
    setBusy(false);
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button className="secondary-action-button" onClick={() => setOpen(true)} type="button">
        Ajustar intereses y cobro
      </button>
    );
  }

  return (
    <form className="tenant-form compact-form credit-product-editor" onSubmit={submit}>
      <div className="credit-product-editor-heading">
        <strong>Ajustar producto</strong>
        <small>
          {frequencyLabels[product.paymentFrequency]} · {rateBasisLabels[product.rateBasis]}
        </small>
      </div>
      <label>
        Nombre interno
        <input defaultValue={product.name} maxLength={120} name="name" required />
      </label>
      <div className="borrower-form-row">
        <label>
          Mínimo COP
          <input
            defaultValue={product.principalMin}
            inputMode="decimal"
            name="principalMin"
            required
          />
        </label>
        <label>
          Máximo COP
          <input
            defaultValue={product.principalMax}
            inputMode="decimal"
            name="principalMax"
            required
          />
        </label>
      </div>
      <div className="borrower-form-row">
        <label>
          Periodos
          <input defaultValue={product.termCount} min="1" name="termCount" required type="number" />
        </label>
        <label>
          Frecuencia
          <select defaultValue={product.paymentFrequency} name="paymentFrequency">
            <option value="daily">Diaria</option>
            <option value="weekly">Semanal</option>
            <option value="fortnightly">Quincenal</option>
            <option value="monthly">Mensual</option>
          </select>
        </label>
      </div>
      <div className="borrower-form-row">
        <label>
          Base de interés
          <select defaultValue={product.rateBasis} name="rateBasis">
            <option value="flat_total">Tasa plana total</option>
            <option value="periodic_simple">Tasa simple por periodo</option>
            <option value="effective_annual">Efectiva anual</option>
          </select>
        </label>
        <label>
          Tasa configurable
          <input
            defaultValue={product.nominalRate}
            inputMode="decimal"
            name="nominalRate"
            required
          />
        </label>
      </div>
      <label>
        Cargo documental (tasa)
        <input
          defaultValue={product.documentationFeeRate}
          inputMode="decimal"
          name="documentationFeeRate"
          required
        />
      </label>
      <label>
        Referencia normativa
        <input
          defaultValue={product.complianceSourceRef ?? ""}
          maxLength={240}
          name="complianceSourceRef"
        />
      </label>
      {message ? (
        <p className={`tenant-form-message${error ? " form-message-error" : ""}`} role="status">
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
  );
}
