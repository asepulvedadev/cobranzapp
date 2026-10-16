"use client";

import type { Borrower } from "@cobranzapp/contracts";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSensitiveFetch } from "../../ReauthenticationProvider";

function documentLabel(document: Borrower["documents"][number]) {
  if (document.category === "profile_photo") return "Selfie del cliente";
  return document.side === "front" ? "Documento · frente" : "Documento · reverso";
}

function scanLabel(status: Borrower["documents"][number]["scanStatus"]) {
  return status === "accepted" ? "Aceptado" : status === "rejected" ? "Rechazado" : "Pendiente";
}

async function responseMessage(response: Response | null, fallback: string) {
  const body = (await response?.json().catch(() => ({}))) as {
    error?: { message?: string };
  };
  return body.error?.message ?? fallback;
}

export function BorrowerReviewControl({
  tenantId,
  borrower,
  canReview,
}: {
  tenantId: string;
  borrower: Borrower;
  canReview: boolean;
}) {
  const router = useRouter();
  const sensitiveFetch = useSensitiveFetch();
  const [notes, setNotes] = useState("");
  const [legalNameConfirmed, setLegalNameConfirmed] = useState(false);
  const [identityFrontConfirmed, setIdentityFrontConfirmed] = useState(false);
  const [identityBackConfirmed, setIdentityBackConfirmed] = useState(false);
  const [profilePhotoConfirmed, setProfilePhotoConfirmed] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const hasIdentityBack = borrower.documents.some(
    (document) => document.category === "identity" && document.side === "back",
  );

  if (!canReview) return <span className="table-muted">Revisión restringida</span>;

  async function submit(event: { preventDefault: () => void }, decision: "reviewed" | "rejected") {
    event.preventDefault();
    setIsBusy(true);
    setMessage("");
    setIsError(false);
    const response = await sensitiveFetch(
      `/api/v1/tenants/${tenantId}/borrowers/${borrower.id}/review`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          decision,
          notes: notes.trim(),
          legalNameConfirmed,
          identityFrontConfirmed,
          identityBackConfirmed,
          profilePhotoConfirmed,
        }),
      },
    ).catch(() => null);
    if (!response?.ok) {
      setMessage(await responseMessage(response, "No fue posible guardar la revisión."));
      setIsError(true);
      setIsBusy(false);
      return;
    }
    setMessage(decision === "reviewed" ? "Identidad revisada." : "Identidad rechazada.");
    setIsBusy(false);
    router.refresh();
  }

  return (
    <details className="borrower-review-control">
      <summary>Revisar identidad</summary>
      <div className="borrower-review-body">
        <ul className="borrower-document-checklist">
          {borrower.documents.length ? (
            borrower.documents.map((document) => (
              <li key={document.id}>
                <span>{documentLabel(document)}</span>
                <small>{scanLabel(document.scanStatus)}</small>
              </li>
            ))
          ) : (
            <li>
              <span>Sin documentos privados</span>
              <small>Pendiente</small>
            </li>
          )}
        </ul>
        <form onSubmit={(event) => void submit(event, "reviewed")}>
          <label className="review-check">
            <input
              checked={legalNameConfirmed}
              onChange={(event) => setLegalNameConfirmed(event.target.checked)}
              type="checkbox"
            />
            Confirmo que el nombre coincide con la evidencia disponible.
          </label>
          <label className="review-check">
            <input
              checked={identityFrontConfirmed}
              onChange={(event) => setIdentityFrontConfirmed(event.target.checked)}
              type="checkbox"
            />
            Revisé el frente del documento.
          </label>
          {hasIdentityBack ? (
            <label className="review-check">
              <input
                checked={identityBackConfirmed}
                onChange={(event) => setIdentityBackConfirmed(event.target.checked)}
                type="checkbox"
              />
              Revisé el reverso opcional adjunto.
            </label>
          ) : null}
          <label className="review-check">
            <input
              checked={profilePhotoConfirmed}
              onChange={(event) => setProfilePhotoConfirmed(event.target.checked)}
              type="checkbox"
            />
            Confirmo que existe la selfie actual del cliente.
          </label>
          <label>
            Nota de revisión
            <textarea
              minLength={10}
              maxLength={500}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Describe la evidencia y cualquier corrección solicitada."
              required
              value={notes}
            />
          </label>
          <div className="borrower-review-actions">
            <button disabled={isBusy} type="submit">
              {isBusy ? "Guardando…" : "Marcar revisado"}
            </button>
            <button
              className="review-reject-button"
              disabled={isBusy}
              onClick={(event) => void submit(event, "rejected")}
              type="button"
            >
              Rechazar
            </button>
          </div>
          {message ? (
            <p
              className={`tenant-form-message${isError ? " form-message-error" : ""}`}
              role="status"
            >
              {message}
            </p>
          ) : null}
        </form>
      </div>
    </details>
  );
}
