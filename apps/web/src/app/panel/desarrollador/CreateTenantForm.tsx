"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

export function CreateTenantForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const response = await fetch("/api/v1/platform/tenants", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ displayName: form.get("displayName"), slug: form.get("slug") }),
    }).catch(() => null);
    if (!response?.ok) {
      const body = (await response?.json().catch(() => ({}))) as
        | { error?: { message?: string } }
        | undefined;
      setMessage(body?.error?.message ?? "No fue posible crear la empresa.");
      setIsSubmitting(false);
      return;
    }
    formElement.reset();
    setMessage("Empresa creada como borrador.");
    setIsSubmitting(false);
    router.refresh();
  }

  return (
    <form className="tenant-form" onSubmit={submit}>
      <label htmlFor="displayName">Nombre visible</label>
      <input
        id="displayName"
        maxLength={120}
        name="displayName"
        placeholder="Ej. Cartera Norte"
        required
      />
      <label htmlFor="slug">Identificador</label>
      <input
        id="slug"
        maxLength={63}
        name="slug"
        pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
        placeholder="cartera-norte"
        required
      />
      <small>Solo minúsculas, números y guiones.</small>
      {message ? (
        <p className="tenant-form-message" role="status">
          {message}
        </p>
      ) : null}
      <button disabled={isSubmitting} type="submit">
        {isSubmitting ? "Creando…" : "Crear empresa"}
      </button>
    </form>
  );
}
