"use client";

import type { Borrower, BorrowerDirectory as BorrowerDirectoryData } from "@cobranzapp/contracts";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Modal } from "../../Modal";
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

function documentLabel(category: Borrower["documents"][number]["category"], side: string | null) {
  if (category === "profile_photo") return "Foto designada de perfil";
  return side === "front" ? "Documento · frente" : "Documento · reverso";
}

export function BorrowerDirectory({
  tenantId,
  directory,
  canCreate,
  canReview,
  search,
  tenantSlug,
}: {
  tenantId: string;
  directory: BorrowerDirectoryData;
  canCreate: boolean;
  canReview: boolean;
  search: string;
  tenantSlug: string;
}) {
  const router = useRouter();
  const sensitiveFetch = useSensitiveFetch();
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [includeSecondContact, setIncludeSecondContact] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsError(false);
    setIsSubmitting(true);
    const form = new FormData(event.currentTarget);
    const requiredFiles = ["identityFront", "identityBack", "profilePhoto"];
    if (
      requiredFiles.some((field) => {
        const file = form.get(field);
        return !(file instanceof File) || file.size === 0;
      })
    ) {
      setMessage("Adjunta frente, reverso y foto designada de perfil antes de guardar.");
      setIsError(true);
      setIsSubmitting(false);
      return;
    }
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
          ...(includeSecondContact
            ? [
                {
                  fullName: String(form.get("secondContactName") ?? "").trim(),
                  relationship: String(form.get("secondContactRelationship") ?? "").trim(),
                  phone: String(form.get("secondContactPhone") ?? "").trim(),
                },
              ]
            : []),
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
    const created = (await response.json().catch(() => null)) as {
      borrower?: { id?: string };
    } | null;
    const borrowerId = created?.borrower?.id;
    const uploads: Array<{
      field: string;
      category: "identity" | "profile_photo";
      side?: "front" | "back";
    }> = [
      { field: "identityFront", category: "identity", side: "front" },
      { field: "identityBack", category: "identity", side: "back" },
      { field: "profilePhoto", category: "profile_photo" },
    ];
    let uploadFailure = !borrowerId;
    if (borrowerId) {
      for (const upload of uploads) {
        const file = form.get(upload.field);
        if (!(file instanceof File) || file.size === 0) {
          uploadFailure = true;
          continue;
        }
        const body = new FormData();
        body.append("file", file);
        body.append("category", upload.category);
        if (upload.side) body.append("side", upload.side);
        const uploadResponse = await sensitiveFetch(
          `/api/v1/tenants/${tenantId}/borrowers/${borrowerId}/documents`,
          { method: "POST", body },
        ).catch(() => null);
        if (!uploadResponse?.ok) uploadFailure = true;
      }
    }
    event.currentTarget.reset();
    setIncludeSecondContact(false);
    setMessage(
      uploadFailure
        ? "Cliente creado, pero una o más imágenes no pudieron guardarse. Revisa la ficha y vuelve a cargarlas."
        : "Cliente creado con documento frente, reverso y foto de perfil en cuarentena privada; queda pendiente la revisión humana.",
    );
    setIsSubmitting(false);
    setIsCreateOpen(false);
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
          <div className="directory-header-actions">
            <span>{directory.pagination.total} registrados</span>
            {canCreate ? (
              <button
                className="primary-action"
                onClick={() => setIsCreateOpen(true)}
                type="button"
              >
                Nuevo cliente
              </button>
            ) : null}
          </div>
        </div>
        <p className="operational-note">
          La búsqueda muestra el nombre y los últimos cuatro dígitos. Nunca se expone el número
          completo.
        </p>
        <form className="tenant-directory-filters" action={`/panel/empresa/${tenantSlug}#clientes`}>
          <label>
            <span>Buscar cliente</span>
            <input
              defaultValue={search}
              maxLength={80}
              name="cliente"
              placeholder="Nombre o últimos dígitos"
              type="search"
            />
          </label>
          <div className="tenant-directory-filter-actions">
            <button type="submit">Buscar</button>
            {search ? <a href={`/panel/empresa/${tenantSlug}#clientes`}>Limpiar</a> : null}
          </div>
        </form>
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
                      <details className="borrower-details">
                        <summary>Ver ficha</summary>
                        <div className="borrower-details-content">
                          <div>
                            <span>Casa</span>
                            <strong>{borrower.homeAddress}</strong>
                          </div>
                          <div>
                            <span>Trabajo</span>
                            <strong>{borrower.workAddress}</strong>
                          </div>
                          <div>
                            <span>Contactos de emergencia</span>
                            {borrower.emergencyContacts.map((contact) => (
                              <strong key={contact.id}>
                                {contact.fullName} · {contact.relationship} · {contact.phone}
                              </strong>
                            ))}
                          </div>
                          <div>
                            <span>Documentos privados</span>
                            {borrower.documents.length ? (
                              borrower.documents.map((document) => (
                                <strong key={document.id}>
                                  {documentLabel(document.category, document.side)} ·{" "}
                                  {document.scanStatus}
                                </strong>
                              ))
                            ) : (
                              <strong>Pendientes de carga</strong>
                            )}
                          </div>
                        </div>
                      </details>
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
        {directory.pagination.totalPages > 1 ? (
          <nav className="tenant-directory-pagination" aria-label="Páginas de clientes">
            {directory.pagination.page > 1 ? (
              <a
                href={`/panel/empresa/${tenantSlug}?${new URLSearchParams({
                  ...(search ? { cliente: search } : {}),
                  paginaCliente: String(directory.pagination.page - 1),
                })}#clientes`}
              >
                Anterior
              </a>
            ) : (
              <span aria-disabled="true">Anterior</span>
            )}
            <strong>
              Página {directory.pagination.page} de {directory.pagination.totalPages}
            </strong>
            {directory.pagination.page < directory.pagination.totalPages ? (
              <a
                href={`/panel/empresa/${tenantSlug}?${new URLSearchParams({
                  ...(search ? { cliente: search } : {}),
                  paginaCliente: String(directory.pagination.page + 1),
                })}#clientes`}
              >
                Siguiente
              </a>
            ) : (
              <span aria-disabled="true">Siguiente</span>
            )}
          </nav>
        ) : null}
      </section>

      {canCreate && isCreateOpen ? (
        <Modal onClose={() => setIsCreateOpen(false)} title="Nuevo cliente">
          <div className="card-heading">
            <div>
              <span className="panel-eyebrow">Alta rápida</span>
              <h2>Nuevo cliente</h2>
            </div>
          </div>
          <p className="operational-note">
            Esta captura no hace OCR ni afirma autenticidad. Las imágenes se validan y se guardan en
            cuarentena privada para la revisión humana.
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
            <div className="borrower-form-row borrower-document-fields">
              <label>
                Cédula · frente
                <input
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  name="identityFront"
                  required
                  type="file"
                />
              </label>
              <label>
                Cédula · reverso
                <input
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  name="identityBack"
                  required
                  type="file"
                />
              </label>
            </div>
            <label>
              Foto designada de perfil
              <input
                accept="image/jpeg,image/png,image/webp"
                name="profilePhoto"
                required
                type="file"
              />
            </label>
            <small>
              Máximo 10 MB por archivo. No es una selfie ni se usa para afirmar autenticidad.
            </small>
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
              <label className="checkbox-row">
                <input
                  checked={includeSecondContact}
                  onChange={(event) => setIncludeSecondContact(event.target.checked)}
                  type="checkbox"
                />
                <span>Agregar un segundo contacto</span>
              </label>
              {includeSecondContact ? (
                <>
                  <input
                    aria-label="Nombre del segundo contacto"
                    name="secondContactName"
                    placeholder="Segundo contacto · nombre completo"
                    required
                    maxLength={120}
                  />
                  <input
                    aria-label="Relación del segundo contacto"
                    name="secondContactRelationship"
                    placeholder="Segundo contacto · relación"
                    required
                    maxLength={80}
                  />
                  <input
                    aria-label="Celular del segundo contacto"
                    name="secondContactPhone"
                    placeholder="Segundo contacto · celular"
                    required
                    maxLength={30}
                    type="tel"
                  />
                </>
              ) : null}
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
        </Modal>
      ) : null}
    </div>
  );
}
