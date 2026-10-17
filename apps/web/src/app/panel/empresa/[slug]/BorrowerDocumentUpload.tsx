"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { useSensitiveFetch } from "../../ReauthenticationProvider";
import { prepareImageOrPdfUpload } from "./image-upload";

type DocumentCategory = "identity" | "profile_photo";
type DocumentSide = "front" | "back" | "";

async function responseMessage(response: Response | null, fallback: string) {
  const body = (await response?.json().catch(() => ({}))) as {
    error?: { message?: string };
  };
  return body.error?.message ?? fallback;
}

export function BorrowerDocumentUpload({
  tenantId,
  borrowerId,
}: {
  tenantId: string;
  borrowerId: string;
}) {
  const router = useRouter();
  const sensitiveFetch = useSensitiveFetch();
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [category, setCategory] = useState<DocumentCategory>("identity");
  const [side, setSide] = useState<DocumentSide>("front");

  function changeCategory(value: DocumentCategory) {
    setCategory(value);
    setSide(value === "identity" ? "front" : "");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = new FormData(event.currentTarget).get("file");
    if (!(file instanceof File) || file.size === 0) {
      setMessage("Selecciona una imagen o PDF.");
      setIsError(true);
      return;
    }
    setIsBusy(true);
    setMessage("");
    setIsError(false);
    let preparedFile: File;
    try {
      preparedFile = await prepareImageOrPdfUpload(file);
    } catch {
      setMessage("No pudimos abrir esa imagen. Elige otra foto de la galería o tómala nuevamente.");
      setIsError(true);
      setIsBusy(false);
      return;
    }
    const body = new FormData();
    body.append("file", preparedFile);
    body.append("category", category);
    if (side) body.append("side", side);
    const response = await sensitiveFetch(
      `/api/v1/tenants/${tenantId}/borrowers/${borrowerId}/documents`,
      {
        method: "POST",
        body,
      },
    ).catch(() => null);
    if (!response?.ok) {
      setMessage(await responseMessage(response, "No fue posible guardar el documento."));
      setIsError(true);
      setIsBusy(false);
      return;
    }
    event.currentTarget.reset();
    setMessage("Documento recibido en cuarentena privada; queda pendiente de revisión.");
    setIsBusy(false);
    router.refresh();
  }

  return (
    <details className="borrower-document-upload">
      <summary>Agregar documento</summary>
      <form onSubmit={submit}>
        <label>
          Tipo
          <select
            value={category}
            onChange={(event) => changeCategory(event.target.value as DocumentCategory)}
          >
            <option value="identity">Documento de identidad</option>
            <option value="profile_photo">Foto designada de perfil</option>
          </select>
        </label>
        {category === "identity" ? (
          <label>
            Cara
            <select value={side} onChange={(event) => setSide(event.target.value as DocumentSide)}>
              <option value="front">Frente</option>
              <option value="back">Reverso</option>
            </select>
          </label>
        ) : null}
        <label>
          Archivo
          <input accept="image/*,application/pdf" name="file" required type="file" />
        </label>
        <small>Máximo 10 MB. Se valida formato y contenido antes de dejarlo pendiente.</small>
        <button disabled={isBusy} type="submit">
          {isBusy ? "Cargando…" : "Enviar a cuarentena"}
        </button>
        {message ? (
          <p className={`tenant-form-message${isError ? " form-message-error" : ""}`} role="status">
            {message}
          </p>
        ) : null}
      </form>
    </details>
  );
}
