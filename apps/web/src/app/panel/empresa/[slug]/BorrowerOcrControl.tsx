"use client";

import type { BorrowerOcrExtraction } from "@cobranzapp/contracts";
import { useState } from "react";
import { useSensitiveFetch } from "../../ReauthenticationProvider";

function sideLabel(side: BorrowerOcrExtraction["side"]) {
  return side === "front" ? "Frente" : side === "back" ? "Reverso" : "Documento";
}

function statusLabel(status: BorrowerOcrExtraction["status"]) {
  return {
    pending: "En cola",
    processing: "Procesando",
    ready: "Listo para confirmar",
    confirmed: "Confirmado",
    rejected: "Rechazado",
    failed: "No se pudo leer",
  }[status];
}

export function BorrowerOcrControl({
  borrowerId,
  tenantId,
}: {
  borrowerId: string;
  tenantId: string;
}) {
  const sensitiveFetch = useSensitiveFetch();
  const [extractions, setExtractions] = useState<BorrowerOcrExtraction[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    setBusy(true);
    setMessage("");
    const response = await sensitiveFetch(
      `/api/v1/tenants/${tenantId}/borrowers/${borrowerId}/ocr`,
    ).catch(() => null);
    if (!response?.ok) {
      setMessage("No fue posible consultar el resultado del OCR.");
      setBusy(false);
      return;
    }
    const body = (await response.json()) as { extractions?: BorrowerOcrExtraction[] };
    setExtractions(body.extractions ?? []);
    setBusy(false);
  }

  async function confirm(extraction: BorrowerOcrExtraction, form: HTMLFormElement) {
    const formData = new FormData(form);
    setBusy(true);
    setMessage("");
    const response = await sensitiveFetch(
      `/api/v1/tenants/${tenantId}/borrowers/${borrowerId}/ocr/${extraction.id}/confirm`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fullName: String(formData.get("fullName") ?? "").trim() || null,
          documentNumber: String(formData.get("documentNumber") ?? "").trim() || null,
        }),
      },
    ).catch(() => null);
    if (!response?.ok) {
      const body = (await response?.json().catch(() => ({}))) as { error?: { message?: string } };
      setMessage(body.error?.message ?? "No fue posible confirmar los datos.");
      setBusy(false);
      return;
    }
    setMessage("Datos OCR confirmados en el expediente.");
    await load();
  }

  async function retry(extraction: BorrowerOcrExtraction) {
    setBusy(true);
    setMessage("");
    const response = await sensitiveFetch(
      `/api/v1/tenants/${tenantId}/borrowers/${borrowerId}/ocr/${extraction.id}/retry`,
      { method: "POST" },
    ).catch(() => null);
    if (!response?.ok) {
      setMessage("No fue posible volver a procesar el documento.");
      setBusy(false);
      return;
    }
    setMessage("El documento volvió a la cola de OCR.");
    await load();
  }

  return (
    <div className="borrower-ocr-control">
      <button className="button-link" disabled={busy} onClick={() => void load()} type="button">
        {busy ? "Consultando…" : extractions ? "Actualizar lectura OCR" : "Consultar OCR"}
      </button>
      {message ? <small role="status">{message}</small> : null}
      {extractions?.length ? (
        <div className="borrower-ocr-list">
          {extractions.map((extraction) => (
            <form
              className="borrower-ocr-item"
              key={extraction.id}
              onSubmit={(event) => {
                event.preventDefault();
                void confirm(extraction, event.currentTarget);
              }}
            >
              <strong>
                {sideLabel(extraction.side)} · {statusLabel(extraction.status)}
              </strong>
              {extraction.fields ? (
                <>
                  <label>
                    Nombre sugerido
                    <input defaultValue={extraction.fields.fullName ?? ""} name="fullName" />
                  </label>
                  <label>
                    Número sugerido
                    <input
                      defaultValue={extraction.fields.documentNumber ?? ""}
                      inputMode="numeric"
                      name="documentNumber"
                    />
                  </label>
                  <small>
                    Confianza:{" "}
                    {extraction.confidence === null
                      ? "sin dato"
                      : `${Math.round(extraction.confidence * 100)}%`}
                  </small>
                  {extraction.status === "ready" ? (
                    <button disabled={busy} type="submit">
                      Confirmar datos
                    </button>
                  ) : null}
                </>
              ) : (
                <>
                  <small>{extraction.errorCode ?? "Aún no hay datos extraídos."}</small>
                  {extraction.status === "failed" || extraction.status === "rejected" ? (
                    <button disabled={busy} onClick={() => void retry(extraction)} type="button">
                      Reintentar lectura
                    </button>
                  ) : null}
                </>
              )}
            </form>
          ))}
        </div>
      ) : null}
    </div>
  );
}
