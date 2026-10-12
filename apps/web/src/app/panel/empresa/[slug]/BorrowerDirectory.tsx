"use client";

import type { Borrower, BorrowerDirectory as BorrowerDirectoryData } from "@cobranzapp/contracts";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { useSensitiveFetch } from "../../ReauthenticationProvider";
import { BorrowerDocumentUpload } from "./BorrowerDocumentUpload";
import { BorrowerReviewControl } from "./BorrowerReviewControl";

function statusLabel(status: Borrower["identity"]["verificationState"]) {
  return status === "reviewed"
    ? "Revisado"
    : status === "rejected"
      ? "Rechazado"
      : "Pendiente de revisión";
}

export function BorrowerDirectory({
  tenantId,
  directory,
  canReview,
}: {
  tenantId: string;
  directory: BorrowerDirectoryData;
  canReview: boolean;
}) {
  const router = useRouter();
  const sensitiveFetch = useSensitiveFetch();
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsError(false);
    setIsSubmitting(true);
    const form = new FormData(event.currentTarget);
    const response = await sensitiveFetch(`/api/v1/tenants/${tenantId}/borrowers`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fullName: String(form.get("fullName") ?? "").trim(),
        country: "CO",
        documentType: String(form.get("documentType") ?? "CC"),
        documentNumber: String(form.get("documentNumber") ?? "").trim(),
        phone: String(form.get("phone") ?? "").trim(),
        homeAddress: String(form.get("homeAddress") ?? "").trim(),
        workAddress: String(form.get("workAddress") ?? "").trim(),
        profilePhotoObjectKey: null,
        consentVersion: "borrower-dossier-v1",
        consentEvidenceRef: String(form.get("consentEvidenceRef") ?? "").trim(),
        emergencyContacts: [
          {
            fullName: String(form.get("contactName") ?? "").trim(),
            relationship: String(form.get("contactRelationship") ?? "").trim(),
            phone: String(form.get("contactPhone") ?? "").trim(),
          },
        ],
        documents: [],
      }),
    }).catch(() => null);
    if (!response?.ok) {
      const body = (await response?.json().catch(() => ({}))) as { error?: { message?: string } };
      setMessage(body.error?.message ?? "No fue posible crear el cliente.");
      setIsError(true);
      setIsSubmitting(false);
      return;
    }
    event.currentTarget.reset();
    setMessage(
      "Cliente creado. Completa sus documentos privados antes de usarlo en una operación.",
    );
    setIsSubmitting(false);
    router.refresh();
  }

  return (
    <div className="borrower-directory-grid">
      <section className="borrower-list" aria-label="Directorio de clientes">
        <div className="card-heading">
          <div>
            <span className="panel-eyebrow">Cartera</span>
            <h2>Clientes</h2>
          </div>
          <span>{directory.pagination.total} registrados</span>
        </div>
        <p className="operational-note">
          La búsqueda muestra el nombre y los últimos cuatro dígitos. Nunca se expone el número
          completo.
        </p>
        {directory.borrowers.length ? (
          <div className="tenant-table-wrap">
            <table className="tenant-table borrower-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Documento</th>
                  <th>Contacto</th>
                  <th>Estado de identidad</th>
                  <th>Documentos</th>
                  <th>Revisión</th>
                </tr>
              </thead>
              <tbody>
                {directory.borrowers.map((borrower) => (
                  <tr key={borrower.id}>
                    <td data-label="Cliente">
                      <strong>{borrower.fullName}</strong>
                      <small>{borrower.emergencyContacts.length} contacto(s) de emergencia</small>
                    </td>
                    <td data-label="Documento">
                      <strong>{borrower.identity.documentType}</strong>
                      <small>•••• {borrower.identity.documentLast4}</small>
                    </td>
                    <td data-label="Contacto">
                      <strong>{borrower.phone}</strong>
                      <small>{borrower.documents.length} documento(s) privado(s)</small>
                    </td>
                    <td data-label="Estado de identidad">
                      <span className={`status status-${borrower.identity.verificationState}`}>
                        {statusLabel(borrower.identity.verificationState)}
                      </span>
                    </td>
                    <td data-label="Documentos">
                      <BorrowerDocumentUpload borrowerId={borrower.id} tenantId={tenantId} />
                    </td>
                    <td data-label="Revisión">
                      <BorrowerReviewControl
                        borrower={borrower}
                        canReview={canReview}
                        tenantId={tenantId}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <span aria-hidden="true">◇</span>
            <h3>Aún no hay clientes</h3>
            <p>Registra el primer cliente con sus datos de contacto y consentimiento.</p>
          </div>
        )}
      </section>

      <section className="dashboard-card borrower-create-card">
        <div className="card-heading">
          <div>
            <span className="panel-eyebrow">Alta rápida</span>
            <h2>Nuevo cliente</h2>
          </div>
        </div>
        <p className="operational-note">
          Esta primera captura no hace OCR ni afirma autenticidad. La carga de documentos privados
          se completa en el paso documental.
        </p>
        <form className="tenant-form" onSubmit={submit}>
          <label htmlFor="borrower-full-name">Nombre completo</label>
          <input id="borrower-full-name" name="fullName" required maxLength={160} />
          <div className="borrower-form-row">
            <label>
              Tipo
              <select defaultValue="CC" name="documentType">
                <option value="CC">Cédula de ciudadanía</option>
                <option value="CE">Cédula de extranjería</option>
                <option value="PPT">Permiso por protección temporal</option>
              </select>
            </label>
            <label>
              Número de documento
              <input name="documentNumber" required inputMode="numeric" maxLength={32} />
            </label>
          </div>
          <label htmlFor="borrower-phone">Celular</label>
          <input id="borrower-phone" name="phone" required maxLength={30} type="tel" />
          <label htmlFor="borrower-home">Dirección de casa</label>
          <input id="borrower-home" name="homeAddress" required maxLength={240} />
          <label htmlFor="borrower-work">Dirección de trabajo</label>
          <input id="borrower-work" name="workAddress" required maxLength={240} />
          <fieldset className="borrower-contact-fieldset">
            <legend>Contacto de emergencia</legend>
            <input
              aria-label="Nombre del contacto"
              name="contactName"
              placeholder="Nombre completo"
              required
              maxLength={120}
            />
            <input
              aria-label="Relación del contacto"
              name="contactRelationship"
              placeholder="Relación"
              required
              maxLength={80}
            />
            <input
              aria-label="Celular del contacto"
              name="contactPhone"
              placeholder="Celular"
              required
              maxLength={30}
              type="tel"
            />
          </fieldset>
          <label htmlFor="borrower-consent">Referencia de consentimiento</label>
          <input
            id="borrower-consent"
            name="consentEvidenceRef"
            placeholder="Ej. formulario físico 2026-10-12"
            required
            maxLength={240}
          />
          {message ? (
            <p
              className={`tenant-form-message${isError ? " form-message-error" : ""}`}
              role="status"
            >
              {message}
            </p>
          ) : null}
          <button disabled={isSubmitting} type="submit">
            {isSubmitting ? "Guardando…" : "Crear cliente"}
          </button>
        </form>
      </section>
    </div>
  );
}
