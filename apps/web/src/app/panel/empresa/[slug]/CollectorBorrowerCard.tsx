"use client";

import type { Borrower } from "@cobranzapp/contracts";
import Image from "next/image";
import { type ReactNode, useState } from "react";
import { Modal } from "../../Modal";

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

export function CollectorBorrowerCard({
  borrower,
  tenantId,
  creditHref,
  whatsappHref,
  homeWazeHref,
  workWazeHref,
  onEditAddresses,
  documentTools,
}: {
  borrower: Borrower;
  tenantId: string;
  creditHref: string;
  whatsappHref: string | null;
  homeWazeHref: string;
  workWazeHref: string;
  onEditAddresses: () => void;
  documentTools: ReactNode;
}) {
  const [isEvidenceOpen, setIsEvidenceOpen] = useState(false);
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

  return (
    <>
      <article className="collector-client-card">
        <header className="collector-client-heading">
          <button
            aria-label={`Ver fotos de ${borrower.fullName}`}
            className="collector-client-avatar"
            onClick={() => setIsEvidenceOpen(true)}
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
              {borrower.identity.documentType} · •••• {borrower.identity.documentLast4}
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

        <div className="collector-client-actions">
          <a className="collector-client-action collector-client-action-primary" href={creditHref}>
            Crear crédito
          </a>
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
          <a
            className="collector-client-action"
            href={homeWazeHref}
            rel="noreferrer"
            target="_blank"
          >
            Ir a casa
          </a>
        </div>

        <details className="collector-client-details">
          <summary>Ver ficha y direcciones</summary>
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
          </div>
        </details>
      </article>

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
          </div>
        </Modal>
      ) : null}
    </>
  );
}
