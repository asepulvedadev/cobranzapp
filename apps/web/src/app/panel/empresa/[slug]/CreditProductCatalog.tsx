"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import {
  formatCop,
  normalizeCopInput,
  normalizeRateInput,
} from "../../../../lib/financial-display";
import type { LoanProduct } from "../../../../lib/platform";
import { Modal } from "../../Modal";
import { useSensitiveFetch } from "../../ReauthenticationProvider";
import { FinancialRuleSummary } from "./FinancialRuleSummary";
import { LoanProductDraftEditor } from "./LoanProductDraftEditor";
import { LoanSchedulePreview } from "./LoanSchedulePreview";

const statusLabels: Record<LoanProduct["status"], string> = {
  draft: "Borrador",
  under_review: "En revisión",
  approved: "Aprobado",
  retired: "Retirado",
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
  const [principalMax, setPrincipalMax] = useState("");
  const [nominalRate, setNominalRate] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsBusy(true);
    setMessage("");
    setIsError(false);
    const response = await sensitiveFetch(`/api/v1/tenants/${tenantId}/loan-products`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Crédito estándar",
        principalMin: "1",
        principalMax: normalizeCopInput(principalMax),
        termCount: 30,
        paymentFrequency: "daily",
        rateBasis: "flat_total",
        nominalRate: normalizeRateInput(nominalRate),
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
    setPrincipalMax("");
    setNominalRate("");
    setIsCreateOpen(false);
    setMessage("Regla guardada. Revisa la simulación antes de usarla en una solicitud.");
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
          <span className="panel-eyebrow">Reglas del negocio</span>
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
        El porcentaje es interés total sobre el monto prestado. La frecuencia y el plazo se eligen
        al crear cada solicitud.
      </p>
      {products.length ? (
        <div className="credit-product-list">
          {products.map((product) => (
            <article className="credit-product-item" key={product.id}>
              <div className="credit-product-item-heading">
                <div>
                  <strong>{product.name}</strong>
                  <small>Hasta {formatCop(product.principalMax)}</small>
                </div>
                <span className={`status status-${product.status}`}>
                  {statusLabels[product.status]}
                </span>
              </div>
              <dl className="credit-product-facts">
                <div>
                  <dt>Interés total</dt>
                  <dd>{product.nominalRate}%</dd>
                </div>
                <div>
                  <dt>Cargo adicional</dt>
                  <dd>{product.documentationFeeRate}%</dd>
                </div>
                <div>
                  <dt>Validación</dt>
                  <dd>{product.complianceStatus === "approved" ? "Aprobada" : "Pendiente"}</dd>
                </div>
              </dl>
              <div className="credit-product-actions">
                <LoanSchedulePreview product={product} tenantId={tenantId} />
                {product.status === "draft" && canConfigure ? (
                  <LoanProductDraftEditor product={product} tenantId={tenantId} />
                ) : null}
                {product.status === "draft" && canReview && product.complianceSourceRef ? (
                  <button
                    className="secondary-action-button"
                    disabled={reviewingProductId !== null}
                    onClick={() => void submitForReview(product)}
                    type="button"
                  >
                    {reviewingProductId === product.id ? "Enviando…" : "Enviar a revisión"}
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="dashboard-empty-compact">
          <div>
            <strong>No hay productos configurados</strong>
            <p>Crea la primera regla para poder simular y registrar créditos.</p>
          </div>
        </div>
      )}
      {canConfigure && isCreateOpen ? (
        <Modal
          className="financial-rule-modal"
          onClose={() => setIsCreateOpen(false)}
          title="Nuevo producto de crédito"
        >
          <form className="tenant-form credit-product-form" onSubmit={submit}>
            <div className="financial-form-intro">
              <strong>Define solo dos valores</strong>
              <p>
                Comprueba el ejemplo antes de guardar. Aquí no se crea deuda ni se mueve dinero.
              </p>
            </div>
            <label>
              Monto máximo por crédito
              <span className="financial-input-shell">
                <b>COP</b>
                <input
                  inputMode="numeric"
                  name="principalMax"
                  onChange={(event) => setPrincipalMax(event.target.value)}
                  pattern="[0-9]+"
                  placeholder="5000000"
                  required
                  value={principalMax}
                />
              </span>
              <small>Escribe solo números, sin puntos ni comas.</small>
            </label>
            <label>
              Interés total sobre el préstamo
              <span className="financial-input-shell financial-rate-input">
                <input
                  inputMode="decimal"
                  name="nominalRate"
                  onChange={(event) => setNominalRate(event.target.value)}
                  pattern="[0-9]+([.,][0-9]{1,2})?"
                  placeholder="10"
                  required
                  value={nominalRate}
                />
                <b>%</b>
              </span>
              <small>Ejemplo: 10 significa diez por ciento total, no 0,10.</small>
            </label>
            <FinancialRuleSummary principal={principalMax} rate={nominalRate} />
            <button disabled={isBusy} type="submit">
              {isBusy ? "Guardando…" : "Guardar producto"}
            </button>
          </form>
        </Modal>
      ) : null}
      {!canConfigure ? (
        <p className="operational-note">Solo el propietario puede cambiar montos y porcentajes.</p>
      ) : null}
      {message ? (
        <p className={`tenant-form-message${isError ? " form-message-error" : ""}`} role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
