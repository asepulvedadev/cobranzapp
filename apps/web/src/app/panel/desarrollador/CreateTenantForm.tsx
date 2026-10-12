"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { memberships } from "../../../data/memberships";
import { useSensitiveFetch } from "../ReauthenticationProvider";

export function CreateTenantForm() {
  const router = useRouter();
  const sensitiveFetch = useSensitiveFetch();
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const response = await sensitiveFetch("/api/v1/platform/tenants", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        displayName: form.get("displayName"),
        slug: form.get("slug"),
        membershipPlan: form.get("membershipPlan"),
      }),
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
      <label htmlFor="membershipPlan">Plan comercial</label>
      <select defaultValue="pro" id="membershipPlan" name="membershipPlan" required>
        {memberships.map((membership) => (
          <option key={membership.id} value={membership.id}>
            {membership.name} · hasta {membership.clientLimit} clientes
          </option>
        ))}
      </select>
      <small>Define la capacidad comercial; no registra ni cobra una suscripción.</small>
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
