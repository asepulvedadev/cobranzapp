"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import type {
  Borrower,
  FinancialSchedulePreview,
  LoanApplication,
  LoanProduct,
} from "../../../../lib/platform";
import { formatApiError } from "../../api-error";
import { useSensitiveFetch } from "../../ReauthenticationProvider";

const statusLabels: Record<LoanApplication["status"], string> = {
  draft: "Borrador",
  submitted: "Enviada",
  under_review: "En revisión",
  approved: "Aprobada",
  active: "Activo",
  paid: "Pagado",
  rejected: "Rechazada",
  cancelled: "Cancelada",
};

const frequencyLabels: Record<LoanApplication["paymentFrequency"], string> = {
  daily: "diaria",
  weekly: "semanal",
  fortnightly: "quincenal",
  monthly: "mensual",
};

async function errorMessage(response: Response | null) {
  const body = await response?.json().catch(() => ({}));
  return formatApiError(body, "No fue posible operar el crédito.");
}

export function LoanApplicationBoard({
  tenantId,
  borrowers,
  products,
  applications,
  canReview,
}: {
  tenantId: string;
  borrowers: Borrower[];
  products: LoanProduct[];
  applications: LoanApplication[];
  canReview: boolean;
}) {
  const router = useRouter();
  const sensitiveFetch = useSensitiveFetch();
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [reviewingApplicationId, setReviewingApplicationId] = useState<string | null>(null);
  const [startingReviewId, setStartingReviewId] = useState<string | null>(null);
  const [paymentApplicationId, setPaymentApplicationId] = useState<string | null>(null);
  const [renewingApplicationId, setRenewingApplicationId] = useState<string | null>(null);
  const [schedulePreview, setSchedulePreview] = useState<FinancialSchedulePreview | null>(null);
  const [frequency, setFrequency] = useState<LoanProduct["paymentFrequency"]>("daily");
  const [termCount, setTermCount] = useState(30);
  const activeBorrowers = borrowers.filter((borrower) => borrower.status === "active");
  const availableProducts = products.filter((product) => product.status !== "retired");

  const termOptions: Record<LoanProduct["paymentFrequency"], { value: number; label: string }[]> = {
    daily: [
      { value: 30, label: "1 mes · 30 cuotas diarias" },
      { value: 35, label: "5 semanas · 35 cuotas diarias" },
    ],
    weekly: [
      { value: 4, label: "1 mes · 4 cuotas semanales" },
      { value: 5, label: "5 semanas · 5 cuotas semanales" },
    ],
    fortnightly: [{ value: 2, label: "1 mes · 2 cuotas quincenales" }],
    monthly: [{ value: 1, label: "1 mes · 1 cuota mensual" }],
  };

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
        paymentFrequency: String(form.get("paymentFrequency") ?? "daily"),
        requestedTermCount: Number(form.get("requestedTermCount") ?? termCount),
        purpose: String(form.get("purpose") ?? "").trim() || null,
      }),
    }).catch(() => null);
    if (!response?.ok) {
      setMessage(await errorMessage(response));
      setIsError(true);
      setIsBusy(false);
      return;
    }
    const productId = String(form.get("loanProductId") ?? "");
    const principal = String(form.get("requestedPrincipal") ?? "").trim();
    const previewResponse = await fetch(
      `/api/v1/tenants/${tenantId}/loan-products/${productId}/schedule-preview`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          principal,
          termCount: Number(form.get("requestedTermCount") ?? termCount),
          paymentFrequency: String(form.get("paymentFrequency") ?? frequency),
          startDate: new Date().toISOString().slice(0, 10),
        }),
      },
    ).catch(() => null);
    if (previewResponse?.ok) {
      const previewBody = (await previewResponse.json()) as { preview?: FinancialSchedulePreview };
      setSchedulePreview(previewBody.preview ?? null);
    }
    event.currentTarget.reset();
    setFrequency("daily");
    setTermCount(30);
    setMessage("Crédito creado y activo. El calendario quedó calculado automáticamente.");
    setIsBusy(false);
    router.refresh();
  }

  async function recordPayment(application: LoanApplication) {
    setPaymentApplicationId(application.id);
    setMessage("");
    setIsError(false);
    const response = await sensitiveFetch(
      `/api/v1/tenants/${tenantId}/loan-applications/${application.id}/payments`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ installmentNumber: application.paidInstallments + 1 }),
      },
    ).catch(() => null);
    if (!response?.ok) {
      setMessage(await errorMessage(response));
      setIsError(true);
      setPaymentApplicationId(null);
      return;
    }
    setMessage(`Cuota ${application.paidInstallments + 1} registrada.`);
    setPaymentApplicationId(null);
    router.refresh();
  }

  async function renewApplication(event: FormEvent<HTMLFormElement>, application: LoanApplication) {
    event.preventDefault();
    setRenewingApplicationId(application.id);
    setMessage("");
    setIsError(false);
    const form = new FormData(event.currentTarget);
    const response = await sensitiveFetch(
      `/api/v1/tenants/${tenantId}/loan-applications/${application.id}/renew`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ excessAmount: String(form.get("excessAmount") ?? "0").trim() }),
      },
    ).catch(() => null);
    if (!response?.ok) {
      setMessage(await errorMessage(response));
      setIsError(true);
      setRenewingApplicationId(null);
      return;
    }
    setMessage("Crédito renovado. Se creó un nuevo calendario con el excedente solicitado.");
    setRenewingApplicationId(null);
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

  async function startReview(application: LoanApplication) {
    setStartingReviewId(application.id);
    setMessage("");
    setIsError(false);
    const response = await sensitiveFetch(
      `/api/v1/tenants/${tenantId}/loan-applications/${application.id}/review`,
      { method: "POST" },
    ).catch(() => null);
    if (!response?.ok) {
      setMessage(await errorMessage(response));
      setIsError(true);
      setStartingReviewId(null);
      return;
    }
    setMessage(`La solicitud de ${application.borrowerName} entró en revisión.`);
    setStartingReviewId(null);
    router.refresh();
  }

  return (
    <section className="dashboard-card loan-application-card" id="solicitudes-credito">
      <div className="card-heading">
        <div>
          <span className="panel-eyebrow">Originación controlada</span>
          <h2>Créditos activos</h2>
        </div>
        <span>{applications.length} registradas</span>
      </div>
      <p className="operational-note">
        El monto y el interés los define el propietario. La frecuencia y el plazo mensual se aplican
        automáticamente.
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
                    {frequencyLabels[application.paymentFrequency]} · {application.paidInstallments}
                    /{application.requestedTermCount} cuotas
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
              {application.status === "submitted" && canReview ? (
                <button
                  disabled={startingReviewId !== null}
                  onClick={() => void startReview(application)}
                  type="button"
                >
                  {startingReviewId === application.id ? "Iniciando…" : "Iniciar revisión"}
                </button>
              ) : null}
              {application.status === "active" ? (
                <div className="loan-application-actions">
                  <button
                    disabled={paymentApplicationId !== null}
                    onClick={() => void recordPayment(application)}
                    type="button"
                  >
                    {paymentApplicationId === application.id
                      ? "Registrando…"
                      : `Registrar cuota ${application.paidInstallments + 1}`}
                  </button>
                  {application.paidInstallments >= 2 ? (
                    <form onSubmit={(event) => void renewApplication(event, application)}>
                      <label>
                        Excedente de renovación (COP)
                        <input
                          inputMode="decimal"
                          name="excessAmount"
                          pattern="[0-9]+(\\.[0-9]{1,2})?"
                          required
                        />
                      </label>
                      <button disabled={renewingApplicationId !== null} type="submit">
                        {renewingApplicationId === application.id
                          ? "Renovando…"
                          : "Renovar crédito"}
                      </button>
                    </form>
                  ) : null}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
      {activeBorrowers.length && availableProducts.length ? (
        <form className="tenant-form loan-application-form" onSubmit={submit}>
          <h3>Crear crédito</h3>
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
              Frecuencia de pago
              <select
                name="paymentFrequency"
                onChange={(event) => {
                  const next = event.target.value as LoanProduct["paymentFrequency"];
                  setFrequency(next);
                  setTermCount(termOptions[next][0]?.value ?? 30);
                }}
                value={frequency}
              >
                <option value="daily">Diaria</option>
                <option value="weekly">Semanal</option>
                <option value="fortnightly">Quincenal</option>
                <option value="monthly">Mensual</option>
              </select>
            </label>
          </div>
          <div className="borrower-form-row">
            <label>
              Plazo automático
              <select
                name="requestedTermCount"
                onChange={(event) => setTermCount(Number(event.target.value))}
                value={termCount}
              >
                {termOptions[frequency].map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {message ? (
            <p
              className={`tenant-form-message${isError ? " form-message-error" : ""}`}
              role="status"
            >
              {message}
            </p>
          ) : null}
          <button disabled={isBusy} type="submit">
            {isBusy ? "Calculando…" : "Crear crédito"}
          </button>
        </form>
      ) : (
        <p className="form-help">
          Para crear una solicitud necesitas al menos un cliente activo y un producto de crédito.
        </p>
      )}
      {schedulePreview ? (
        <div className="loan-schedule-summary" role="status">
          <strong>Calendario calculado</strong>
          <span>
            Total a pagar: COP {schedulePreview.scheduledTotal} · Cuota aproximada: COP{" "}
            {schedulePreview.periods[0]?.installment}
          </span>
        </div>
      ) : null}
    </section>
  );
}
