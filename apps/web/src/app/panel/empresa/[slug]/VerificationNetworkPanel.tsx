"use client";

import { IdentificationCard, MagnifyingGlass } from "@phosphor-icons/react";
import { type FormEvent, useState } from "react";
import { fetchWithTimeout } from "../../../../lib/fetch-with-timeout";
import type { SharedClientVerification } from "../../../../lib/platform";

const ratingLabels: Record<SharedClientVerification["payerRating"], string> = {
  good: "Buen pagador",
  regular: "Pago regular",
  low: "Bajo",
  no_data: "Sin datos suficientes",
};

async function getError(response: Response | null) {
  const body = (await response?.json().catch(() => ({}))) as {
    error?: { message?: string };
  };
  return body.error?.message ?? "No fue posible completar la verificación.";
}

export function ClientVerificationSearch({ tenantId }: { tenantId: string }) {
  const [result, setResult] = useState<SharedClientVerification | null>(null);
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [consentConfirmed, setConsentConfirmed] = useState(false);

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

  return (
    <section className="dashboard-card verification-search-card">
      <div className="card-heading">
        <div>
          <span className="panel-eyebrow">Consulta interna</span>
          <h2>Verificar cliente</h2>
        </div>
        <span className="status status-active">Cédula</span>
      </div>
      <p className="operational-note">
        Busca en las empresas que usan cobranzapp. Solo mostramos el nombre, créditos vigentes,
        calificación y si existe un reporte negativo.
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
      {message ? <p className="form-message form-message-error">{message}</p> : null}
      {result ? (
        <div className="verification-search-result" aria-live="polite">
          <div className="verification-result-header">
            <div>
              <span className="panel-eyebrow">Resultado</span>
              <h3>{result.registered ? "Cliente registrado" : "No está registrado"}</h3>
            </div>
            <span className={`status ${result.registered ? "status-active" : "status-draft"}`}>
              {result.registered ? "Encontrado" : "Sin registro"}
            </span>
          </div>
          {result.registered ? (
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
                <dt>Reporte negativo</dt>
                <dd>{result.negativeReport ? "Sí" : "No"}</dd>
              </div>
            </dl>
          ) : (
            <p className="operational-note">No encontramos esa cédula en la red compartida.</p>
          )}
          <small className="verification-search-disclaimer">
            No mostramos documento completo, teléfonos, direcciones ni la empresa que registró la
            información.
          </small>
        </div>
      ) : null}
    </section>
  );
}

export const VerificationNetworkPanel = ClientVerificationSearch;
