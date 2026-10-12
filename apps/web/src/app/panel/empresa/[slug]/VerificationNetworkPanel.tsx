"use client";

import type { VerificationNetworkQueryResponse } from "@cobranzapp/contracts";
import { type FormEvent, useState } from "react";
import { useSensitiveFetch } from "../../ReauthenticationProvider";

type VerificationPurpose = "credit_evaluation" | "portfolio_management" | "customer_request";

const purposeLabels: Record<VerificationPurpose, string> = {
  credit_evaluation: "Evaluación de crédito",
  portfolio_management: "Gestión de cartera",
  customer_request: "Solicitud de la persona",
};

const categoryLabels = {
  late_payment: "pago tardío",
  payment_default: "incumplimiento",
} as const;

function requestId() {
  return crypto.randomUUID();
}

async function errorMessage(response: Response | null, fallback: string) {
  const body = (await response?.json().catch(() => ({}))) as {
    error?: { message?: string };
  };
  return body.error?.message ?? fallback;
}

function futureIsoDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function resultLabel(result: VerificationNetworkQueryResponse["result"]) {
  return {
    not_found: "Sin registro compartido",
    no_observation: "Sin observaciones activas",
    reported: "Observaciones activas",
    disputed: "Observación en disputa",
    no_consent: "Consentimiento no válido",
  }[result];
}

export function VerificationNetworkPanel({
  tenantId,
  canPublish,
}: {
  tenantId: string;
  canPublish: boolean;
}) {
  const sensitiveFetch = useSensitiveFetch();
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [consentToken, setConsentToken] = useState("");
  const [queryResult, setQueryResult] = useState<VerificationNetworkQueryResponse | null>(null);

  async function submitConsent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsBusy(true);
    setMessage("");
    setIsError(false);
    const data = new FormData(event.currentTarget);
    const response = await sensitiveFetch(
      `/api/v1/tenants/${tenantId}/verification-network/consents`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          country: "CO",
          documentType: String(data.get("consentDocumentType") ?? "CC"),
          documentNumber: String(data.get("consentDocumentNumber") ?? "").trim(),
          purpose: String(data.get("consentPurpose") ?? "credit_evaluation") as VerificationPurpose,
          policyVersion: "verification-network-v1",
          evidenceRef: String(data.get("consentEvidenceRef") ?? "").trim(),
          expiresAt: futureIsoDate(30),
          requestId: requestId(),
        }),
      },
    ).catch(() => null);
    if (!response?.ok) {
      setMessage(await errorMessage(response, "No fue posible registrar el consentimiento."));
      setIsError(true);
      setIsBusy(false);
      return;
    }
    const body = (await response.json()) as {
      consent?: { consentToken?: string; expiresAt?: string };
    };
    const token = body.consent?.consentToken ?? "";
    setConsentToken(token);
    setMessage(
      token
        ? "Consentimiento registrado. Entrega este token a la persona titular y no lo publiques."
        : "Consentimiento registrado.",
    );
    event.currentTarget.reset();
    setIsBusy(false);
  }

  async function submitQuery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsBusy(true);
    setMessage("");
    setIsError(false);
    const data = new FormData(event.currentTarget);
    const response = await fetch(`/api/v1/tenants/${tenantId}/verification-network/query`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        country: "CO",
        documentType: String(data.get("queryDocumentType") ?? "CC"),
        documentNumber: String(data.get("queryDocumentNumber") ?? "").trim(),
        consentToken: String(data.get("queryConsentToken") ?? consentToken).trim(),
        purpose: String(data.get("queryPurpose") ?? "credit_evaluation") as VerificationPurpose,
        requestId: requestId(),
      }),
    }).catch(() => null);
    if (!response?.ok) {
      setMessage(await errorMessage(response, "No fue posible consultar la red compartida."));
      setIsError(true);
      setIsBusy(false);
      return;
    }
    setQueryResult((await response.json()) as VerificationNetworkQueryResponse);
    setMessage("Consulta registrada. Solo se muestran datos mínimos y explicables.");
    setIsBusy(false);
  }

  async function submitAssertion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsBusy(true);
    setMessage("");
    setIsError(false);
    const data = new FormData(event.currentTarget);
    const response = await sensitiveFetch(
      `/api/v1/tenants/${tenantId}/verification-network/assertions`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          country: "CO",
          documentType: String(data.get("assertionDocumentType") ?? "CC"),
          documentNumber: String(data.get("assertionDocumentNumber") ?? "").trim(),
          consentToken: String(data.get("assertionConsentToken") ?? consentToken).trim(),
          category: String(data.get("assertionCategory") ?? "late_payment"),
          observedFrom: new Date(String(data.get("assertionObservedFrom") ?? "")).toISOString(),
          observedTo: null,
          evidenceRef: String(data.get("assertionEvidenceRef") ?? "").trim(),
          expiresAt: futureIsoDate(90),
          requestId: requestId(),
        }),
      },
    ).catch(() => null);
    if (!response?.ok) {
      setMessage(await errorMessage(response, "No fue posible publicar la observación."));
      setIsError(true);
      setIsBusy(false);
      return;
    }
    setMessage("Observación publicada con consentimiento y fecha de vencimiento.");
    event.currentTarget.reset();
    setIsBusy(false);
  }

  async function submitCorrection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsBusy(true);
    setMessage("");
    setIsError(false);
    const data = new FormData(event.currentTarget);
    const response = await fetch(`/api/v1/tenants/${tenantId}/verification-network/corrections`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        country: "CO",
        documentType: String(data.get("correctionDocumentType") ?? "CC"),
        documentNumber: String(data.get("correctionDocumentNumber") ?? "").trim(),
        consentToken: String(data.get("correctionConsentToken") ?? consentToken).trim(),
        assertionId: null,
        message: String(data.get("correctionMessage") ?? "").trim(),
        requestId: requestId(),
      }),
    }).catch(() => null);
    if (!response?.ok) {
      setMessage(await errorMessage(response, "No fue posible abrir la corrección."));
      setIsError(true);
      setIsBusy(false);
      return;
    }
    setMessage("Solicitud de corrección abierta para revisión.");
    event.currentTarget.reset();
    setIsBusy(false);
  }

  return (
    <section className="dashboard-card verification-network-card" id="verificacion-compartida">
      <div className="card-heading">
        <div>
          <span className="panel-eyebrow">Red de confianza</span>
          <h2>Verificación compartida</h2>
        </div>
        <span className="status status-active">Consentimiento primero</span>
      </div>
      <p className="operational-note">
        No es una lista negra. La persona autoriza cada uso y solo se comparte el estado mínimo, con
        fecha de vencimiento, explicación y opción de corrección.
      </p>

      {canPublish ? (
        <form className="verification-form" onSubmit={submitConsent}>
          <h3>Registrar consentimiento</h3>
          <div className="borrower-form-row">
            <label>
              Tipo de documento
              <select defaultValue="CC" name="consentDocumentType">
                <option value="CC">Cédula de ciudadanía</option>
                <option value="CE">Cédula de extranjería</option>
                <option value="PPT">Permiso por protección temporal</option>
              </select>
            </label>
            <label>
              Número de documento
              <input name="consentDocumentNumber" required inputMode="numeric" maxLength={32} />
            </label>
          </div>
          <label>
            Propósito
            <select defaultValue="credit_evaluation" name="consentPurpose">
              {Object.entries(purposeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Evidencia del consentimiento
            <input
              name="consentEvidenceRef"
              placeholder="Ej. formulario firmado 2026-10-12"
              required
              maxLength={240}
            />
          </label>
          <button disabled={isBusy} type="submit">
            {isBusy ? "Guardando…" : "Registrar y generar token"}
          </button>
        </form>
      ) : null}

      <form className="verification-form" onSubmit={submitQuery}>
        <h3>Consultar con autorización</h3>
        <div className="borrower-form-row">
          <label>
            Tipo de documento
            <select defaultValue="CC" name="queryDocumentType">
              <option value="CC">Cédula de ciudadanía</option>
              <option value="CE">Cédula de extranjería</option>
              <option value="PPT">Permiso por protección temporal</option>
            </select>
          </label>
          <label>
            Número de documento
            <input name="queryDocumentNumber" required inputMode="numeric" maxLength={32} />
          </label>
        </div>
        <label>
          Token entregado por la persona
          <input
            defaultValue={consentToken}
            name="queryConsentToken"
            required
            minLength={40}
            maxLength={120}
          />
        </label>
        <label>
          Propósito
          <select defaultValue="credit_evaluation" name="queryPurpose">
            {Object.entries(purposeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button disabled={isBusy} type="submit">
          {isBusy ? "Consultando…" : "Consultar red"}
        </button>
      </form>

      {consentToken ? (
        <div className="verification-token" role="status">
          <strong>Token generado (se muestra una sola vez en esta sesión)</strong>
          <code>{consentToken}</code>
          <button onClick={() => void navigator.clipboard?.writeText(consentToken)} type="button">
            Copiar token
          </button>
        </div>
      ) : null}

      {queryResult ? (
        <div className="verification-result" aria-live="polite">
          <span className={`status status-${queryResult.result}`}>
            {resultLabel(queryResult.result)}
          </span>
          <p>
            Observaciones activas: <strong>{queryResult.activeObservations}</strong>
            {queryResult.lastUpdatedAt
              ? ` · última actualización ${new Date(queryResult.lastUpdatedAt).toLocaleDateString("es-CO")}`
              : ""}
          </p>
          {queryResult.categories.length ? (
            <p>
              Categorías:{" "}
              {queryResult.categories.map((category) => categoryLabels[category]).join(", ")}
            </p>
          ) : null}
        </div>
      ) : null}

      {canPublish ? (
        <form className="verification-form" onSubmit={submitAssertion}>
          <h3>Publicar una observación explicable</h3>
          <p className="form-help">
            Solo después de contar con consentimiento vigente y evidencia verificable.
          </p>
          <div className="borrower-form-row">
            <label>
              Tipo
              <select defaultValue="CC" name="assertionDocumentType">
                <option value="CC">CC</option>
                <option value="CE">CE</option>
                <option value="PPT">PPT</option>
              </select>
            </label>
            <label>
              Documento
              <input name="assertionDocumentNumber" required inputMode="numeric" maxLength={32} />
            </label>
          </div>
          <label>
            Token de consentimiento
            <input
              defaultValue={consentToken}
              name="assertionConsentToken"
              required
              minLength={40}
            />
          </label>
          <label>
            Categoría
            <select defaultValue="late_payment" name="assertionCategory">
              <option value="late_payment">Pago tardío</option>
              <option value="payment_default">Incumplimiento</option>
            </select>
          </label>
          <label>
            Fecha observada
            <input name="assertionObservedFrom" required type="date" />
          </label>
          <label>
            Evidencia
            <input name="assertionEvidenceRef" required maxLength={240} />
          </label>
          <button disabled={isBusy} type="submit">
            {isBusy ? "Publicando…" : "Publicar observación"}
          </button>
        </form>
      ) : null}

      <form className="verification-form" onSubmit={submitCorrection}>
        <h3>Solicitar corrección</h3>
        <div className="borrower-form-row">
          <label>
            Tipo
            <select defaultValue="CC" name="correctionDocumentType">
              <option value="CC">CC</option>
              <option value="CE">CE</option>
              <option value="PPT">PPT</option>
            </select>
          </label>
          <label>
            Documento
            <input name="correctionDocumentNumber" required inputMode="numeric" maxLength={32} />
          </label>
        </div>
        <label>
          Token de consentimiento
          <input
            defaultValue={consentToken}
            name="correctionConsentToken"
            required
            minLength={40}
          />
        </label>
        <label>
          Explicación de la corrección
          <textarea name="correctionMessage" required minLength={10} maxLength={1000} />
        </label>
        <button disabled={isBusy} type="submit">
          {isBusy ? "Enviando…" : "Abrir corrección"}
        </button>
      </form>

      {message ? (
        <p className={`tenant-form-message${isError ? " form-message-error" : ""}`} role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
