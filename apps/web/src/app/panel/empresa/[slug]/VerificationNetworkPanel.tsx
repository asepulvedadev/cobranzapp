"use client";

import {
  CheckCircle,
  IdentificationCard,
  MagnifyingGlass,
  Plus,
  ShieldWarning,
  WarningDiamond,
  X,
} from "@phosphor-icons/react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { fetchWithTimeout } from "../../../../lib/fetch-with-timeout";
import type { SharedClientVerification, VerificationRiskEntry } from "../../../../lib/platform";

const ratingLabels: Record<SharedClientVerification["payerRating"], string> = {
  good: "Buen pagador",
  regular: "Pago regular",
  low: "Requiere revisión",
  no_data: "Sin datos suficientes",
};

const riskCategoryLabels: Record<VerificationRiskEntry["category"], string> = {
  repeated_late_payment: "Mora reiterada",
  payment_default: "Incumplimiento de pago",
  unreachable: "No localizado",
};

const riskStatusLabels: Record<VerificationRiskEntry["status"], string> = {
  active: "Activa",
  resolved: "Retirada",
  expired: "Vencida",
};

async function getError(response: Response | null) {
  const body = (await response?.json().catch(() => ({}))) as {
    error?: { message?: string };
  };
  return body.error?.message ?? "No fue posible completar la operación.";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(new Date(value));
}

export function ClientVerificationSearch({
  tenantId,
  canManageRiskRegistry = false,
}: {
  tenantId: string;
  canManageRiskRegistry?: boolean;
}) {
  const [result, setResult] = useState<SharedClientVerification | null>(null);
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [riskEntries, setRiskEntries] = useState<VerificationRiskEntry[]>([]);
  const [riskError, setRiskError] = useState("");
  const [riskStatus, setRiskStatus] = useState("");
  const [isRiskBusy, setIsRiskBusy] = useState(false);
  const [isRiskModalOpen, setIsRiskModalOpen] = useState(false);
  const riskAddButtonRef = useRef<HTMLButtonElement>(null);
  const riskDocumentInputRef = useRef<HTMLInputElement>(null);
  const riskModalRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!canManageRiskRegistry) return;
    let cancelled = false;
    void fetchWithTimeout(`/api/v1/tenants/${tenantId}/verification-risk-entries`).then(
      async (response) => {
        if (cancelled || !response?.ok) return;
        const body = (await response.json()) as { entries: VerificationRiskEntry[] };
        setRiskEntries(body.entries);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [canManageRiskRegistry, tenantId]);

  useEffect(() => {
    if (!isRiskModalOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    riskDocumentInputRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsRiskModalOpen(false);
      if (event.key !== "Tab" || !riskModalRef.current) return;
      const focusable = Array.from(
        riskModalRef.current.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])",
        ),
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      riskAddButtonRef.current?.focus();
    };
  }, [isRiskModalOpen]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsBusy(true);
    setMessage("");
    setResult(null);
    const form = new FormData(event.currentTarget);
    const documentNumber = String(form.get("documentNumber") ?? "").trim();
    if (!consentConfirmed) {
      setMessage("Confirma que el cliente autorizó esta consulta antes de continuar.");
      setIsBusy(false);
      return;
    }
    const response = await fetchWithTimeout(`/api/v1/tenants/${tenantId}/client-verification`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ documentNumber, consentConfirmed }),
    });
    if (!response?.ok) {
      setMessage(await getError(response));
      setIsBusy(false);
      return;
    }
    const body = (await response.json()) as { verification: SharedClientVerification };
    setResult(body.verification);
    setIsBusy(false);
  }

  async function createRiskEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsRiskBusy(true);
    setRiskError("");
    setRiskStatus("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const response = await fetchWithTimeout(
      `/api/v1/tenants/${tenantId}/verification-risk-entries`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          documentNumber: String(form.get("documentNumber") ?? ""),
          category: String(form.get("category") ?? ""),
          note: String(form.get("note") ?? ""),
        }),
      },
    );
    if (!response?.ok) {
      setRiskError(await getError(response));
      setIsRiskBusy(false);
      return;
    }
    const body = (await response.json()) as { entry: VerificationRiskEntry };
    setRiskEntries((current) => [body.entry, ...current]);
    setRiskStatus("Alerta guardada. La cédula aparecerá en las verificaciones de esta empresa.");
    setIsRiskBusy(false);
    formElement.reset();
    setIsRiskModalOpen(false);
  }

  async function resolveRiskEntry(entry: VerificationRiskEntry) {
    if (
      !window.confirm(
        "¿Retirar esta alerta del verificador? El registro de auditoría se conservará.",
      )
    ) {
      return;
    }
    setIsRiskBusy(true);
    setRiskError("");
    setRiskStatus("");
    const response = await fetchWithTimeout(
      `/api/v1/tenants/${tenantId}/verification-risk-entries/${entry.id}/resolve`,
      { method: "PATCH" },
    );
    if (!response?.ok) {
      setRiskStatus(await getError(response));
      setIsRiskBusy(false);
      return;
    }
    const body = (await response.json()) as { entry: VerificationRiskEntry };
    setRiskEntries((current) =>
      current.map((item) => (item.id === body.entry.id ? body.entry : item)),
    );
    setRiskStatus("La alerta fue retirada del verificador.");
    setIsRiskBusy(false);
  }

  const resultTitle = result?.riskReportCount
    ? "Cédula con alerta de riesgo"
    : result?.registered
      ? "Cliente registrado"
      : "No está registrado";

  return (
    <>
      <section className="dashboard-card verification-search-card">
        <div className="card-heading">
          <div>
            <span className="panel-eyebrow">Consulta interna</span>
            <h2>Verificar cliente</h2>
          </div>
          <span className="status status-active">Cédula</span>
        </div>
        <p className="operational-note">
          Busca en las empresas que usan cobranzapp. Solo mostramos datos mínimos para decidir si
          debes revisar el caso con más cuidado.
        </p>
        <form className="verification-search-form" onSubmit={submit}>
          <div className="verification-document-field">
            <label htmlFor="verification-document-number">Escribe la cédula</label>
            <div className="verification-document-input">
              <IdentificationCard aria-hidden="true" size={28} weight="duotone" />
              <input
                aria-describedby="verification-document-help"
                autoComplete="off"
                id="verification-document-number"
                inputMode="numeric"
                maxLength={32}
                name="documentNumber"
                onInput={(event) => {
                  event.currentTarget.value = event.currentTarget.value.replace(/\D/g, "");
                }}
                placeholder="1020304050"
                required
              />
            </div>
            <small id="verification-document-help">Solo números, sin puntos ni espacios.</small>
          </div>
          <label className="checkbox-row verification-consent">
            <input
              checked={consentConfirmed}
              onChange={(event) => setConsentConfirmed(event.target.checked)}
              type="checkbox"
            />
            <span>
              <strong>Consulta autorizada</strong>
              Confirmo que el cliente permitió verificar su información.
            </span>
          </label>
          <button className="verification-submit" disabled={isBusy} type="submit">
            <MagnifyingGlass aria-hidden="true" size={21} weight="bold" />
            {isBusy ? "Verificando cliente…" : "Verificar cliente"}
          </button>
        </form>
        {message ? (
          <p className="form-message form-message-error" role="alert">
            {message}
          </p>
        ) : null}
        {result ? (
          <div
            className={`verification-search-result${result.riskReportCount ? " verification-search-result-risk" : ""}`}
            aria-live="polite"
          >
            <div className="verification-result-header">
              <div>
                <span className="panel-eyebrow">Resultado</span>
                <h3>{resultTitle}</h3>
              </div>
              <span
                className={`status ${result.riskReportCount ? "status-rejected" : result.registered ? "status-active" : "status-draft"}`}
              >
                {result.riskReportCount
                  ? "Revisar"
                  : result.registered
                    ? "Encontrado"
                    : "Sin registro"}
              </span>
            </div>
            {result.registered || result.riskReportCount ? (
              <dl className="verification-result-grid">
                <div>
                  <dt>Nombre</dt>
                  <dd>{result.fullName ?? "No disponible"}</dd>
                </div>
                <div>
                  <dt>Créditos vigentes</dt>
                  <dd>{result.activeCreditCount}</dd>
                </div>
                <div>
                  <dt>Calificación</dt>
                  <dd>{ratingLabels[result.payerRating]}</dd>
                </div>
                <div>
                  <dt>Alertas vigentes</dt>
                  <dd>{result.riskReportCount}</dd>
                </div>
              </dl>
            ) : (
              <p className="operational-note">No encontramos esa cédula en la red compartida.</p>
            )}
            {result.lastRiskReportedAt ? (
              <p className="verification-risk-notice">
                <WarningDiamond aria-hidden="true" size={20} weight="fill" />
                Última alerta registrada el {formatDate(result.lastRiskReportedAt)}. Verifica la
                situación directamente antes de tomar una decisión.
              </p>
            ) : null}
            <small className="verification-search-disclaimer">
              No mostramos el documento completo, teléfonos, direcciones, notas ni la empresa que
              registró la información.
            </small>
          </div>
        ) : null}
      </section>

      {canManageRiskRegistry ? (
        <section className="dashboard-card verification-risk-card">
          <div className="card-heading verification-risk-heading">
            <div>
              <span className="panel-eyebrow">Alertas internas de riesgo</span>
              <h2>Registrar una cédula</h2>
              <p>
                Úsalo cuando solo conoces la cédula y tienes un motivo verificable. No necesitas
                crear un cliente ni inventar datos faltantes.
              </p>
            </div>
            <button
              className="verification-risk-add"
              onClick={() => {
                setRiskError("");
                setIsRiskModalOpen(true);
              }}
              ref={riskAddButtonRef}
              type="button"
            >
              <Plus aria-hidden="true" size={20} weight="bold" />
              Agregar alerta
            </button>
          </div>
          {riskStatus ? (
            <p className="form-message form-message-success" role="status">
              {riskStatus}
            </p>
          ) : null}
          <div className="verification-risk-list" aria-live="polite">
            {riskEntries.length ? (
              riskEntries.map((entry) => (
                <article className="verification-risk-item" key={entry.id}>
                  <div className="verification-risk-icon" aria-hidden="true">
                    {entry.status === "active" ? (
                      <ShieldWarning size={24} weight="duotone" />
                    ) : (
                      <CheckCircle size={24} weight="duotone" />
                    )}
                  </div>
                  <div>
                    <div className="verification-risk-item-title">
                      <strong>Cédula terminada en {entry.documentLast4}</strong>
                      <span
                        className={`status ${entry.status === "active" ? "status-rejected" : "status-draft"}`}
                      >
                        {riskStatusLabels[entry.status]}
                      </span>
                    </div>
                    <span>{riskCategoryLabels[entry.category]}</span>
                    <p>{entry.note}</p>
                    <small>
                      Registrada por {entry.createdByName} · {formatDate(entry.createdAt)}
                    </small>
                  </div>
                  {entry.status === "active" ? (
                    <button
                      className="verification-risk-resolve"
                      disabled={isRiskBusy}
                      onClick={() => void resolveRiskEntry(entry)}
                      type="button"
                    >
                      Retirar
                    </button>
                  ) : null}
                </article>
              ))
            ) : (
              <p className="verification-risk-empty">
                Aún no hay alertas registradas por esta empresa.
              </p>
            )}
          </div>
        </section>
      ) : null}

      {isRiskModalOpen ? (
        <div className="panel-modal-layer verification-risk-modal-layer">
          <section
            aria-describedby="verification-risk-modal-description"
            aria-labelledby="verification-risk-modal-title"
            aria-modal="true"
            className="panel-modal verification-risk-modal"
            ref={riskModalRef}
            role="dialog"
          >
            <div className="panel-modal-heading">
              <div>
                <span className="panel-eyebrow">Nueva alerta</span>
                <h2 id="verification-risk-modal-title">Registrar cédula en riesgo</h2>
              </div>
              <button
                aria-label="Cerrar"
                className="modal-close"
                onClick={() => setIsRiskModalOpen(false)}
                type="button"
              >
                <X aria-hidden="true" size={22} weight="bold" />
              </button>
            </div>
            <p className="verification-risk-modal-intro" id="verification-risk-modal-description">
              Guarda únicamente información comprobable. La cédula se cifra y la nota solo será
              visible para propietarios y supervisores de esta empresa.
            </p>
            <form
              aria-busy={isRiskBusy}
              className="verification-risk-form"
              onSubmit={createRiskEntry}
            >
              <label htmlFor="risk-document-number">
                Número de cédula
                <input
                  autoComplete="off"
                  id="risk-document-number"
                  inputMode="numeric"
                  maxLength={32}
                  name="documentNumber"
                  onInput={(event) => {
                    event.currentTarget.value = event.currentTarget.value.replace(/\D/g, "");
                  }}
                  placeholder="1020304050"
                  ref={riskDocumentInputRef}
                  required
                />
              </label>
              <label htmlFor="risk-category">
                Motivo
                <select defaultValue="" id="risk-category" name="category" required>
                  <option disabled value="">
                    Selecciona un motivo
                  </option>
                  <option value="repeated_late_payment">Mora reiterada</option>
                  <option value="payment_default">Incumplimiento de pago</option>
                  <option value="unreachable">No localizado</option>
                </select>
              </label>
              <label htmlFor="risk-note">
                Nota de respaldo
                <textarea
                  id="risk-note"
                  maxLength={500}
                  minLength={10}
                  name="note"
                  placeholder="Describe brevemente qué ocurrió y cuándo."
                  required
                  rows={4}
                />
                <small>
                  Mínimo 10 caracteres. No agregues insultos ni datos que no puedas verificar.
                </small>
              </label>
              {riskError ? (
                <p className="form-message form-message-error" role="alert">
                  {riskError}
                </p>
              ) : null}
              <div className="verification-risk-form-actions">
                <button onClick={() => setIsRiskModalOpen(false)} type="button">
                  Cancelar
                </button>
                <button disabled={isRiskBusy} type="submit">
                  <ShieldWarning aria-hidden="true" size={20} weight="bold" />
                  {isRiskBusy ? "Guardando…" : "Guardar alerta"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}

export const VerificationNetworkPanel = ClientVerificationSearch;
