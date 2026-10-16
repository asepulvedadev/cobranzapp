"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { fetchWithTimeout } from "../../../../lib/fetch-with-timeout";
import {
  formatCop,
  formatCopInput,
  formatPercentage,
  normalizeCopInput,
} from "../../../../lib/financial-display";
import type {
  Borrower,
  FinancialSchedulePreview,
  LoanApplication,
  LoanPayment,
  LoanProduct,
} from "../../../../lib/platform";
import { formatApiError } from "../../api-error";
import { Modal } from "../../Modal";
import { useSensitiveFetch } from "../../ReauthenticationProvider";

const statusLabels: Record<LoanApplication["status"], string> = {
  draft: "Borrador",
  submitted: "Pendiente de aprobación",
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

function renewalProgress(application: LoanApplication) {
  return (
    application.paidPercentage ??
    Math.min(100, (application.paidInstallments / application.requestedTermCount) * 100)
  );
}

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
  actorRole,
  initialBorrowerId,
  openCreate = false,
}: {
  tenantId: string;
  borrowers: Borrower[];
  products: LoanProduct[];
  applications: LoanApplication[];
  canReview: boolean;
  actorRole: "owner" | "supervisor" | "collector";
  initialBorrowerId?: string;
  openCreate?: boolean;
}) {
  const router = useRouter();
  const sensitiveFetch = useSensitiveFetch();
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [reviewingApplicationId, setReviewingApplicationId] = useState<string | null>(null);
  const [approvingApplicationId, setApprovingApplicationId] = useState<string | null>(null);
  const [approvalConfirmation, setApprovalConfirmation] = useState<LoanApplication | null>(null);
  const [paymentApplicationId, setPaymentApplicationId] = useState<string | null>(null);
  const [paymentConfirmation, setPaymentConfirmation] = useState<LoanApplication | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "transfer">("cash");
  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const [paymentReceipt, setPaymentReceipt] = useState<
    (LoanPayment & { borrowerName: string; whatsappPhone: string }) | null
  >(null);
  const [paymentHistoryApplication, setPaymentHistoryApplication] =
    useState<LoanApplication | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<LoanPayment[]>([]);
  const [paymentHistoryBusy, setPaymentHistoryBusy] = useState(false);
  const [renewingApplicationId, setRenewingApplicationId] = useState<string | null>(null);
  const [schedulePreview, setSchedulePreview] = useState<FinancialSchedulePreview | null>(null);
  const [createOpen, setCreateOpen] = useState(openCreate);
  const [borrowerId, setBorrowerId] = useState(initialBorrowerId ?? "");
  const [productId, setProductId] = useState("");
  const [requestedPrincipal, setRequestedPrincipal] = useState("");
  const [frequency, setFrequency] = useState<LoanProduct["paymentFrequency"]>("daily");
  const [termCount, setTermCount] = useState(30);
  const selectedBorrower = borrowers.find(
    (borrower) =>
      borrower.id === initialBorrowerId &&
      borrower.status === "active" &&
      borrower.identity.verificationState === "reviewed",
  );
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

  const selectedProduct = availableProducts.find((product) => product.id === productId) ?? null;

  function clearPreview() {
    setSchedulePreview(null);
    setMessage("");
    setIsError(false);
  }

  async function previewCredit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsBusy(true);
    setMessage("");
    setIsError(false);
    const principal = normalizeCopInput(requestedPrincipal);
    if (
      !selectedProduct ||
      Number(principal) < Number(selectedProduct.principalMin) ||
      Number(principal) > Number(selectedProduct.principalMax)
    ) {
      setMessage(
        selectedProduct
          ? `El monto debe estar entre ${formatCop(selectedProduct.principalMin)} y ${formatCop(selectedProduct.principalMax)}.`
          : "Selecciona un producto de crédito.",
      );
      setIsError(true);
      setIsBusy(false);
      return;
    }
    const previewResponse = await fetchWithTimeout(
      `/api/v1/tenants/${tenantId}/loan-products/${productId}/schedule-preview`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          principal,
          termCount,
          paymentFrequency: frequency,
          startDate: new Date().toISOString().slice(0, 10),
        }),
      },
    );
    if (!previewResponse?.ok) {
      setMessage(await errorMessage(previewResponse));
      setIsError(true);
      setIsBusy(false);
      return;
    }
    const previewBody = (await previewResponse.json()) as { preview?: FinancialSchedulePreview };
    setSchedulePreview(previewBody.preview ?? null);
    setIsBusy(false);
  }

  async function createCredit() {
    if (!schedulePreview) return;
    setIsBusy(true);
    setMessage("");
    setIsError(false);
    const response = await sensitiveFetch(`/api/v1/tenants/${tenantId}/loan-applications`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        borrowerId,
        loanProductId: productId,
        requestedPrincipal: normalizeCopInput(requestedPrincipal),
        paymentFrequency: frequency,
        requestedTermCount: termCount,
        purpose: null,
      }),
    }).catch(() => null);
    if (!response?.ok) {
      setMessage(await errorMessage(response));
      setIsError(true);
      setIsBusy(false);
      return;
    }
    const body = (await response.json().catch(() => null)) as {
      application?: LoanApplication;
    } | null;
    setBorrowerId("");
    setProductId("");
    setRequestedPrincipal("");
    setFrequency("daily");
    setTermCount(30);
    setSchedulePreview(null);
    setCreateOpen(false);
    setMessage(
      body?.application?.status === "submitted"
        ? "Solicitud creada. Quedó pendiente de aprobación por el propietario o un supervisor."
        : "Crédito creado y aprobado automáticamente con el calendario confirmado.",
    );
    setIsBusy(false);
    router.refresh();
  }

  async function recordPayment(application: LoanApplication) {
    setPaymentApplicationId(application.id);
    setMessage("");
    setIsError(false);
    const form = new FormData();
    form.set("installmentNumber", String(application.paidInstallments + 1));
    form.set("amount", application.nextPaymentAmount ?? application.installmentAmount);
    form.set("paymentMethod", paymentMethod);
    if (paymentMethod === "transfer" && paymentProof) form.set("proof", paymentProof);
    const response = await sensitiveFetch(
      `/api/v1/tenants/${tenantId}/loan-applications/${application.id}/payments`,
      {
        method: "POST",
        body: form,
      },
    ).catch(() => null);
    if (!response?.ok) {
      setMessage(await errorMessage(response));
      setIsError(true);
      setPaymentApplicationId(null);
      return;
    }
    const body = (await response.json()) as { payment?: LoanPayment };
    const borrower = borrowers.find((item) => item.id === application.borrowerId);
    if (body.payment) {
      setPaymentReceipt({
        ...body.payment,
        borrowerName: application.borrowerName,
        whatsappPhone: borrower?.whatsappPhone ?? borrower?.phone ?? "",
      });
    }
    setPaymentMethod("cash");
    setPaymentProof(null);
    setMessage(`Pago de la cuota ${application.paidInstallments + 1} registrado.`);
    setPaymentApplicationId(null);
    router.refresh();
  }

  async function openPaymentHistory(application: LoanApplication) {
    setPaymentHistoryApplication(application);
    setPaymentHistory([]);
    setPaymentHistoryBusy(true);
    const response = await fetch(
      `/api/v1/tenants/${tenantId}/loan-applications/${application.id}/payments`,
      { cache: "no-store" },
    ).catch(() => null);
    if (response?.ok) {
      const body = (await response.json()) as { payments?: LoanPayment[] };
      setPaymentHistory(body.payments ?? []);
    }
    setPaymentHistoryBusy(false);
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
        body: JSON.stringify({
          excessAmount: normalizeCopInput(String(form.get("excessAmount") ?? "0")),
        }),
      },
    ).catch(() => null);
    if (!response?.ok) {
      setMessage(await errorMessage(response));
      setIsError(true);
      setRenewingApplicationId(null);
      return;
    }
    const body = (await response.json().catch(() => null)) as {
      application?: LoanApplication;
    } | null;
    setMessage(
      body?.application?.status === "submitted"
        ? "Renovación enviada. El nuevo crédito será el saldo de capital más el dinero adicional y cobrará un nuevo interés completo."
        : "Crédito renovado. Se sumó el saldo de capital y el dinero adicional; el nuevo interés se calculó sobre ese total.",
    );
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

  async function approveApplication(application: LoanApplication) {
    setApprovingApplicationId(application.id);
    setMessage("");
    setIsError(false);
    const response = await sensitiveFetch(
      `/api/v1/tenants/${tenantId}/loan-applications/${application.id}/approve`,
      { method: "POST" },
    ).catch(() => null);
    if (!response?.ok) {
      setMessage(await errorMessage(response));
      setIsError(true);
      setApprovingApplicationId(null);
      return;
    }
    setMessage(`Crédito de ${application.borrowerName} aprobado y activado.`);
    setApprovingApplicationId(null);
    router.refresh();
  }

  return (
    <section className="dashboard-card loan-application-card" id="solicitudes-credito">
      <div className="card-heading">
        <div>
          <span className="panel-eyebrow">Operación</span>
          <h2>Créditos activos</h2>
        </div>
        <div className="directory-header-actions">
          <span>{applications.length} registrados</span>
        </div>
      </div>
      <p className="operational-note">
        {actorRole === "collector"
          ? "Tus solicitudes quedan pendientes hasta que el propietario o un supervisor las apruebe."
          : "Los créditos que creas se aprueban de inmediato; las solicitudes de cobradores requieren tu aprobación."}
      </p>
      {applications.length ? (
        <div className="loan-application-list">
          {applications.map((application) => (
            <article className="loan-application-item" key={application.id}>
              <div className="loan-application-item-heading">
                <div>
                  <strong>{application.borrowerName}</strong>
                  <small>
                    {application.loanProductName} · {formatCop(application.requestedPrincipal)} ·{" "}
                    {formatPercentage(application.nominalRate)}% total ·{" "}
                    {frequencyLabels[application.paymentFrequency]}
                    {" · "}
                    {application.paidInstallments}/{application.requestedTermCount} cuotas
                  </small>
                  <small>
                    Próxima cuota: {application.nextDueDate ?? "Sin fecha"}
                    {(application.overdueInstallments ?? 0) > 0
                      ? ` · ${application.overdueInstallments} vencida(s)`
                      : " · Al día"}
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
              {["submitted", "under_review"].includes(application.status) && canReview ? (
                <button
                  className="primary-action"
                  disabled={approvingApplicationId !== null}
                  onClick={() => setApprovalConfirmation(application)}
                  type="button"
                >
                  {approvingApplicationId === application.id ? "Aprobando…" : "Revisar y aprobar"}
                </button>
              ) : null}
              {application.status === "submitted" && !canReview ? (
                <p className="form-help">Pendiente de aprobación por propietario o supervisor.</p>
              ) : null}
              {application.status === "active" ? (
                <div className="loan-application-actions">
                  <button
                    disabled={paymentApplicationId !== null}
                    onClick={() => {
                      setPaymentMethod("cash");
                      setPaymentProof(null);
                      setPaymentConfirmation(application);
                    }}
                    type="button"
                  >
                    {paymentApplicationId === application.id
                      ? "Registrando…"
                      : `Registrar cuota ${application.paidInstallments + 1}`}
                  </button>
                  {application.renewalEligible === true ? (
                    <form onSubmit={(event) => void renewApplication(event, application)}>
                      <label>
                        Dinero adicional para el cliente (COP)
                        <input
                          inputMode="numeric"
                          name="excessAmount"
                          onInput={(event) => {
                            event.currentTarget.value = formatCopInput(event.currentTarget.value);
                          }}
                          pattern="[0-9.]+"
                          required
                        />
                      </label>
                      <button disabled={renewingApplicationId !== null} type="submit">
                        {renewingApplicationId === application.id
                          ? "Renovando…"
                          : "Renovar con nuevo interés"}
                      </button>
                      <small>
                        El nuevo crédito será el capital pendiente más este valor y cobrará el
                        interés completo otra vez.
                      </small>
                    </form>
                  ) : (
                    <p className="renewal-progress-note">
                      Renovación disponible al pagar 40 % del total con intereses. Lleva{" "}
                      {renewalProgress(application).toFixed(2)} %.
                    </p>
                  )}
                </div>
              ) : null}
              {application.paidInstallments > 0 ? (
                <button
                  className="loan-payment-history-button"
                  onClick={() => void openPaymentHistory(application)}
                  type="button"
                >
                  Ver pagos y comprobantes
                </button>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
      {!availableProducts.length ? (
        <p className="form-help">
          Para crear una solicitud necesitas un producto de crédito disponible.
        </p>
      ) : null}
      {createOpen && selectedBorrower ? (
        <Modal
          className="credit-create-modal"
          onClose={() => setCreateOpen(false)}
          title="Nuevo crédito"
        >
          <form className="tenant-form loan-application-form" onSubmit={previewCredit}>
            <div className="financial-form-intro">
              <strong>Primero simula, después confirma</strong>
              <p>
                {actorRole === "collector"
                  ? "Al confirmar se enviará al propietario o supervisor para aprobación."
                  : "Al confirmar quedará aprobado y activo de inmediato."}
              </p>
            </div>
            <div className="credit-selected-borrower">
              <span>Cliente aprobado</span>
              <strong>{selectedBorrower.fullName}</strong>
              <small>
                {selectedBorrower.identity.documentType} · ••••{" "}
                {selectedBorrower.identity.documentLast4}
              </small>
            </div>
            <label>
              Producto
              <select
                name="loanProductId"
                onChange={(event) => {
                  setProductId(event.target.value);
                  clearPreview();
                }}
                required
                value={productId}
              >
                <option disabled value="">
                  Selecciona un producto
                </option>
                {availableProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} · {formatPercentage(product.nominalRate)}% · máximo{" "}
                    {formatCop(product.principalMax)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Monto a prestar
              <span className="financial-input-shell">
                <b>COP</b>
                <input
                  inputMode="numeric"
                  name="requestedPrincipal"
                  onChange={(event) => {
                    setRequestedPrincipal(formatCopInput(event.target.value));
                    clearPreview();
                  }}
                  pattern="[0-9.]+"
                  placeholder="500.000"
                  required
                  value={requestedPrincipal}
                />
              </span>
              {selectedProduct ? (
                <small>
                  Permitido: {formatCop(selectedProduct.principalMin)} a{" "}
                  {formatCop(selectedProduct.principalMax)}.
                </small>
              ) : null}
            </label>
            <div className="borrower-form-row">
              <label>
                Frecuencia
                <select
                  name="paymentFrequency"
                  onChange={(event) => {
                    const next = event.target.value as LoanProduct["paymentFrequency"];
                    setFrequency(next);
                    setTermCount(termOptions[next][0]?.value ?? 30);
                    clearPreview();
                  }}
                  value={frequency}
                >
                  <option value="daily">Diaria</option>
                  <option value="weekly">Semanal</option>
                  <option value="fortnightly">Quincenal</option>
                  <option value="monthly">Mensual</option>
                </select>
              </label>
              <label>
                Plazo
                <select
                  name="requestedTermCount"
                  onChange={(event) => {
                    setTermCount(Number(event.target.value));
                    clearPreview();
                  }}
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
            {schedulePreview ? (
              <div className="credit-confirmation-summary" role="status">
                <span>Confirma estos valores</span>
                <dl>
                  <div>
                    <dt>Monto prestado</dt>
                    <dd>{formatCop(requestedPrincipal)}</dd>
                  </div>
                  <div>
                    <dt>Interés total</dt>
                    <dd>{formatCop(schedulePreview.interestTotal)}</dd>
                  </div>
                  <div>
                    <dt>{schedulePreview.periods.length} cuotas</dt>
                    <dd>{formatCop(schedulePreview.periods[0]?.installment ?? "0")}</dd>
                  </div>
                  <div>
                    <dt>Total a pagar</dt>
                    <dd>{formatCop(schedulePreview.scheduledTotal)}</dd>
                  </div>
                </dl>
                <small>
                  Las primeras cuotas pagan primero el interés; después amortizan capital. La última
                  cuota puede variar unos pesos por el redondeo.
                </small>
                <button disabled={isBusy} onClick={() => void createCredit()} type="button">
                  {isBusy
                    ? "Creando…"
                    : actorRole === "collector"
                      ? "Enviar para aprobación"
                      : "Confirmar y aprobar crédito"}
                </button>
              </div>
            ) : (
              <button disabled={isBusy} type="submit">
                {isBusy ? "Calculando…" : "Revisar total y cuotas"}
              </button>
            )}
          </form>
        </Modal>
      ) : null}
      {message && !createOpen ? (
        <p className={`tenant-form-message${isError ? " form-message-error" : ""}`} role="status">
          {message}
        </p>
      ) : null}
      {paymentConfirmation ? (
        <Modal onClose={() => setPaymentConfirmation(null)} title="Registrar pago">
          <form
            className="payment-capture-form"
            onSubmit={(event) => {
              event.preventDefault();
              const application = paymentConfirmation;
              setPaymentConfirmation(null);
              void recordPayment(application);
            }}
          >
            <header className="payment-capture-summary">
              <span>
                Cuota {paymentConfirmation.paidInstallments + 1} de{" "}
                {paymentConfirmation.requestedTermCount}
              </span>
              <strong>
                {formatCop(
                  paymentConfirmation.nextPaymentAmount ?? paymentConfirmation.installmentAmount,
                )}
              </strong>
              <small>{paymentConfirmation.borrowerName}</small>
            </header>
            <fieldset className="payment-method-picker">
              <legend>¿Cómo pagó?</legend>
              <label className={paymentMethod === "cash" ? "is-selected" : ""}>
                <input
                  checked={paymentMethod === "cash"}
                  name="paymentMethod"
                  onChange={() => {
                    setPaymentMethod("cash");
                    setPaymentProof(null);
                  }}
                  type="radio"
                />
                <strong>Efectivo</strong>
                <small>Dinero recibido en persona</small>
              </label>
              <label className={paymentMethod === "transfer" ? "is-selected" : ""}>
                <input
                  checked={paymentMethod === "transfer"}
                  name="paymentMethod"
                  onChange={() => setPaymentMethod("transfer")}
                  type="radio"
                />
                <strong>Transferencia</strong>
                <small>Pago por banco o billetera</small>
              </label>
            </fieldset>
            {paymentMethod === "transfer" ? (
              <label className="payment-proof-picker">
                <span>
                  Imagen de la transferencia <small>Opcional</small>
                </span>
                <input
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  onChange={(event) => setPaymentProof(event.target.files?.[0] ?? null)}
                  type="file"
                />
                <strong>{paymentProof ? paymentProof.name : "Tomar foto o elegir imagen"}</strong>
              </label>
            ) : null}
            <div className="payment-capture-balance">
              <span>Saldo después del pago</span>
              <strong>
                {formatCop(
                  Math.max(
                    0,
                    Number(paymentConfirmation.remainingAmount ?? "0") -
                      Number(
                        paymentConfirmation.nextPaymentAmount ??
                          paymentConfirmation.installmentAmount,
                      ),
                  ).toFixed(2),
                )}
              </strong>
            </div>
            <div className="borrower-step-actions">
              <button onClick={() => setPaymentConfirmation(null)} type="button">
                Cancelar
              </button>
              <button disabled={paymentApplicationId !== null} type="submit">
                {paymentApplicationId ? "Registrando…" : "Confirmar pago"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
      {paymentReceipt ? (
        <Modal onClose={() => setPaymentReceipt(null)} title="Pago confirmado">
          <div className="payment-receipt-success">
            <span aria-hidden="true">✓</span>
            <h3>{formatCop(paymentReceipt.amount)}</h3>
            <p>
              Cuota {paymentReceipt.installmentNumber} · {paymentReceipt.receiptNumber}
            </p>
            <dl>
              <div>
                <dt>Forma de pago</dt>
                <dd>{paymentReceipt.paymentMethod === "cash" ? "Efectivo" : "Transferencia"}</dd>
              </div>
              <div>
                <dt>Saldo restante</dt>
                <dd>{formatCop(paymentReceipt.remainingAmount)}</dd>
              </div>
            </dl>
            <div className="payment-receipt-actions">
              <a href={paymentReceipt.receiptUrl} rel="noreferrer" target="_blank">
                Ver comprobante
              </a>
              <a
                href={`https://wa.me/${paymentReceipt.whatsappPhone.replace(/\D/g, "").replace(/^(\d{10})$/, "57$1")}?text=${encodeURIComponent(`Hola ${paymentReceipt.borrowerName}, aquí está tu comprobante ${paymentReceipt.receiptNumber} por ${formatCop(paymentReceipt.amount)}. Saldo restante: ${formatCop(paymentReceipt.remainingAmount)}. ${paymentReceipt.receiptUrl}`)}`}
                rel="noreferrer"
                target="_blank"
              >
                Enviar por WhatsApp
              </a>
            </div>
          </div>
        </Modal>
      ) : null}
      {paymentHistoryApplication ? (
        <Modal onClose={() => setPaymentHistoryApplication(null)} title="Pagos confirmados">
          <div className="payment-history-modal">
            <header>
              <strong>{paymentHistoryApplication.borrowerName}</strong>
              <span>{paymentHistoryApplication.loanProductName}</span>
            </header>
            {paymentHistoryBusy ? <p>Cargando pagos…</p> : null}
            {!paymentHistoryBusy && !paymentHistory.length ? (
              <p>No hay pagos registrados.</p>
            ) : null}
            {paymentHistory.map((payment) => (
              <article key={payment.id}>
                <div>
                  <strong>Cuota {payment.installmentNumber}</strong>
                  <small>
                    {new Intl.DateTimeFormat("es-CO", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(payment.paidAt))}
                  </small>
                </div>
                <div>
                  <strong>{formatCop(payment.amount)}</strong>
                  <small>{payment.paymentMethod === "cash" ? "Efectivo" : "Transferencia"}</small>
                </div>
                <div className="payment-history-links">
                  <a href={payment.receiptUrl} rel="noreferrer" target="_blank">
                    Ver recibo
                  </a>
                  {payment.hasTransferProof ? (
                    <a
                      href={`/api/v1/tenants/${tenantId}/loan-applications/${paymentHistoryApplication.id}/payments/${payment.id}/proof`}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Ver transferencia
                    </a>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </Modal>
      ) : null}
      {approvalConfirmation ? (
        <Modal onClose={() => setApprovalConfirmation(null)} title="Aprobar crédito">
          <div className="credit-confirmation-summary">
            <span>Verifica antes de aprobar</span>
            <dl>
              <div>
                <dt>Cliente</dt>
                <dd>{approvalConfirmation.borrowerName}</dd>
              </div>
              <div>
                <dt>Monto</dt>
                <dd>{formatCop(approvalConfirmation.requestedPrincipal)}</dd>
              </div>
              <div>
                <dt>Interés total</dt>
                <dd>{formatPercentage(approvalConfirmation.nominalRate)}%</dd>
              </div>
              <div>
                <dt>Cuota</dt>
                <dd>{formatCop(approvalConfirmation.installmentAmount)}</dd>
              </div>
              <div>
                <dt>Plan</dt>
                <dd>
                  {approvalConfirmation.requestedTermCount} cuotas{" "}
                  {frequencyLabels[approvalConfirmation.paymentFrequency]}
                </dd>
              </div>
              <div>
                <dt>Total a pagar</dt>
                <dd>{formatCop(approvalConfirmation.scheduledTotal)}</dd>
              </div>
            </dl>
            <small>
              La aprobación quedará registrada con tu usuario, rol, fecha y condiciones del crédito.
            </small>
          </div>
          <div className="borrower-step-actions">
            <button onClick={() => setApprovalConfirmation(null)} type="button">
              Cancelar
            </button>
            <button
              className="primary-action"
              disabled={approvingApplicationId !== null}
              onClick={() => {
                const application = approvalConfirmation;
                setApprovalConfirmation(null);
                void approveApplication(application);
              }}
              type="button"
            >
              {approvingApplicationId ? "Aprobando…" : "Aprobar y activar"}
            </button>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
