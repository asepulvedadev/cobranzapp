"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import type { TenantOverview } from "../../../../lib/platform";
import { useSensitiveFetch } from "../../ReauthenticationProvider";

function useMutationFeedback() {
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  return { message, setMessage, isError, setIsError, isSubmitting, setIsSubmitting };
}

async function errorMessage(response: Response | null, fallback: string) {
  const body = (await response?.json().catch(() => ({}))) as
    | { error?: { message?: string } }
    | undefined;
  return body?.error?.message ?? fallback;
}

export function WorkspaceSettingsForm({
  settings,
  tenantId,
}: {
  settings: TenantOverview["settings"];
  tenantId: string;
}) {
  const router = useRouter();
  const feedback = useMutationFeedback();
  const sensitiveFetch = useSensitiveFetch();
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    feedback.setMessage("");
    feedback.setIsError(false);
    feedback.setIsSubmitting(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/v1/tenants/${tenantId}/settings`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        primaryColor: form.get("primaryColor"),
        accentColor: form.get("accentColor"),
        contactEmail: form.get("contactEmail"),
        contactPhone: form.get("contactPhone"),
        address: form.get("address"),
        version: settings.version,
      }),
    }).catch(() => null);
    if (!response?.ok) {
      feedback.setMessage(await errorMessage(response, "No fue posible guardar la configuración."));
      feedback.setIsError(true);
      feedback.setIsSubmitting(false);
      return;
    }
    feedback.setMessage("Configuración guardada.");
    feedback.setIsSubmitting(false);
    router.refresh();
  }

  async function uploadLogo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("logo");
    if (!(file instanceof File) || file.size === 0) {
      feedback.setMessage("Selecciona una imagen para el logo.");
      feedback.setIsError(true);
      return;
    }
    setIsUploadingLogo(true);
    feedback.setMessage("");
    feedback.setIsError(false);
    const body = new FormData();
    body.append("file", file);
    const response = await sensitiveFetch(`/api/v1/tenants/${tenantId}/brand-logo`, {
      method: "POST",
      body,
    }).catch(() => null);
    if (!response?.ok) {
      feedback.setMessage(await errorMessage(response, "No fue posible guardar el logo."));
      feedback.setIsError(true);
      setIsUploadingLogo(false);
      return;
    }
    feedback.setMessage("Logo guardado en almacenamiento privado.");
    setIsUploadingLogo(false);
    event.currentTarget.reset();
    router.refresh();
  }

  return (
    <div className="tenant-form settings-form">
      <form onSubmit={uploadLogo}>
        <label htmlFor="tenant-logo">Logo de la empresa</label>
        <input
          accept="image/jpeg,image/png,image/webp"
          id="tenant-logo"
          name="logo"
          required
          type="file"
        />
        <small>JPG, PNG o WebP. Máximo 10 MB.</small>
        <button disabled={isUploadingLogo} type="submit">
          {isUploadingLogo ? "Cargando…" : "Guardar logo"}
        </button>
      </form>
      <form onSubmit={submit}>
        <label htmlFor="contactEmail">Correo operativo</label>
        <input
          defaultValue={settings.contactEmail ?? ""}
          id="contactEmail"
          name="contactEmail"
          placeholder="operaciones@empresa.com"
          type="email"
        />
        <label htmlFor="contactPhone">Teléfono de contacto</label>
        <input
          defaultValue={settings.contactPhone ?? ""}
          id="contactPhone"
          maxLength={30}
          name="contactPhone"
          placeholder="+57 300 000 0000"
          type="tel"
        />
        <label htmlFor="address">Dirección principal</label>
        <input
          defaultValue={settings.address ?? ""}
          id="address"
          maxLength={240}
          name="address"
          placeholder="Dirección, ciudad"
        />
        <div className="color-fields">
          <label>
            Color principal
            <input defaultValue={settings.primaryColor} name="primaryColor" type="color" />
          </label>
          <label>
            Color de acento
            <input defaultValue={settings.accentColor} name="accentColor" type="color" />
          </label>
        </div>
        {feedback.message ? (
          <p
            className={`tenant-form-message${feedback.isError ? " form-message-error" : ""}`}
            role="status"
          >
            {feedback.message}
          </p>
        ) : null}
        <button disabled={feedback.isSubmitting} type="submit">
          {feedback.isSubmitting ? "Guardando…" : "Guardar configuración"}
        </button>
      </form>
    </div>
  );
}

export function CreateBranchForm({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const feedback = useMutationFeedback();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    feedback.setMessage("");
    feedback.setIsError(false);
    feedback.setIsSubmitting(true);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const response = await fetch(`/api/v1/tenants/${tenantId}/branches`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: form.get("code"), displayName: form.get("displayName") }),
    }).catch(() => null);
    if (!response?.ok) {
      feedback.setMessage(await errorMessage(response, "No fue posible crear la sede."));
      feedback.setIsError(true);
      feedback.setIsSubmitting(false);
      return;
    }
    formElement.reset();
    feedback.setMessage("Sede creada.");
    feedback.setIsSubmitting(false);
    router.refresh();
  }

  return (
    <form className="tenant-form compact-form" onSubmit={submit}>
      <label htmlFor="branchName">Nombre de la sede</label>
      <input id="branchName" name="displayName" placeholder="Sede Centro" required />
      <label htmlFor="branchCode">Código</label>
      <input
        id="branchCode"
        maxLength={40}
        name="code"
        pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
        placeholder="centro"
        required
      />
      {feedback.message ? (
        <p
          className={`tenant-form-message${feedback.isError ? " form-message-error" : ""}`}
          role="status"
        >
          {feedback.message}
        </p>
      ) : null}
      <button disabled={feedback.isSubmitting} type="submit">
        {feedback.isSubmitting ? "Creando…" : "Crear sede"}
      </button>
    </form>
  );
}

export function CreateTeamForm({
  branches,
  tenantId,
}: {
  branches: TenantOverview["branches"];
  tenantId: string;
}) {
  const router = useRouter();
  const feedback = useMutationFeedback();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    feedback.setMessage("");
    feedback.setIsError(false);
    feedback.setIsSubmitting(true);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const branchId = String(form.get("branchId") ?? "");
    const response = await fetch(`/api/v1/tenants/${tenantId}/teams`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        branchId: branchId || null,
        displayName: form.get("displayName"),
      }),
    }).catch(() => null);
    if (!response?.ok) {
      feedback.setMessage(await errorMessage(response, "No fue posible crear el equipo."));
      feedback.setIsError(true);
      feedback.setIsSubmitting(false);
      return;
    }
    formElement.reset();
    feedback.setMessage("Equipo creado.");
    feedback.setIsSubmitting(false);
    router.refresh();
  }

  return (
    <form className="tenant-form compact-form" onSubmit={submit}>
      <label htmlFor="teamName">Nombre del equipo</label>
      <input id="teamName" name="displayName" placeholder="Ruta Centro" required />
      <label htmlFor="teamBranch">Sede</label>
      <select defaultValue="" id="teamBranch" name="branchId">
        <option value="">Sin sede asignada</option>
        {branches
          .filter((branch) => branch.status === "active")
          .map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.displayName}
            </option>
          ))}
      </select>
      {feedback.message ? (
        <p
          className={`tenant-form-message${feedback.isError ? " form-message-error" : ""}`}
          role="status"
        >
          {feedback.message}
        </p>
      ) : null}
      <button disabled={feedback.isSubmitting} type="submit">
        {feedback.isSubmitting ? "Creando…" : "Crear equipo"}
      </button>
    </form>
  );
}
