"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import type { LoanProduct } from "../../../../lib/platform";
import { Modal } from "../../Modal";
import { useSensitiveFetch } from "../../ReauthenticationProvider";
import { LoanProductDraftEditor } from "./LoanProductDraftEditor";
import { LoanSchedulePreview } from "./LoanSchedulePreview";

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
  canConfigure,
  canReview,
  tenantId,
  products,
}: {
  canConfigure: boolean;
  canReview: boolean;
  tenantId: string;
  products: LoanProduct[];
}) {
  const router = useRouter();
  const sensitiveFetch = useSensitiveFetch();
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [reviewingProductId, setReviewingProductId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

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
        name: "Crédito estándar",
        principalMin: "1",
        principalMax: String(form.get("principalMax") ?? "").trim(),
        termCount: 30,
        paymentFrequency: "daily",
        rateBasis: "flat_total",
        nominalRate: String(form.get("nominalRate") ?? "").trim(),
        documentationFeeRate: "0",
        complianceSourceRef: "configuracion-automatica",
      }),
    }).catch(() => null);
    if (!response?.ok) {
      setMessage(await errorMessage(response));
      setIsError(true);
      setIsBusy(false);
      return;
    }
    event.currentTarget.reset();
    setIsCreateOpen(false);
    setMessage("Regla guardada. Los cobradores podrán elegir la frecuencia al crear cada crédito.");
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
        <div className="directory-header-actions">
          <span>{products.length} configurados</span>
          {canConfigure ? (
            <button className="primary-action" onClick={() => setIsCreateOpen(true)} type="button">
              Nuevo producto
            </button>
          ) : null}
        </div>
      </div>
      <p className="operational-note">
        El propietario solo define el monto máximo y el porcentaje. El equipo elige la frecuencia y
        el plazo al crear cada crédito.
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
              {product.status === "draft" && (canReview || canConfigure) ? (
                <div className="credit-product-review-actions">
                  {canReview && product.complianceSourceRef ? (
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
                  {canConfigure ? (
                    <LoanProductDraftEditor product={product} tenantId={tenantId} />
                  ) : null}
                </div>
              ) : null}
              <LoanSchedulePreview product={product} tenantId={tenantId} />
            </article>
          ))}
        </div>
      ) : null}
      {canConfigure ? (
        isCreateOpen ? (
          <Modal onClose={() => setIsCreateOpen(false)} title="Nuevo producto de crédito">
            <form className="tenant-form credit-product-form" onSubmit={submit}>
              <p className="form-help">
                Solo debes indicar el monto máximo y el porcentaje de interés. La frecuencia y el
                plazo se eligen al crear cada crédito.
              </p>
              <label>
                Monto máximo por crédito (COP)
                <input
                  inputMode="decimal"
                  name="principalMax"
                  pattern="[0-9]+(\\.[0-9]{1,2})?"
                  required
                />
              </label>
              <label>
                Porcentaje de interés total
                <input
                  inputMode="decimal"
                  name="nominalRate"
                  pattern="[0-9]+(\\.[0-9]{1,8})?"
                  required
                />
              </label>
              <button disabled={isBusy} type="submit">
                {isBusy ? "Guardando…" : "Guardar regla"}
              </button>
            </form>
          </Modal>
        ) : null
      ) : (
        <p className="operational-note">Solo el propietario puede ajustar monto y porcentaje.</p>
      )}
      {message ? (
        <p className={`tenant-form-message${isError ? " form-message-error" : ""}`} role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
