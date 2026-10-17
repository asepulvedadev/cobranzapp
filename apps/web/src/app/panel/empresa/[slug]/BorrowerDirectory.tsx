"use client";

import {
  type Borrower,
  type BorrowerDirectory as BorrowerDirectoryData,
  borrowerAddressUpdateRequestSchema,
  borrowerCreateRequestSchema,
  type IdentityDocumentExtraction,
  type TenantOverview,
} from "@cobranzapp/contracts";
import { useRouter } from "next/navigation";
import { type ChangeEvent, type FormEvent, useRef, useState } from "react";
import { formatApiError } from "../../api-error";
import { Modal } from "../../Modal";
import { useSensitiveFetch } from "../../ReauthenticationProvider";
import { BorrowerDocumentUpload } from "./BorrowerDocumentUpload";
import { BorrowerOcrControl } from "./BorrowerOcrControl";
import { BorrowerReviewControl } from "./BorrowerReviewControl";
import { borrowerDirectoryHref } from "./borrower-directory-query";
import { CollectorBorrowerCard } from "./CollectorBorrowerCard";

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
  { label: "Documento", detail: "Fotos y lectura" },
  { label: "Contacto", detail: "Teléfonos y direcciones" },
  { label: "Referencias", detail: "Personas de confianza" },
  { label: "Revisión", detail: "Confirma y guarda" },
] as const;

const browserReadyImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

async function prepareImageUpload(file: File) {
  if (file.size <= 2_400_000 && browserReadyImageTypes.has(file.type)) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("IMAGE_PROCESSING_UNAVAILABLE");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.86),
  );
  if (!blob) throw new Error("IMAGE_PROCESSING_UNAVAILABLE");
  return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "cedula"}.jpg`, {
    type: "image/jpeg",
  });
}

function identityDetailRows(extraction: IdentityDocumentExtraction) {
  const fields = extraction.fields;
  return [
    ["Nombres", fields.firstNames],
    ["Apellidos", fields.lastNames],
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

export function BorrowerDirectory({
  tenantId,
  directory,
  canCreate,
  canReview,
  search,
  tenantSlug,
  actorRole,
  collectors,
}: {
  tenantId: string;
  directory: BorrowerDirectoryData;
  canCreate: boolean;
  canReview: boolean;
  search: string;
  tenantSlug: string;
  actorRole: "owner" | "supervisor" | "collector";
  collectors: TenantOverview["members"];
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
  const [includeSecondContact, setIncludeSecondContact] = useState(false);
  const [homeAddressConfirmed, setHomeAddressConfirmed] = useState(false);
  const [workAddressConfirmed, setWorkAddressConfirmed] = useState(false);
  const [identityConfirmed, setIdentityConfirmed] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [createdBorrowerId, setCreatedBorrowerId] = useState<string | null>(null);
  const [uploadedDocumentFields, setUploadedDocumentFields] = useState<string[]>([]);
  const [selectedUploadNames, setSelectedUploadNames] = useState<Record<string, string>>({});
  const [ocrStatus, setOcrStatus] = useState<"idle" | "processing" | "ready" | "partial" | "error">(
    "idle",
  );
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrMessage, setOcrMessage] = useState("");
  const [ocrExtraction, setOcrExtraction] = useState<IdentityDocumentExtraction | null>(null);
  const ocrRunRef = useRef(0);
  const createFormRef = useRef<HTMLFormElement>(null);
  const preparedUploadsRef = useRef(new Map<string, { original: File; prepared: File }>());
  const hasIdentityFrontPhoto = Boolean(selectedUploadNames.identityFront);

  async function prepareSelectedUpload(field: string, file: File) {
    const cached = preparedUploadsRef.current.get(field);
    if (cached?.original === file) return cached.prepared;
    const prepared = await prepareImageUpload(file);
    preparedUploadsRef.current.set(field, { original: file, prepared });
    return prepared;
  }

  async function assignCollector(event: FormEvent<HTMLFormElement>, borrower: Borrower) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await sensitiveFetch(
      `/api/v1/tenants/${tenantId}/borrowers/${borrower.id}/assignment`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ collectorId: String(form.get("collectorId") ?? "") || null }),
      },
    ).catch(() => null);
    if (!response?.ok) {
      setToastMessage("No fue posible asignar el cobrador.");
      return;
    }
    setToastMessage("Cobrador asignado.");
    router.refresh();
  }

  function closeCreateModal(force = false) {
    if (isSubmitting && !force) return;
    ocrRunRef.current += 1;
    setIsCreateOpen(false);
    setCreatedBorrowerId(null);
    setUploadedDocumentFields([]);
    setSelectedUploadNames({});
    preparedUploadsRef.current.clear();
    setOcrStatus("idle");
    setOcrProgress(0);
    setOcrMessage("");
    setOcrExtraction(null);
    setIncludeSecondContact(false);
    setHomeAddressConfirmed(false);
    setWorkAddressConfirmed(false);
    setIdentityConfirmed(false);
    setCreateStep(1);
  }

  function fieldValue(name: string) {
    const element = createFormRef.current?.elements.namedItem(name);
    return element instanceof HTMLInputElement ? element.value : "";
  }

  function selectUpload(event: ChangeEvent<HTMLInputElement>, field: string) {
    const file = event.currentTarget.files?.[0] ?? null;
    preparedUploadsRef.current.delete(field);
    setSelectedUploadNames((current) => ({
      ...current,
      [field]: file?.name ?? "",
    }));
    setMessage("");
    setIsError(false);
    if (file && (field === "identityFront" || field === "identityBack")) {
      setIdentityConfirmed(false);
      setOcrExtraction(null);
      const nameInput = createFormRef.current?.elements.namedItem("fullName");
      const numberInput = createFormRef.current?.elements.namedItem("documentNumber");
      if (nameInput instanceof HTMLInputElement) nameInput.value = "";
      if (numberInput instanceof HTMLInputElement) numberInput.value = "";
      const frontElement = createFormRef.current?.elements.namedItem("identityFront");
      const backElement = createFormRef.current?.elements.namedItem("identityBack");
      const front =
        field === "identityFront"
          ? file
          : frontElement instanceof HTMLInputElement
            ? frontElement.files?.[0]
            : null;
      const back =
        field === "identityBack"
          ? file
          : backElement instanceof HTMLInputElement
            ? backElement.files?.[0]
            : null;
      if (front) void scanIdentityDocuments(front, back ?? undefined);
    }
  }

  async function scanIdentityDocuments(front: File, back?: File) {
    const run = ++ocrRunRef.current;
    setOcrStatus("processing");
    setOcrProgress(0);
    setOcrMessage(
      back ? "Leyendo frente y reverso de la cédula…" : "Leyendo el frente de la cédula…",
    );
    try {
      const formData = new FormData();
      const preparedFront = await prepareSelectedUpload("identityFront", front);
      formData.append("front", preparedFront);
      setOcrProgress(30);
      if (back) formData.append("back", await prepareSelectedUpload("identityBack", back));
      if (run !== ocrRunRef.current) return;
      setOcrProgress(55);
      const response = await sensitiveFetch(
        `/api/v1/tenants/${tenantId}/borrowers/identity-extract`,
        { method: "POST", body: formData },
      );
      if (!response) throw new Error("No fue posible iniciar la lectura.");
      const body = (await response.json().catch(() => ({}))) as {
        extraction?: IdentityDocumentExtraction;
        error?: { message?: string };
      };
      if (!response.ok || !body.extraction) {
        throw new Error(formatApiError(body, "No fue posible leer la cédula."));
      }
      if (run !== ocrRunRef.current) return;
      const extraction = body.extraction;
      const fields = extraction.fields;
      const nameInput = createFormRef.current?.elements.namedItem("fullName");
      const numberInput = createFormRef.current?.elements.namedItem("documentNumber");
      const typeInput = createFormRef.current?.elements.namedItem("documentType");
      if (nameInput instanceof HTMLInputElement) nameInput.value = fields.fullName ?? "";
      if (numberInput instanceof HTMLInputElement) numberInput.value = fields.documentNumber ?? "";
      if (typeInput instanceof HTMLSelectElement && fields.documentType) {
        typeInput.value = fields.documentType;
      }
      setOcrExtraction(extraction);
      const foundCount = Number(Boolean(fields.fullName)) + Number(Boolean(fields.documentNumber));
      setOcrStatus(foundCount === 2 ? "ready" : foundCount === 1 ? "partial" : "error");
      setOcrMessage(
        foundCount === 2
          ? ""
          : foundCount === 1
            ? "Completa o corrige los datos faltantes."
            : "No se identificaron el nombre y el número. Toma fotos más nítidas o escríbelos manualmente.",
      );
      setOcrProgress(100);
    } catch (error) {
      if (run !== ocrRunRef.current) return;
      setOcrStatus("error");
      setOcrExtraction(null);
      setOcrMessage(
        error instanceof Error
          ? error.message
          : "No fue posible leer el documento. Escribe los datos manualmente.",
      );
    }
  }

  function validateCreateStep(step: number) {
    const errors: Record<number, string> = {
      1: "Adjunta el frente de la cédula y la selfie, revisa los datos detectados y confirma que coinciden.",
      2: "Completa el celular, WhatsApp, cada dirección y su barrio/municipio; luego confirma que fueron verificadas con el cliente.",
      3: "Registra al menos una referencia y el consentimiento del cliente.",
    };
    if (step === 1) {
      const files = ["identityFront", "profilePhoto"].map((name) =>
        createFormRef.current?.elements.namedItem(name),
      );
      const hasFiles = files.every(
        (element) => element instanceof HTMLInputElement && element.files?.[0],
      );
      if (
        !fieldValue("fullName") ||
        !fieldValue("documentNumber") ||
        !hasFiles ||
        !identityConfirmed
      ) {
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
    if (!identityConfirmed) {
      setCreateStep(1);
      setMessage("Vuelve a revisar y confirmar los datos detectados en el documento.");
      setIsError(true);
      setIsSubmitting(false);
      return;
    }
    const requiredFiles = ["identityFront", "profilePhoto"];
    if (
      requiredFiles.some((field) => {
        const file = form.get(field);
        return !(file instanceof File) || file.size === 0;
      })
    ) {
      setMessage("Adjunta el frente de la cédula y la selfie antes de guardar.");
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
      required: boolean;
    }> = [
      { field: "identityFront", category: "identity", side: "front", required: true },
      { field: "identityBack", category: "identity", side: "back", required: false },
      { field: "profilePhoto", category: "profile_photo", required: true },
    ];
    let uploadFailure = !borrowerId;
    const failedUploadLabels: string[] = [];
    const uploadedFields = new Set(uploadedDocumentFields);
    if (borrowerId) {
      for (const upload of uploads) {
        if (uploadedFields.has(upload.field)) continue;
        const file = form.get(upload.field);
        if (!(file instanceof File) || file.size === 0) {
          if (upload.required) uploadFailure = true;
          continue;
        }
        const body = new FormData();
        let preparedFile: File;
        try {
          preparedFile = await prepareSelectedUpload(upload.field, file);
        } catch {
          uploadFailure = true;
          failedUploadLabels.push(
            upload.field === "identityFront"
              ? "frente de la cédula"
              : upload.field === "identityBack"
                ? "reverso"
                : "selfie",
          );
          continue;
        }
        body.append("file", preparedFile);
        body.append("category", upload.category);
        if (upload.side) body.append("side", upload.side);
        const uploadResponse = await sensitiveFetch(
          `/api/v1/tenants/${tenantId}/borrowers/${borrowerId}/documents`,
          { method: "POST", body },
        ).catch(() => null);
        if (!uploadResponse?.ok) {
          uploadFailure = true;
          failedUploadLabels.push(
            upload.field === "identityFront"
              ? "frente de la cédula"
              : upload.field === "identityBack"
                ? "reverso"
                : "selfie",
          );
        } else {
          uploadedFields.add(upload.field);
        }
      }
    }
    setUploadedDocumentFields(Array.from(uploadedFields));
    if (uploadFailure) {
      setMessage(
        borrowerId
          ? `El cliente quedó creado, pero faltó guardar: ${failedUploadLabels.join(", ") || "una imagen obligatoria"}. Mantén esta ventana abierta y pulsa reintentar; no se volverá a crear el cliente.`
          : "No fue posible crear el cliente. Revisa la conexión e inténtalo de nuevo.",
      );
      setIsError(true);
      setIsSubmitting(false);
      router.refresh();
      return;
    }
    if (!borrowerId) return;
    const createdName = String(form.get("fullName") ?? "").trim();
    event.currentTarget.reset();
    setMessage(
      "Cliente creado. Las imágenes quedaron privadas y el OCR se procesará en segundo plano.",
    );
    setToastMessage(
      actorRole === "collector"
        ? `${createdName || "Cliente"} quedó pendiente de aprobación.`
        : `${createdName || "Cliente"} quedó aprobado y listo para crearle un crédito.`,
    );
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
                  ocrRunRef.current += 1;
                  setCreatedBorrowerId(null);
                  setUploadedDocumentFields([]);
                  setSelectedUploadNames({});
                  setOcrStatus("idle");
                  setOcrProgress(0);
                  setOcrMessage("");
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
            </div>
            <button aria-label="Cerrar aviso" onClick={() => setToastMessage("")} type="button">
              ×
            </button>
          </div>
        ) : null}
        <form
          className="tenant-directory-filters"
          action={borrowerDirectoryHref(tenantSlug)}
          method="get"
        >
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
            {search ? <a href={borrowerDirectoryHref(tenantSlug)}>Limpiar</a> : null}
          </div>
        </form>
        {directory.borrowers.length ? (
          <div className="collector-client-list borrower-profile-list">
            {directory.borrowers.map((borrower) => (
              <CollectorBorrowerCard
                assignmentTools={
                  canReview ? (
                    <form
                      className="borrower-assignment-form"
                      onSubmit={(event) => void assignCollector(event, borrower)}
                    >
                      <label htmlFor={`borrower-collector-${borrower.id}`}>Cobrador</label>
                      <select
                        defaultValue={borrower.assignedCollectorId ?? ""}
                        id={`borrower-collector-${borrower.id}`}
                        name="collectorId"
                      >
                        <option value="">Sin asignar</option>
                        {collectors.map((collector) => (
                          <option key={collector.userId} value={collector.userId}>
                            {collector.displayName}
                          </option>
                        ))}
                      </select>
                      <button type="submit">Guardar</button>
                    </form>
                  ) : borrower.assignedCollectorName ? (
                    <p>Cobrador: {borrower.assignedCollectorName}</p>
                  ) : undefined
                }
                borrower={borrower}
                creditHref={
                  borrower.identity.verificationState === "reviewed"
                    ? `/panel/empresa/${tenantSlug}/creditos?cliente=${encodeURIComponent(borrower.id)}&nuevo=1`
                    : null
                }
                documentTools={
                  <>
                    <BorrowerDocumentUpload borrowerId={borrower.id} tenantId={tenantId} />
                    <BorrowerOcrControl borrowerId={borrower.id} tenantId={tenantId} />
                  </>
                }
                homeWazeHref={wazeUrl(borrower.homeAddress, borrower.addressLocations.home)}
                onEditAddresses={() => openAddressEditor(borrower)}
                reviewTools={
                  canReview ? (
                    <BorrowerReviewControl
                      borrower={borrower}
                      canReview={canReview}
                      tenantId={tenantId}
                    />
                  ) : undefined
                }
                tenantId={tenantId}
                whatsappHref={whatsappUrl(borrower.whatsappPhone ?? borrower.phone)}
                workWazeHref={wazeUrl(borrower.workAddress, borrower.addressLocations.work)}
                key={borrower.id}
              />
            ))}
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
              <a href={borrowerDirectoryHref(tenantSlug, search, directory.pagination.page - 1)}>
                Anterior
              </a>
            ) : (
              <span aria-disabled="true">Anterior</span>
            )}
            <strong>
              Página {directory.pagination.page} de {directory.pagination.totalPages}
            </strong>
            {directory.pagination.page < directory.pagination.totalPages ? (
              <a href={borrowerDirectoryHref(tenantSlug, search, directory.pagination.page + 1)}>
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
                  <span className="borrower-section-kicker">Paso 1 · Documento</span>
                  <h3 id="borrower-step-document">Primero, toma las fotos</h3>
                </div>
                <span className="borrower-required-note">Frente + selfie obligatorios</span>
              </div>
              <p className="borrower-section-help">
                Captura primero el frente de la cédula para leer el nombre y el número. El reverso
                es opcional; la selfie actual del cliente sí es obligatoria.
              </p>
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
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    name="identityFront"
                    onChange={(event) => selectUpload(event, "identityFront")}
                    required
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
                    {selectedUploadNames.identityBack
                      ? "Reverso listo"
                      : "Reverso de la cédula · opcional"}
                  </strong>
                  <small>
                    {selectedUploadNames.identityBack ?? "Agrégalo solo si necesitas conservarlo"}
                  </small>
                  <input
                    accept="image/jpeg,image/png,image/webp"
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
                    {selectedUploadNames.profilePhoto ? "Selfie lista" : "Selfie del cliente"}
                  </strong>
                  <small>
                    {selectedUploadNames.profilePhoto ?? "Foto actual y clara del rostro"}
                  </small>
                  <input
                    accept="image/jpeg,image/png,image/webp"
                    capture="user"
                    name="profilePhoto"
                    onChange={(event) => selectUpload(event, "profilePhoto")}
                    required
                    type="file"
                  />
                  <span className="borrower-upload-cta">
                    {selectedUploadNames.profilePhoto ? "Cambiar archivo" : "Tomar o elegir foto"}
                  </span>
                </label>
              </div>
              {ocrStatus !== "idle" ? (
                <div className={`borrower-autofill-status is-${ocrStatus}`} role="status">
                  <span className="borrower-autofill-icon" aria-hidden="true">
                    {ocrStatus === "processing" ? "…" : ocrStatus === "ready" ? "✓" : "!"}
                  </span>
                  <div>
                    <strong>
                      {ocrStatus === "processing"
                        ? `Leyendo documento${ocrProgress ? ` · ${ocrProgress}%` : ""}`
                        : ocrStatus === "ready"
                          ? "Lectura automática completada"
                          : "Revisión necesaria"}
                    </strong>
                    {ocrMessage ? <small>{ocrMessage}</small> : null}
                  </div>
                </div>
              ) : null}
              {hasIdentityFrontPhoto ? (
                <div className="borrower-identity-review">
                  <div>
                    <span className="borrower-section-kicker">Datos detectados</span>
                    <h4>Verifica antes de continuar</h4>
                    <p>
                      Corrige cualquier error de lectura. Estos datos se usarán para identificar al
                      cliente.
                    </p>
                  </div>
                  <div className="borrower-form-grid borrower-form-grid-identity">
                    <label
                      className="borrower-field borrower-field-wide"
                      htmlFor="borrower-full-name"
                    >
                      Nombre completo
                      <input
                        disabled={ocrStatus === "processing"}
                        id="borrower-full-name"
                        maxLength={160}
                        name="fullName"
                        onChange={() => setIdentityConfirmed(false)}
                      />
                    </label>
                    <label className="borrower-field">
                      Tipo
                      <select
                        defaultValue="CC"
                        disabled={ocrStatus === "processing"}
                        name="documentType"
                        onChange={() => setIdentityConfirmed(false)}
                      >
                        <option value="CC">Cédula de ciudadanía</option>
                        <option value="CE">Cédula de extranjería</option>
                        <option value="PPT">Permiso por protección temporal</option>
                      </select>
                    </label>
                    <label className="borrower-field">
                      Número de documento
                      <input
                        disabled={ocrStatus === "processing"}
                        inputMode="numeric"
                        maxLength={32}
                        name="documentNumber"
                        onChange={() => setIdentityConfirmed(false)}
                      />
                    </label>
                  </div>
                  {ocrExtraction ? (
                    <div className="borrower-identity-all-data">
                      <div className="borrower-identity-all-data-heading">
                        <strong>Datos extraídos del documento</strong>
                        <small>
                          {ocrExtraction.sources.back ? "Frente y reverso" : "Solo frente"}
                        </small>
                      </div>
                      {identityDetailRows(ocrExtraction).length ? (
                        <dl>
                          {identityDetailRows(ocrExtraction).map(([label, value]) => (
                            <div key={label}>
                              <dt>{label}</dt>
                              <dd>{value}</dd>
                            </div>
                          ))}
                        </dl>
                      ) : (
                        <small>No se detectaron otros campos legibles.</small>
                      )}
                      {ocrExtraction.fields.mrzLines.length || ocrExtraction.fields.barcodeData ? (
                        <details>
                          <summary>Datos del reverso y lectura mecánica</summary>
                          {ocrExtraction.fields.mrzLines.length ? (
                            <pre>{ocrExtraction.fields.mrzLines.join("\n")}</pre>
                          ) : null}
                          {ocrExtraction.fields.barcodeData ? (
                            <p>{ocrExtraction.fields.barcodeData}</p>
                          ) : null}
                        </details>
                      ) : null}
                      {ocrExtraction.warnings.length ? (
                        <ul className="borrower-identity-warnings">
                          {ocrExtraction.warnings.map((warning) => (
                            <li key={warning}>{warning}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : null}
                  <label className="checkbox-row borrower-identity-confirmation">
                    <input
                      checked={identityConfirmed}
                      disabled={ocrStatus === "processing"}
                      onChange={(event) => setIdentityConfirmed(event.target.checked)}
                      type="checkbox"
                    />
                    <span>Confirmo que el nombre y el documento coinciden con las fotos.</span>
                  </label>
                </div>
              ) : (
                <div className="borrower-photo-gate" role="status">
                  Adjunta el frente para leer automáticamente los datos del cliente.
                </div>
              )}
              <div className="borrower-inline-tip">
                <span aria-hidden="true">i</span>
                <span>El reverso es opcional. La selfie del cliente sí es obligatoria.</span>
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
                Se guardarán los datos diligenciados, el frente del documento, la selfie, el reverso
                si lo adjuntaste y las referencias.
              </p>
              <ul className="borrower-confirmation-list">
                <li>Frente obligatorio y reverso opcional en almacenamiento privado.</li>
                <li>Selfie actual del cliente en almacenamiento privado.</li>
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
                <button
                  disabled={createStep === 1 && ocrStatus === "processing"}
                  onClick={nextCreateStep}
                  type="button"
                >
                  {createStep === 1 ? "Confirmar identidad y continuar" : "Continuar"}
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
