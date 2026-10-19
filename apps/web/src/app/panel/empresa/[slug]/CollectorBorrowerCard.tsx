"use client";

import type { Borrower, BorrowerOcrExtraction } from "@cobranzapp/contracts";
import Image from "next/image";
import { type FormEvent, type ReactNode, useState } from "react";
import { Modal } from "../../Modal";
import { useSensitiveFetch } from "../../ReauthenticationProvider";
import { ClientPortalLink } from "./ClientPortalLink";

function identityStatusLabel(status: Borrower["identity"]["verificationState"]) {
  return status === "reviewed" ? "Verificado" : status === "rejected" ? "Rechazado" : "En revisión";
}

function addressStatusLabel(location: Borrower["addressLocations"]["home"]) {
  return location.status === "ready"
    ? "Ubicación lista"
    : location.status === "failed"
      ? "Falta ubicar"
      : "Sin ubicación";
}

export function extractedIdentityRows(fields: NonNullable<BorrowerOcrExtraction["fields"]>) {
  return [
    ["Nombres", fields.firstNames],
    ["Apellidos", fields.lastNames],
    ["Nombre completo", fields.fullName],
    ["Número de documento", fields.documentNumber],
    ["Tipo de documento", fields.documentType],
    ["País", fields.country],
    ["Nacionalidad", fields.nationality],
    ["Fecha de nacimiento", fields.birthDate],
    ["Lugar de nacimiento", fields.birthPlace],
    ["Sexo", fields.sex],
    ["Estatura", fields.height],
    ["Grupo sanguíneo / RH", fields.bloodType],
    ["Fecha de expedición", fields.issueDate],
    ["Lugar de expedición", fields.issuePlace],
    ["Fecha de vencimiento", fields.expirationDate],
    ["Número serial", fields.serialNumber],
  ].filter((row): row is [string, string] => Boolean(row[1]));
}

export function CollectorBorrowerCard({
  borrower,
  tenantId,
  creditHref,
  whatsappHref,
  homeWazeHref,
  workWazeHref,
  onEditAddresses,
  documentTools,
  assignmentTools,
  reviewTools,
}: {
  borrower: Borrower;
  tenantId: string;
  creditHref: string | null;
  whatsappHref: string | null;
  homeWazeHref: string;
  workWazeHref: string;
  onEditAddresses: () => void;
  documentTools: ReactNode;
  assignmentTools?: ReactNode;
  reviewTools?: ReactNode;
}) {
  const sensitiveFetch = useSensitiveFetch();
  const [isEvidenceOpen, setIsEvidenceOpen] = useState(false);
  const [ocrState, setOcrState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [ocrExtractions, setOcrExtractions] = useState<BorrowerOcrExtraction[]>([]);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<
    "payment_postponed" | "refuses_payment" | "unreachable"
  >("payment_postponed");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportMessage, setReportMessage] = useState("");
  const [reportError, setReportError] = useState("");
  const initials = borrower.fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  const phoneHref = `tel:${borrower.phone.replace(/[^\d+]/g, "")}`;
  const evidenceDocuments = [...borrower.documents].sort((left, right) => {
    const priority = (document: Borrower["documents"][number]) =>
      document.category === "profile_photo" ? 0 : document.side === "front" ? 1 : 2;
    return priority(left) - priority(right);
  });
  const selfie = evidenceDocuments.find((document) => document.category === "profile_photo");
  const documentUrl = (documentId: string) =>
    `/api/v1/tenants/${tenantId}/borrowers/${borrower.id}/documents/${documentId}`;
  const bestExtraction = ocrExtractions
    .filter((extraction) => extraction.fields)
    .sort((left, right) => (right.confidence ?? 0) - (left.confidence ?? 0))[0];

  async function loadOcrEvidence() {
    setOcrState("loading");
    const response = await sensitiveFetch(
      `/api/v1/tenants/${tenantId}/borrowers/${borrower.id}/ocr`,
    ).catch(() => null);
    if (!response?.ok) {
      setOcrState("error");
      return;
    }
    const body = (await response.json()) as { extractions?: BorrowerOcrExtraction[] };
    setOcrExtractions(body.extractions ?? []);
    setOcrState("ready");
  }

  function openEvidence() {
    setIsEvidenceOpen(true);
    if (ocrState === "idle" || ocrState === "error") void loadOcrEvidence();
  }

  async function submitCollectionReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReportBusy(true);
    setReportError("");
    const form = new FormData(event.currentTarget);
    const response = await sensitiveFetch(
      `/api/v1/tenants/${tenantId}/borrowers/${borrower.id}/collection-reports`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reason: reportReason,
          followUpDate:
            reportReason === "payment_postponed"
              ? String(form.get("followUpDate") ?? "") || null
              : null,
          notes: String(form.get("notes") ?? "").trim() || null,
        }),
      },
    ).catch(() => null);
    if (!response?.ok) {
      const body = (await response?.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      setReportError(body.error?.message ?? "No fue posible guardar el reporte.");
      setReportBusy(false);
      return;
    }
    const label =
      reportReason === "payment_postponed"
        ? "Cobro aplazado"
        : reportReason === "refuses_payment"
          ? "Negativa de pago"
          : "Cliente no localizado";
    setReportMessage(`${label} registrado.`);
    setReportBusy(false);
    setIsReportOpen(false);
  }

  return (
    <>
      <article className="collector-client-card">
        <header className="collector-client-heading">
          <button
            aria-label={`Ver fotos de ${borrower.fullName}`}
            className="collector-client-avatar"
            onClick={openEvidence}
            type="button"
          >
            {selfie ? (
              <Image alt="" height={46} src={documentUrl(selfie.id)} unoptimized width={46} />
            ) : (
              <span aria-hidden="true">{initials || "CL"}</span>
            )}
          </button>
          <div>
            <h3>{borrower.fullName}</h3>
            <p>
              {borrower.identity.documentType && borrower.identity.documentLast4
                ? `${borrower.identity.documentType} · •••• ${borrower.identity.documentLast4}`
                : "Documento pendiente de registrar"}
            </p>
          </div>
          <span
            className={`status collector-client-status status-${borrower.identity.verificationState}`}
          >
            {identityStatusLabel(borrower.identity.verificationState)}
          </span>
        </header>

        <div className="collector-client-contact">
          <span>Teléfono</span>
          <strong>{borrower.phone}</strong>
        </div>

        <div className="collector-client-assignee">
          <span>Cobrador asignado</span>
          <strong>{borrower.assignedCollectorName ?? "Sin asignar"}</strong>
        </div>

        <div className="collector-client-actions">
          {creditHref ? (
            <a
              className="collector-client-action collector-client-action-primary"
              href={creditHref}
            >
              Crear crédito
            </a>
          ) : (
            <span
              aria-disabled="true"
              className="collector-client-action collector-client-action-primary collector-client-action-disabled"
            >
              {borrower.identity.verificationState === "rejected"
                ? "Corrige y aprueba para crear crédito"
                : "Aprueba al cliente para crear crédito"}
            </span>
          )}
          <a className="collector-client-action" href={phoneHref}>
            Llamar
          </a>
          {whatsappHref ? (
            <a
              className="collector-client-action"
              href={whatsappHref}
              rel="noreferrer"
              target="_blank"
            >
              WhatsApp
            </a>
          ) : null}
          <ClientPortalLink
            borrowerId={borrower.id}
            borrowerName={borrower.fullName}
            tenantId={tenantId}
            whatsappPhone={borrower.whatsappPhone ?? borrower.phone}
          />
          <button
            className="collector-client-action"
            onClick={() => {
              setReportError("");
              setIsReportOpen(true);
            }}
            type="button"
          >
            Reportar gestión
          </button>
          <a
            className="collector-client-action"
            href={homeWazeHref}
            rel="noreferrer"
            target="_blank"
          >
            Ir a casa
          </a>
        </div>
        {reportMessage ? (
          <p className="collector-client-report-status" role="status">
            {reportMessage}
          </p>
        ) : null}

        <details className="collector-client-details">
          <summary>
            {reviewTools && borrower.identity.verificationState !== "reviewed"
              ? "Ver perfil y aprobar"
              : "Ver perfil completo"}
          </summary>
          <div className="collector-client-details-body">
            <section className="collector-client-address">
              <div>
                <span>Casa</span>
                <small>{addressStatusLabel(borrower.addressLocations.home)}</small>
              </div>
              <strong>{borrower.homeAddress}</strong>
              <div className="collector-client-address-actions">
                <a href={homeWazeHref} rel="noreferrer" target="_blank">
                  Abrir casa en Waze
                </a>
              </div>
            </section>

            <section className="collector-client-address">
              <div>
                <span>Trabajo</span>
                <small>{addressStatusLabel(borrower.addressLocations.work)}</small>
              </div>
              <strong>{borrower.workAddress}</strong>
              <div className="collector-client-address-actions">
                <a href={workWazeHref} rel="noreferrer" target="_blank">
                  Abrir trabajo en Waze
                </a>
              </div>
            </section>

            <button className="collector-client-edit" onClick={onEditAddresses} type="button">
              Corregir direcciones
            </button>

            {borrower.emergencyContacts.length ? (
              <section className="collector-client-emergency">
                <span>Contactos de emergencia</span>
                {borrower.emergencyContacts.map((contact) => (
                  <a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`} key={contact.id}>
                    <strong>{contact.fullName}</strong>
                    <small>
                      {contact.relationship} · {contact.phone}
                    </small>
                  </a>
                ))}
              </section>
            ) : null}

            <section className="collector-client-documents">
              <span>Documentos</span>
              <small>{borrower.documents.length} archivo(s) privado(s)</small>
              {documentTools}
            </section>
            {assignmentTools ? (
              <section className="collector-client-assignment">{assignmentTools}</section>
            ) : null}
            {reviewTools ? (
              <section className="collector-client-review">{reviewTools}</section>
            ) : null}
          </div>
        </details>
      </article>

      {isReportOpen ? (
        <Modal
          className="collection-report-modal"
          onClose={() => {
            if (!reportBusy) setIsReportOpen(false);
          }}
          title={`Reportar gestión · ${borrower.fullName}`}
        >
          <form className="tenant-form collection-report-form" onSubmit={submitCollectionReport}>
            <label>
              Resultado de la gestión
              <select
                onChange={(event) =>
                  setReportReason(
                    event.target.value as "payment_postponed" | "refuses_payment" | "unreachable",
                  )
                }
                value={reportReason}
              >
                <option value="payment_postponed">Aplazó el pago</option>
                <option value="refuses_payment">No quiere pagar</option>
                <option value="unreachable">No se logra localizar</option>
              </select>
            </label>
            {reportReason === "payment_postponed" ? (
              <label>
                Nueva fecha de cobro
                <input
                  min={new Date().toISOString().slice(0, 10)}
                  name="followUpDate"
                  required
                  type="date"
                />
              </label>
            ) : null}
            <label>
              Nota (opcional)
              <textarea
                maxLength={500}
                name="notes"
                placeholder="Describe brevemente lo ocurrido."
                rows={3}
              />
            </label>
            {reportError ? (
              <p className="form-message form-message-error" role="alert">
                {reportError}
              </p>
            ) : null}
            <div className="collection-report-actions">
              <button disabled={reportBusy} type="button" onClick={() => setIsReportOpen(false)}>
                Cancelar
              </button>
              <button className="primary-action" disabled={reportBusy} type="submit">
                {reportBusy ? "Guardando…" : "Guardar reporte"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {isEvidenceOpen ? (
        <Modal
          className="collector-evidence-modal"
          onClose={() => setIsEvidenceOpen(false)}
          title={`Fotos de ${borrower.fullName}`}
        >
          <div className="collector-evidence-gallery">
            {evidenceDocuments.length ? (
              evidenceDocuments.map((document) => {
                const label =
                  document.category === "profile_photo"
                    ? "Selfie del cliente"
                    : document.side === "front"
                      ? "Cédula · frente"
                      : "Cédula · reverso";
                const source = documentUrl(document.id);
                return (
                  <figure key={document.id}>
                    <figcaption>
                      <strong>{label}</strong>
                      <small>
                        {document.scanStatus === "accepted" ? "Validado" : "En revisión"}
                      </small>
                    </figcaption>
                    {document.mediaType.startsWith("image/") ? (
                      <Image alt={label} height={800} src={source} unoptimized width={1200} />
                    ) : (
                      <iframe src={source} title={label} />
                    )}
                    <a href={source} rel="noreferrer" target="_blank">
                      Abrir archivo completo
                    </a>
                  </figure>
                );
              })
            ) : (
              <div className="empty-state collector-evidence-empty">
                <h3>Sin fotos disponibles</h3>
                <p>Este cliente todavía no tiene selfie ni documento cargado.</p>
              </div>
            )}

            <section className="collector-evidence-data">
              <div className="collector-evidence-data-heading">
                <div>
                  <span>Documento</span>
                  <h3>Datos extraídos de la cédula</h3>
                </div>
                <button
                  disabled={ocrState === "loading"}
                  onClick={() => void loadOcrEvidence()}
                  type="button"
                >
                  {ocrState === "loading" ? "Consultando…" : "Actualizar"}
                </button>
              </div>

              {ocrState === "loading" ? (
                <p className="collector-evidence-message" role="status">
                  Consultando datos…
                </p>
              ) : bestExtraction?.fields ? (
                <>
                  <dl>
                    {extractedIdentityRows(bestExtraction.fields).map(([label, value]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                  {bestExtraction.fields.mrzLines.length || bestExtraction.fields.barcodeData ? (
                    <details>
                      <summary>Ver datos técnicos del documento</summary>
                      {bestExtraction.fields.mrzLines.length ? (
                        <pre>{bestExtraction.fields.mrzLines.join("\n")}</pre>
                      ) : null}
                      {bestExtraction.fields.barcodeData ? (
                        <p>{bestExtraction.fields.barcodeData}</p>
                      ) : null}
                    </details>
                  ) : null}
                  <small className="collector-evidence-confidence">
                    Confianza de lectura: {Math.round((bestExtraction.confidence ?? 0) * 100)}%
                  </small>
                </>
              ) : (
                <p className="collector-evidence-message" role="status">
                  {ocrState === "error"
                    ? "No fue posible consultar la lectura. Pulsa Actualizar para reintentar."
                    : "Todavía no hay datos extraídos para este documento."}
                </p>
              )}
            </section>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
