"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import type { LoanProduct } from "../../../../lib/platform";
import { useSensitiveFetch } from "../../ReauthenticationProvider";

const statusLabels: Record<LoanProduct["status"], string> = {
  draft: "Borrador",
  under_review: "En revisión",
  approved: "Aprobado",
  retired: "Retirado",
};

const frequencyLabels: Record<LoanProduct["paymentFrequency"], string> = {
  daily: "Diaria",
  weekly: "Semanal",
  fortnightly: "Quincenal",
  monthly: "Mensual",
};

const rateBasisLabels: Record<LoanProduct["rateBasis"], string> = {
  flat_total: "Tasa plana total",
  periodic_simple: "Tasa simple periódica",
  effective_annual: "Efectiva anual",
};

async function errorMessage(response: Response | null) {
  const body = (await response?.json().catch(() => ({}))) as {
    error?: { message?: string };
  };
  return body.error?.message ?? "No fue posible crear el producto.";
}

export function CreditProductCatalog({
  tenantId,
  products,
}: {
  tenantId: string;
  products: LoanProduct[];
}) {
  const router = useRouter();
  const sensitiveFetch = useSensitiveFetch();
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [reviewingProductId, setReviewingProductId] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsBusy(true);
    setMessage("");
    setIsError(false);
    const form = new FormData(event.currentTarget);
    const response = await sensitiveFetch(`/api/v1/tenants/${tenantId}/loan-products`, {
      method: "POST",
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
    }).catch(() => null);
    if (!response?.ok) {
      setMessage(await errorMessage(response));
      setIsError(true);
      setIsBusy(false);
      return;
    }
    event.currentTarget.reset();
    setMessage("Producto creado como borrador. Todavía no puede desembolsar créditos.");
    setIsBusy(false);
    router.refresh();
  }

  async function submitForReview(product: LoanProduct) {
    setReviewingProductId(product.id);
    setMessage("");
    setIsError(false);
    const response = await sensitiveFetch(
      `/api/v1/tenants/${tenantId}/loan-products/${product.id}/review`,
      { method: "POST" },
    ).catch(() => null);
    if (!response?.ok) {
      setMessage(await errorMessage(response));
      setIsError(true);
      setReviewingProductId(null);
      return;
    }
    setMessage(`El producto “${product.name}” quedó enviado a revisión.`);
    setReviewingProductId(null);
    router.refresh();
  }

  return (
    <section className="dashboard-card credit-product-card" id="productos-credito">
      <div className="card-heading">
        <div>
          <span className="panel-eyebrow">Núcleo financiero</span>
          <h2>Productos de crédito</h2>
        </div>
        <span>{products.length} configurados</span>
      </div>
      <p className="operational-note">
        Los productos se guardan como borradores versionables. La aprobación legal y contable es
        obligatoria antes de habilitar solicitudes o desembolsos.
      </p>
      {products.length ? (
        <div className="credit-product-list">
          {products.map((product) => (
            <article className="credit-product-item" key={product.id}>
              <div className="credit-product-item-heading">
                <div>
                  <strong>{product.name}</strong>
                  <small>
                    {frequencyLabels[product.paymentFrequency]} · {product.termCount} periodos
                  </small>
                </div>
                <span className={`status status-${product.status}`}>
                  {statusLabels[product.status]}
                </span>
              </div>
              <dl>
                <div>
                  <dt>Rango</dt>
                  <dd>
                    {product.currency} {product.principalMin} – {product.principalMax}
                  </dd>
                </div>
                <div>
                  <dt>Base de tasa</dt>
                  <dd>{rateBasisLabels[product.rateBasis]}</dd>
                </div>
                <div>
                  <dt>Tasa nominal</dt>
                  <dd>{product.nominalRate}</dd>
                </div>
                <div>
                  <dt>Regla</dt>
                  <dd>
                    {product.complianceStatus === "approved"
                      ? "Fuente aprobada"
                      : "Pendiente de revisión"}
                  </dd>
                </div>
              </dl>
              {product.status === "draft" ? (
                <div className="credit-product-review-actions">
                  {product.complianceSourceRef ? (
                    <button
                      disabled={reviewingProductId !== null}
                      onClick={() => void submitForReview(product)}
                      type="button"
                    >
                      {reviewingProductId === product.id ? "Enviando…" : "Enviar a revisión"}
                    </button>
                  ) : (
                    <small className="form-help">
                      Agrega una referencia normativa para habilitar la revisión.
                    </small>
                  )}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
      <form className="tenant-form credit-product-form" onSubmit={submit}>
        <h3>Nuevo borrador</h3>
        <label htmlFor="loan-product-name">Nombre comercial interno</label>
        <input id="loan-product-name" maxLength={120} name="name" required />
        <div className="borrower-form-row">
          <label>
            Mínimo COP
            <input
              inputMode="decimal"
              name="principalMin"
              pattern="[0-9]+(\\.[0-9]{1,2})?"
              required
            />
          </label>
          <label>
            Máximo COP
            <input
              inputMode="decimal"
              name="principalMax"
              pattern="[0-9]+(\\.[0-9]{1,2})?"
              required
            />
          </label>
        </div>
        <div className="borrower-form-row">
          <label>
            Periodos
            <input
              defaultValue="30"
              inputMode="numeric"
              min="1"
              name="termCount"
              required
              type="number"
            />
          </label>
          <label>
            Frecuencia
            <select defaultValue="daily" name="paymentFrequency">
              <option value="daily">Diaria</option>
              <option value="weekly">Semanal</option>
              <option value="fortnightly">Quincenal</option>
              <option value="monthly">Mensual</option>
            </select>
          </label>
        </div>
        <div className="borrower-form-row">
          <label>
            Base de tasa
            <select defaultValue="flat_total" name="rateBasis">
              <option value="flat_total">Tasa plana total</option>
              <option value="periodic_simple">Tasa simple periódica</option>
              <option value="effective_annual">Efectiva anual</option>
            </select>
          </label>
          <label>
            Tasa nominal
            <input
              inputMode="decimal"
              name="nominalRate"
              pattern="[0-9]+(\\.[0-9]{1,8})?"
              required
            />
          </label>
        </div>
        <label htmlFor="loan-product-documentation-fee">Cargo documental (tasa)</label>
        <input
          id="loan-product-documentation-fee"
          defaultValue="0"
          inputMode="decimal"
          name="documentationFeeRate"
          pattern="[0-9]+(\\.[0-9]{1,8})?"
          required
        />
        <label htmlFor="loan-product-compliance-source">Referencia normativa (opcional)</label>
        <input id="loan-product-compliance-source" maxLength={240} name="complianceSourceRef" />
        {message ? (
          <p className={`tenant-form-message${isError ? " form-message-error" : ""}`} role="status">
            {message}
          </p>
        ) : null}
        <button disabled={isBusy} type="submit">
          {isBusy ? "Guardando…" : "Guardar borrador"}
        </button>
      </form>
    </section>
  );
}
