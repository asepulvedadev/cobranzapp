"use client";

import {
  type Borrower,
  type BorrowerDirectory as BorrowerDirectoryData,
  borrowerAddressUpdateRequestSchema,
  borrowerCreateRequestSchema,
} from "@cobranzapp/contracts";
import { useRouter } from "next/navigation";
import { type ChangeEvent, type FormEvent, useRef, useState } from "react";
import { formatApiError } from "../../api-error";
import { Modal } from "../../Modal";
import { useSensitiveFetch } from "../../ReauthenticationProvider";
import { BorrowerDocumentUpload } from "./BorrowerDocumentUpload";
import { BorrowerOcrControl } from "./BorrowerOcrControl";
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

function wazeUrl(address: string, location: Borrower["addressLocations"]["home"]) {
  if (location.status === "ready" && location.latitude !== null && location.longitude !== null) {
    return `https://www.waze.com/ul?ll=${location.latitude},${location.longitude}&navigate=yes`;
  }
  return `https://www.waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`;
}

function whatsappUrl(phone: string) {
  const digits = phone.replace(/\D/g, "");
  // Colombian numbers are stored as entered by the operator. Add the country
  // code only when a local ten-digit number was provided.
  const normalized = digits.length === 10 && digits.startsWith("3") ? `57${digits}` : digits;
  return normalized ? `https://wa.me/${normalized}` : null;
}

function composeAddress(street: string, locality: string) {
  return [street.trim(), locality.trim()].filter(Boolean).join(", ");
}

function splitAddress(value: string) {
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return { street: value, locality: "" };
  return { street: parts.slice(0, -1).join(", "), locality: parts.at(-1) ?? "" };
}

const CREATE_STEPS = [
  { label: "Identidad", detail: "Datos y documentos" },
  { label: "Contacto", detail: "Teléfonos y direcciones" },
  { label: "Referencias", detail: "Personas de confianza" },
  { label: "Revisión", detail: "Confirma y guarda" },
] as const;

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
  const [toastMessage, setToastMessage] = useState("");
  const [addressEditBorrower, setAddressEditBorrower] = useState<Borrower | null>(null);
  const [addressEditHome, setAddressEditHome] = useState("");
  const [addressEditHomeLocality, setAddressEditHomeLocality] = useState("");
  const [addressEditWork, setAddressEditWork] = useState("");
  const [addressEditWorkLocality, setAddressEditWorkLocality] = useState("");
  const [addressEditHomeConfirmed, setAddressEditHomeConfirmed] = useState(false);
  const [addressEditWorkConfirmed, setAddressEditWorkConfirmed] = useState(false);
  const [isAddressSaving, setIsAddressSaving] = useState(false);
  const [geocodeBusy, setGeocodeBusy] = useState("");
  const [includeSecondContact, setIncludeSecondContact] = useState(false);
  const [homeAddressConfirmed, setHomeAddressConfirmed] = useState(false);
  const [workAddressConfirmed, setWorkAddressConfirmed] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [createdBorrowerId, setCreatedBorrowerId] = useState<string | null>(null);
  const [uploadedDocumentFields, setUploadedDocumentFields] = useState<string[]>([]);
  const [selectedUploadNames, setSelectedUploadNames] = useState<Record<string, string>>({});
  const createFormRef = useRef<HTMLFormElement>(null);

  function closeCreateModal(force = false) {
    if (isSubmitting && !force) return;
    setIsCreateOpen(false);
    setCreatedBorrowerId(null);
    setUploadedDocumentFields([]);
    setSelectedUploadNames({});
    setIncludeSecondContact(false);
    setHomeAddressConfirmed(false);
    setWorkAddressConfirmed(false);
    setCreateStep(1);
  }

  function fieldValue(name: string) {
    const element = createFormRef.current?.elements.namedItem(name);
    return element instanceof HTMLInputElement ? element.value : "";
  }

  function selectUpload(event: ChangeEvent<HTMLInputElement>, field: string) {
    setSelectedUploadNames((current) => ({
      ...current,
      [field]: event.currentTarget.files?.[0]?.name ?? "",
    }));
    setMessage("");
    setIsError(false);
  }

  function validateCreateStep(step: number) {
    const errors: Record<number, string> = {
      1: "Completa el nombre, número y las imágenes del documento antes de continuar.",
      2: "Completa el celular, WhatsApp, cada dirección y su barrio/municipio; luego confirma que fueron verificadas con el cliente.",
      3: "Registra al menos una referencia y el consentimiento del cliente.",
    };
    if (step === 1) {
      const files = ["identityFront", "identityBack", "profilePhoto"].map((name) =>
        createFormRef.current?.elements.namedItem(name),
      );
      const hasFiles = files.every(
        (element) => element instanceof HTMLInputElement && element.files?.[0],
      );
      if (!fieldValue("fullName") || !fieldValue("documentNumber") || !hasFiles) {
        setMessage(errors[step]);
        setIsError(true);
        return false;
      }
    }
    if (
      step === 2 &&
      (!fieldValue("phone") ||
        !fieldValue("whatsappPhone") ||
        !fieldValue("homeAddress") ||
        !fieldValue("homeAddressLocality") ||
        !fieldValue("workAddress") ||
        !fieldValue("workAddressLocality") ||
        !homeAddressConfirmed ||
        !workAddressConfirmed)
    ) {
      setMessage(errors[step]);
      setIsError(true);
      return false;
    }
    if (
      step === 3 &&
      (!fieldValue("contactName") ||
        !fieldValue("contactRelationship") ||
        !fieldValue("contactPhone") ||
        !fieldValue("consentEvidenceRef"))
    ) {
      setMessage(errors[step]);
      setIsError(true);
      return false;
    }
    setMessage("");
    setIsError(false);
    return true;
  }

  function nextCreateStep() {
    if (validateCreateStep(createStep)) setCreateStep((step) => Math.min(4, step + 1));
  }

  async function geocodeAddress(
    borrowerId: string,
    addressKind: "home" | "work",
    coordinates?: { latitude: number; longitude: number },
  ) {
    const key = `${borrowerId}:${addressKind}`;
    setGeocodeBusy(key);
    const response = await sensitiveFetch(
      `/api/v1/tenants/${tenantId}/borrowers/${borrowerId}/geocode`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ addressKind, ...coordinates }),
      },
    ).catch(() => null);
    setGeocodeBusy("");
    if (!response?.ok) {
      setMessage("No fue posible ubicar la dirección. Verifica el texto e inténtalo de nuevo.");
      setIsError(true);
      return;
    }
    setMessage("Dirección ubicada y guardada para las rutas.");
    setIsError(false);
    router.refresh();
  }

  function captureDeviceLocation(borrowerId: string, addressKind: "home" | "work") {
    const key = `${borrowerId}:${addressKind}`;
    if (!navigator.geolocation) {
      setMessage(
        "Este dispositivo no permite obtener la ubicación. Escribe la dirección y ubícala.",
      );
      setIsError(true);
      return;
    }
    setGeocodeBusy(key);
    setMessage("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void geocodeAddress(borrowerId, addressKind, {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => {
        setGeocodeBusy("");
        setMessage(
          "No se pudo obtener la ubicación. Permítela solo cuando estés frente al cliente.",
        );
        setIsError(true);
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 15_000 },
    );
  }

  function openAddressEditor(borrower: Borrower) {
    const home = splitAddress(borrower.homeAddress);
    const work = splitAddress(borrower.workAddress);
    setAddressEditBorrower(borrower);
    setAddressEditHome(home.street);
    setAddressEditHomeLocality(home.locality);
    setAddressEditWork(work.street);
    setAddressEditWorkLocality(work.locality);
    setAddressEditHomeConfirmed(borrower.homeAddressStatus === "confirmed");
    setAddressEditWorkConfirmed(borrower.workAddressStatus === "confirmed");
    setMessage("");
    setIsError(false);
  }

  async function saveAddresses(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!addressEditBorrower) return;
    if (
      !addressEditHome.trim() ||
      !addressEditHomeLocality.trim() ||
      !addressEditWork.trim() ||
      !addressEditWorkLocality.trim()
    ) {
      setMessage("Completa la dirección, barrio y municipio de casa y trabajo antes de guardar.");
      setIsError(true);
      return;
    }
    const addressPayload = {
      homeAddress: composeAddress(addressEditHome, addressEditHomeLocality),
      workAddress: composeAddress(addressEditWork, addressEditWorkLocality),
      homeAddressConfirmed: addressEditHomeConfirmed,
      workAddressConfirmed: addressEditWorkConfirmed,
    };
    const parsedAddress = borrowerAddressUpdateRequestSchema.safeParse(addressPayload);
    if (!parsedAddress.success) {
      setMessage(parsedAddress.error.issues[0]?.message ?? "Revisa las dos direcciones.");
      setIsError(true);
      return;
    }
    setIsAddressSaving(true);
    setMessage("");
    const response = await sensitiveFetch(
      `/api/v1/tenants/${tenantId}/borrowers/${addressEditBorrower.id}/addresses`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsedAddress.data),
      },
    ).catch(() => null);
    setIsAddressSaving(false);
    if (!response?.ok) {
      const body = await response?.json().catch(() => ({}));
      setMessage(formatApiError(body, "No fue posible actualizar las direcciones."));
      setIsError(true);
      return;
    }
    setAddressEditBorrower(null);
    setMessage("Direcciones actualizadas. Vuelve a ubicarlas para usar Waze con precisión.");
    setIsError(false);
    router.refresh();
  }

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
    let borrowerId = createdBorrowerId;
    if (!borrowerId) {
      const payload = {
        fullName: String(form.get("fullName") ?? "").trim(),
        country: "CO",
        documentType: String(form.get("documentType") ?? "CC"),
        documentNumber: String(form.get("documentNumber") ?? "").trim(),
        phone: String(form.get("phone") ?? "").trim(),
        whatsappPhone: String(form.get("whatsappPhone") ?? "").trim(),
        homeAddress: composeAddress(
          String(form.get("homeAddress") ?? ""),
          String(form.get("homeAddressLocality") ?? ""),
        ),
        workAddress: composeAddress(
          String(form.get("workAddress") ?? ""),
          String(form.get("workAddressLocality") ?? ""),
        ),
        homeAddressConfirmed,
        workAddressConfirmed,
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
      };
      const parsedPayload = borrowerCreateRequestSchema.safeParse(payload);
      if (!parsedPayload.success) {
        setMessage(parsedPayload.error.issues[0]?.message ?? "Revisa los datos del cliente.");
        setIsError(true);
        setIsSubmitting(false);
        return;
      }
      const response = await sensitiveFetch(`/api/v1/tenants/${tenantId}/borrowers`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsedPayload.data),
      }).catch(() => null);
      if (!response?.ok) {
        const body = await response?.json().catch(() => ({}));
        setMessage(formatApiError(body, "No fue posible crear el cliente."));
        setIsError(true);
        setIsSubmitting(false);
        return;
      }
      const created = (await response.json().catch(() => null)) as {
        borrower?: { id?: string };
      } | null;
      borrowerId = created?.borrower?.id ?? null;
      if (borrowerId) setCreatedBorrowerId(borrowerId);
    }
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
    const uploadedFields = new Set(uploadedDocumentFields);
    if (borrowerId) {
      for (const upload of uploads) {
        if (uploadedFields.has(upload.field)) continue;
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
        if (!uploadResponse?.ok) {
          uploadFailure = true;
        } else {
          uploadedFields.add(upload.field);
        }
      }
    }
    setUploadedDocumentFields(Array.from(uploadedFields));
    if (uploadFailure) {
      setMessage(
        borrowerId
          ? "El cliente quedó creado, pero faltan imágenes por guardar. Mantén esta ventana abierta y pulsa reintentar; no se volverá a crear el cliente."
          : "No fue posible crear el cliente. Revisa la conexión e inténtalo de nuevo.",
      );
      setIsError(true);
      setIsSubmitting(false);
      router.refresh();
      return;
    }
    const createdName = String(form.get("fullName") ?? "").trim();
    event.currentTarget.reset();
    setMessage(
      "Cliente creado. Las imágenes quedaron privadas y el OCR se procesará en segundo plano para revisión humana.",
    );
    setToastMessage(`${createdName || "Cliente"} creado correctamente.`);
    setIsError(false);
    setIsSubmitting(false);
    closeCreateModal(true);
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
                onClick={() => {
                  setCreatedBorrowerId(null);
                  setUploadedDocumentFields([]);
                  setSelectedUploadNames({});
                  setMessage("");
                  setIsError(false);
                  setToastMessage("");
                  setIsCreateOpen(true);
                }}
                type="button"
              >
                Nuevo cliente
              </button>
            ) : null}
          </div>
        </div>
        {toastMessage ? (
          <div className="borrower-toast" role="status">
            <span aria-hidden="true">✓</span>
            <div>
              <strong>{toastMessage}</strong>
              <small>Ya puedes buscarlo en el directorio o crearle su primer crédito.</small>
            </div>
            <button aria-label="Cerrar aviso" onClick={() => setToastMessage("")} type="button">
              ×
            </button>
          </div>
        ) : null}
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
                            <small>
                              {borrower.homeAddressStatus === "confirmed"
                                ? "Dirección confirmada"
                                : "Pendiente de confirmar"}
                            </small>
                            <small>
                              {borrower.addressLocations.home.status === "ready"
                                ? `Ubicada: ${borrower.addressLocations.home.formattedAddress}`
                                : borrower.addressLocations.home.status === "failed"
                                  ? "No se pudo ubicar; puedes reintentar"
                                  : "Sin coordenadas todavía"}
                            </small>
                            <button
                              className="button-link"
                              disabled={geocodeBusy === `${borrower.id}:home`}
                              onClick={() => void geocodeAddress(borrower.id, "home")}
                              type="button"
                            >
                              {geocodeBusy === `${borrower.id}:home`
                                ? "Ubicando…"
                                : borrower.addressLocations.home.status === "ready"
                                  ? "Actualizar ubicación"
                                  : "Ubicar dirección"}
                            </button>
                            <button
                              className="button-link"
                              disabled={geocodeBusy === `${borrower.id}:home`}
                              onClick={() => captureDeviceLocation(borrower.id, "home")}
                              type="button"
                            >
                              Usar GPS del dispositivo
                            </button>
                            <a
                              href={wazeUrl(borrower.homeAddress, borrower.addressLocations.home)}
                              rel="noreferrer"
                              target="_blank"
                            >
                              Abrir en Waze
                            </a>
                          </div>
                          <div>
                            <span>Trabajo</span>
                            <strong>{borrower.workAddress}</strong>
                            <small>
                              {borrower.workAddressStatus === "confirmed"
                                ? "Dirección confirmada"
                                : "Pendiente de confirmar"}
                            </small>
                            <small>
                              {borrower.addressLocations.work.status === "ready"
                                ? `Ubicada: ${borrower.addressLocations.work.formattedAddress}`
                                : borrower.addressLocations.work.status === "failed"
                                  ? "No se pudo ubicar; puedes reintentar"
                                  : "Sin coordenadas todavía"}
                            </small>
                            <button
                              className="button-link"
                              disabled={geocodeBusy === `${borrower.id}:work`}
                              onClick={() => void geocodeAddress(borrower.id, "work")}
                              type="button"
                            >
                              {geocodeBusy === `${borrower.id}:work`
                                ? "Ubicando…"
                                : borrower.addressLocations.work.status === "ready"
                                  ? "Actualizar ubicación"
                                  : "Ubicar dirección"}
                            </button>
                            <button
                              className="button-link"
                              disabled={geocodeBusy === `${borrower.id}:work`}
                              onClick={() => captureDeviceLocation(borrower.id, "work")}
                              type="button"
                            >
                              Usar GPS del dispositivo
                            </button>
                            <a
                              href={wazeUrl(borrower.workAddress, borrower.addressLocations.work)}
                              rel="noreferrer"
                              target="_blank"
                            >
                              Abrir en Waze
                            </a>
                          </div>
                          <button
                            className="button-secondary borrower-address-edit-button"
                            onClick={() => openAddressEditor(borrower)}
                            type="button"
                          >
                            Corregir direcciones
                          </button>
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
                            <BorrowerOcrControl borrowerId={borrower.id} tenantId={tenantId} />
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
                      <small>WhatsApp: {borrower.whatsappPhone ?? borrower.phone}</small>
                      {whatsappUrl(borrower.whatsappPhone ?? borrower.phone) ? (
                        <a
                          href={whatsappUrl(borrower.whatsappPhone ?? borrower.phone) ?? undefined}
                          rel="noreferrer"
                          target="_blank"
                        >
                          Abrir WhatsApp
                        </a>
                      ) : null}
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
        <Modal
          className="borrower-create-modal"
          onClose={() => closeCreateModal()}
          title="Crear cliente"
        >
          <div className="borrower-modal-intro">
            <div>
              <span className="panel-eyebrow">Registro guiado · 4 pasos</span>
              <p>
                Completa lo esencial primero. Puedes volver atrás sin perder los datos y las
                imágenes quedan privadas para revisión.
              </p>
            </div>
            <span className="borrower-step-counter">Paso {createStep} de 4</span>
          </div>
          <form
            className="tenant-form borrower-create-form"
            noValidate
            onSubmit={submit}
            ref={createFormRef}
          >
            <nav className="borrower-stepper" aria-label="Pasos para crear cliente">
              {CREATE_STEPS.map((item, index) => {
                const step = index + 1;
                const completed = step < createStep;
                return (
                  <button
                    aria-current={createStep === step ? "step" : undefined}
                    className={`borrower-step${createStep === step ? " is-active" : ""}${completed ? " is-complete" : ""}`}
                    disabled={step > createStep}
                    key={item.label}
                    onClick={() => step < createStep && setCreateStep(step)}
                    type="button"
                  >
                    <span>{completed ? "✓" : step}</span>
                    <strong>{item.label}</strong>
                    <small>{item.detail}</small>
                  </button>
                );
              })}
            </nav>

            <div
              aria-label={`Progreso: paso ${createStep} de 4`}
              aria-valuemax={4}
              aria-valuemin={1}
              aria-valuenow={createStep}
              className="borrower-progress"
              role="progressbar"
            >
              <span style={{ width: `${(createStep / 4) * 100}%` }} />
            </div>

            <section aria-labelledby="borrower-step-document" hidden={createStep !== 1}>
              <div className="borrower-section-heading">
                <div>
                  <span className="borrower-section-kicker">Paso 1 · Identidad</span>
                  <h3 id="borrower-step-document">¿Quién es tu cliente?</h3>
                </div>
                <span className="borrower-required-note">Todo es obligatorio</span>
              </div>
              <p className="borrower-section-help">
                Captura frente y reverso desde el celular. El OCR se ejecutará en segundo plano; sus
                sugerencias siempre deben confirmarse manualmente.
              </p>
              <div className="borrower-form-grid borrower-form-grid-identity">
                <label className="borrower-field borrower-field-wide" htmlFor="borrower-full-name">
                  Nombre completo
                  <input id="borrower-full-name" name="fullName" maxLength={160} />
                </label>
                <label className="borrower-field">
                  Tipo
                  <select defaultValue="CC" name="documentType">
                    <option value="CC">Cédula de ciudadanía</option>
                    <option value="CE">Cédula de extranjería</option>
                    <option value="PPT">Permiso por protección temporal</option>
                  </select>
                </label>
                <label className="borrower-field">
                  Número de documento
                  <input name="documentNumber" inputMode="numeric" maxLength={32} />
                </label>
              </div>
              <div className="borrower-upload-grid">
                <label
                  className={`borrower-upload-card${selectedUploadNames.identityFront ? " is-selected" : ""}`}
                >
                  <span className="borrower-upload-icon" aria-hidden="true">
                    1
                  </span>
                  <strong>
                    {selectedUploadNames.identityFront ? "Frente listo" : "Frente de la cédula"}
                  </strong>
                  <small>{selectedUploadNames.identityFront ?? "Foto nítida, sin reflejos"}</small>
                  <input
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    capture="environment"
                    name="identityFront"
                    onChange={(event) => selectUpload(event, "identityFront")}
                    type="file"
                  />
                  <span className="borrower-upload-cta">
                    {selectedUploadNames.identityFront ? "Cambiar archivo" : "Tomar o elegir foto"}
                  </span>
                </label>
                <label
                  className={`borrower-upload-card${selectedUploadNames.identityBack ? " is-selected" : ""}`}
                >
                  <span className="borrower-upload-icon" aria-hidden="true">
                    2
                  </span>
                  <strong>
                    {selectedUploadNames.identityBack ? "Reverso listo" : "Reverso de la cédula"}
                  </strong>
                  <small>
                    {selectedUploadNames.identityBack ?? "Incluye todos los datos visibles"}
                  </small>
                  <input
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    capture="environment"
                    name="identityBack"
                    onChange={(event) => selectUpload(event, "identityBack")}
                    type="file"
                  />
                  <span className="borrower-upload-cta">
                    {selectedUploadNames.identityBack ? "Cambiar archivo" : "Tomar o elegir foto"}
                  </span>
                </label>
                <label
                  className={`borrower-upload-card${selectedUploadNames.profilePhoto ? " is-selected" : ""}`}
                >
                  <span className="borrower-upload-icon" aria-hidden="true">
                    3
                  </span>
                  <strong>
                    {selectedUploadNames.profilePhoto ? "Foto lista" : "Foto de perfil"}
                  </strong>
                  <small>
                    {selectedUploadNames.profilePhoto ?? "La foto que el cliente designe"}
                  </small>
                  <input
                    accept="image/jpeg,image/png,image/webp"
                    name="profilePhoto"
                    onChange={(event) => selectUpload(event, "profilePhoto")}
                    type="file"
                  />
                  <span className="borrower-upload-cta">
                    {selectedUploadNames.profilePhoto ? "Cambiar archivo" : "Tomar o elegir foto"}
                  </span>
                </label>
              </div>
              <div className="borrower-inline-tip">
                <span aria-hidden="true">i</span>
                <span>
                  No es una selfie obligatoria: usa la foto de perfil que el cliente designe.
                </span>
              </div>
            </section>

            <section aria-labelledby="borrower-step-contact" hidden={createStep !== 2}>
              <div className="borrower-section-heading">
                <div>
                  <span className="borrower-section-kicker">Paso 2 · Contacto</span>
                  <h3 id="borrower-step-contact">¿Cómo lo contactas y dónde lo visitas?</h3>
                </div>
                <span className="borrower-required-note">Direcciones verificadas</span>
              </div>
              <p className="borrower-section-help">
                Guarda la dirección completa: calle/carrera, número, barrio y municipio. Así se
                conserva correctamente en el expediente y Waze puede ubicarla mejor.
              </p>
              <div className="borrower-form-grid borrower-form-grid-contact">
                <label className="borrower-field" htmlFor="borrower-phone">
                  Celular principal
                  <input id="borrower-phone" name="phone" maxLength={30} type="tel" />
                </label>
                <label className="borrower-field" htmlFor="borrower-whatsapp">
                  WhatsApp
                  <input id="borrower-whatsapp" name="whatsappPhone" maxLength={30} type="tel" />
                  <small>Puede ser el mismo número</small>
                </label>
              </div>
              <div className="borrower-address-grid">
                <fieldset className="borrower-address-card">
                  <legend>Casa</legend>
                  <label htmlFor="borrower-home">Dirección completa</label>
                  <input
                    id="borrower-home"
                    name="homeAddress"
                    maxLength={240}
                    placeholder="Calle 10 # 20-30"
                  />
                  <label htmlFor="borrower-home-locality">Barrio y municipio</label>
                  <input
                    id="borrower-home-locality"
                    name="homeAddressLocality"
                    maxLength={100}
                    placeholder="Centro, Cúcuta"
                  />
                  <label className="checkbox-row address-confirmation">
                    <input
                      checked={homeAddressConfirmed}
                      onChange={(event) => setHomeAddressConfirmed(event.target.checked)}
                      type="checkbox"
                    />
                    <span>Verificada con el cliente</span>
                  </label>
                </fieldset>
                <fieldset className="borrower-address-card">
                  <legend>Trabajo</legend>
                  <label htmlFor="borrower-work">Dirección completa</label>
                  <input
                    id="borrower-work"
                    name="workAddress"
                    maxLength={240}
                    placeholder="Carrera 5 # 12-40"
                  />
                  <label htmlFor="borrower-work-locality">Barrio y municipio</label>
                  <input
                    id="borrower-work-locality"
                    name="workAddressLocality"
                    maxLength={100}
                    placeholder="La Playa, Cúcuta"
                  />
                  <label className="checkbox-row address-confirmation">
                    <input
                      checked={workAddressConfirmed}
                      onChange={(event) => setWorkAddressConfirmed(event.target.checked)}
                      type="checkbox"
                    />
                    <span>Verificada con el cliente</span>
                  </label>
                </fieldset>
              </div>
            </section>

            <section aria-labelledby="borrower-step-references" hidden={createStep !== 3}>
              <div className="borrower-section-heading">
                <div>
                  <span className="borrower-section-kicker">Paso 3 · Referencias</span>
                  <h3 id="borrower-step-references">¿A quién podemos llamar?</h3>
                </div>
                <span className="borrower-required-note">Mínimo 1</span>
              </div>
              <p className="borrower-section-help">
                Registra una referencia como mínimo. Puedes añadir una segunda si la necesitas.
              </p>
              <fieldset className="borrower-contact-fieldset">
                <legend>Referencia principal</legend>
                <input
                  aria-label="Nombre de la referencia"
                  name="contactName"
                  placeholder="Nombre completo"
                  maxLength={120}
                />
                <input
                  aria-label="Relación de la referencia"
                  name="contactRelationship"
                  placeholder="Relación"
                  maxLength={80}
                />
                <input
                  aria-label="Celular de la referencia"
                  name="contactPhone"
                  placeholder="Celular"
                  maxLength={30}
                  type="tel"
                />
                <label className="checkbox-row">
                  <input
                    checked={includeSecondContact}
                    onChange={(event) => setIncludeSecondContact(event.target.checked)}
                    type="checkbox"
                  />
                  <span>Agregar una segunda referencia</span>
                </label>
                {includeSecondContact ? (
                  <>
                    <input
                      aria-label="Nombre de la segunda referencia"
                      name="secondContactName"
                      placeholder="Nombre completo"
                      maxLength={120}
                    />
                    <input
                      aria-label="Relación de la segunda referencia"
                      name="secondContactRelationship"
                      placeholder="Relación"
                      maxLength={80}
                    />
                    <input
                      aria-label="Celular de la segunda referencia"
                      name="secondContactPhone"
                      placeholder="Celular"
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
                maxLength={240}
              />
            </section>

            <section aria-labelledby="borrower-step-confirm" hidden={createStep !== 4}>
              <div className="borrower-section-heading">
                <div>
                  <span className="borrower-section-kicker">Paso 4 · Revisión</span>
                  <h3 id="borrower-step-confirm">Revisa y crea el cliente</h3>
                </div>
                <span className="borrower-required-note">Listo para guardar</span>
              </div>
              <p className="borrower-section-help">
                Se guardarán los datos diligenciados, las dos caras del documento, la foto de perfil
                y las referencias.
              </p>
              <ul className="borrower-confirmation-list">
                <li>Documento frente y reverso en almacenamiento privado.</li>
                <li>Celular, WhatsApp y direcciones completas con barrio y municipio.</li>
                <li>Una o dos referencias de contacto.</li>
              </ul>
            </section>

            {message ? (
              <p
                className={`tenant-form-message${isError ? " form-message-error" : ""}`}
                role="status"
              >
                {message}
              </p>
            ) : null}
            <div className="borrower-step-actions">
              {createStep > 1 ? (
                <button onClick={() => setCreateStep((step) => step - 1)} type="button">
                  Atrás
                </button>
              ) : null}
              {createStep < 4 ? (
                <button onClick={nextCreateStep} type="button">
                  Continuar
                </button>
              ) : (
                <button className="borrower-submit-button" disabled={isSubmitting} type="submit">
                  {isSubmitting
                    ? "Guardando…"
                    : createdBorrowerId
                      ? "Reintentar imágenes"
                      : "Crear cliente"}
                </button>
              )}
            </div>
          </form>
        </Modal>
      ) : null}

      {addressEditBorrower ? (
        <Modal
          onClose={() => setAddressEditBorrower(null)}
          title={`Corregir direcciones de ${addressEditBorrower.fullName}`}
        >
          <form className="tenant-form borrower-address-edit-form" onSubmit={saveAddresses}>
            <p className="operational-note">
              Al guardar se eliminan las coordenadas anteriores para evitar enviar al cobrador a una
              ubicación desactualizada. Confirma cada dirección con el cliente.
            </p>
            <label htmlFor="edit-borrower-home">Dirección de casa</label>
            <textarea
              id="edit-borrower-home"
              maxLength={240}
              onChange={(event) => {
                setAddressEditHome(event.target.value);
                // A correction must be confirmed again with the client. Keeping the
                // previous confirmation would allow a stale location to be saved.
                setAddressEditHomeConfirmed(false);
              }}
              required
              rows={3}
              value={addressEditHome}
            />
            <label htmlFor="edit-borrower-home-locality">Barrio y municipio de casa</label>
            <input
              id="edit-borrower-home-locality"
              maxLength={100}
              onChange={(event) => {
                setAddressEditHomeLocality(event.target.value);
                setAddressEditHomeConfirmed(false);
              }}
              required
              value={addressEditHomeLocality}
            />
            <label className="checkbox-row address-confirmation">
              <input
                checked={addressEditHomeConfirmed}
                onChange={(event) => setAddressEditHomeConfirmed(event.target.checked)}
                type="checkbox"
              />
              <span>Confirmo que la dirección de casa está completa y fue verificada.</span>
            </label>
            <label htmlFor="edit-borrower-work">Dirección de trabajo</label>
            <textarea
              id="edit-borrower-work"
              maxLength={240}
              onChange={(event) => {
                setAddressEditWork(event.target.value);
                // A correction must be confirmed again with the client. Keeping the
                // previous confirmation would allow a stale location to be saved.
                setAddressEditWorkConfirmed(false);
              }}
              required
              rows={3}
              value={addressEditWork}
            />
            <label htmlFor="edit-borrower-work-locality">Barrio y municipio de trabajo</label>
            <input
              id="edit-borrower-work-locality"
              maxLength={100}
              onChange={(event) => {
                setAddressEditWorkLocality(event.target.value);
                setAddressEditWorkConfirmed(false);
              }}
              required
              value={addressEditWorkLocality}
            />
            <label className="checkbox-row address-confirmation">
              <input
                checked={addressEditWorkConfirmed}
                onChange={(event) => setAddressEditWorkConfirmed(event.target.checked)}
                type="checkbox"
              />
              <span>Confirmo que la dirección de trabajo está completa y fue verificada.</span>
            </label>
            <button disabled={isAddressSaving} type="submit">
              {isAddressSaving ? "Guardando…" : "Guardar direcciones"}
            </button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
