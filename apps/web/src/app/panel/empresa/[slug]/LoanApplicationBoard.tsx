"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import type { Borrower, LoanApplication, LoanProduct } from "../../../../lib/platform";
import { useSensitiveFetch } from "../../ReauthenticationProvider";

const statusLabels: Record<LoanApplication["status"], string> = {
  draft: "Borrador",
  submitted: "Enviada",
  under_review: "En revisión",
  approved: "Aprobada",
  rejected: "Rechazada",
  cancelled: "Cancelada",
};

async function errorMessage(response: Response | null) {
  const body = (await response?.json().catch(() => ({}))) as {
    error?: { message?: string };
  };
  return body.error?.message ?? "No fue posible crear la solicitud.";
}

export function LoanApplicationBoard({
  tenantId,
  borrowers,
  products,
  applications,
}: {
  tenantId: string;
  borrowers: Borrower[];
  products: LoanProduct[];
  applications: LoanApplication[];
}) {
  const router = useRouter();
  const sensitiveFetch = useSensitiveFetch();
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [reviewingApplicationId, setReviewingApplicationId] = useState<string | null>(null);
  const activeBorrowers = borrowers.filter((borrower) => borrower.status === "active");
  const availableProducts = products.filter((product) => product.status !== "retired");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsBusy(true);
    setMessage("");
    setIsError(false);
    const form = new FormData(event.currentTarget);
    const response = await sensitiveFetch(`/api/v1/tenants/${tenantId}/loan-applications`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        borrowerId: String(form.get("borrowerId") ?? ""),
        loanProductId: String(form.get("loanProductId") ?? ""),
        requestedPrincipal: String(form.get("requestedPrincipal") ?? "").trim(),
        requestedTermCount: Number(form.get("requestedTermCount")),
        purpose: String(form.get("purpose") ?? "").trim() || null,
      }),
    }).catch(() => null);
    if (!response?.ok) {
      setMessage(await errorMessage(response));
      setIsError(true);
      setIsBusy(false);
      return;
    }
    event.currentTarget.reset();
    setMessage("Solicitud guardada como borrador. Aún no genera aprobación ni desembolso.");
    setIsBusy(false);
    router.refresh();
  }

  async function submitForReview(application: LoanApplication) {
    setReviewingApplicationId(application.id);
    setMessage("");
    setIsError(false);
    const response = await sensitiveFetch(
      `/api/v1/tenants/${tenantId}/loan-applications/${application.id}/submit`,
      { method: "POST" },
    ).catch(() => null);
    if (!response?.ok) {
      setMessage(await errorMessage(response));
      setIsError(true);
      setReviewingApplicationId(null);
      return;
    }
    setMessage(`La solicitud de ${application.borrowerName} quedó enviada a revisión.`);
    setReviewingApplicationId(null);
    router.refresh();
  }

  return (
    <section className="dashboard-card loan-application-card" id="solicitudes-credito">
      <div className="card-heading">
        <div>
          <span className="panel-eyebrow">Originación controlada</span>
          <h2>Solicitudes de crédito</h2>
        </div>
        <span>{applications.length} registradas</span>
      </div>
      <p className="operational-note">
        Esta primera versión solo captura solicitudes y deja trazabilidad. La evaluación,
        aprobación, desembolso y calendario de pagos requieren reglas aprobadas.
      </p>
      {applications.length ? (
        <div className="loan-application-list">
          {applications.map((application) => (
            <article className="loan-application-item" key={application.id}>
              <div className="loan-application-item-heading">
                <div>
                  <strong>{application.borrowerName}</strong>
                  <small>
                    {application.loanProductName} · COP {application.requestedPrincipal} ·{" "}
                    {application.requestedTermCount} periodos
                  </small>
                </div>
                <span className={`status status-${application.status}`}>
                  {statusLabels[application.status]}
                </span>
              </div>
              {application.purpose ? <p>{application.purpose}</p> : null}
              {application.status === "draft" ? (
                <button
                  disabled={reviewingApplicationId !== null}
                  onClick={() => void submitForReview(application)}
                  type="button"
                >
                  {reviewingApplicationId === application.id ? "Enviando…" : "Enviar a revisión"}
                </button>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
      {activeBorrowers.length && availableProducts.length ? (
        <form className="tenant-form loan-application-form" onSubmit={submit}>
          <h3>Nueva solicitud en borrador</h3>
          <div className="borrower-form-row">
            <label>
              Cliente
              <select defaultValue="" name="borrowerId" required>
                <option disabled value="">
                  Selecciona un cliente
                </option>
                {activeBorrowers.map((borrower) => (
                  <option key={borrower.id} value={borrower.id}>
                    {borrower.fullName} · {borrower.identity.documentType} ****
                    {borrower.identity.documentLast4}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Producto
              <select defaultValue="" name="loanProductId" required>
                <option disabled value="">
                  Selecciona un producto
                </option>
                {availableProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} · hasta COP {product.principalMax}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="borrower-form-row">
            <label>
              Monto solicitado (COP)
              <input
                inputMode="decimal"
                name="requestedPrincipal"
                pattern="[0-9]+(\\.[0-9]{1,2})?"
                required
              />
            </label>
            <label>
              Periodos
              <input defaultValue="1" min="1" name="requestedTermCount" required type="number" />
            </label>
          </div>
          <label>
            Propósito (opcional)
            <textarea maxLength={240} name="purpose" rows={2} />
          </label>
          {message ? (
            <p
              className={`tenant-form-message${isError ? " form-message-error" : ""}`}
              role="status"
            >
              {message}
            </p>
          ) : null}
          <button disabled={isBusy} type="submit">
            {isBusy ? "Guardando…" : "Guardar solicitud"}
          </button>
        </form>
      ) : (
        <p className="form-help">
          Para crear una solicitud necesitas al menos un cliente activo y un producto de crédito.
        </p>
      )}
    </section>
  );
}
