"use client";

import type { ApiError } from "@cobranzapp/contracts";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

export function CreateCompanyOnboarding() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/v1/account/tenants", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        displayName: String(form.get("displayName") ?? "").trim(),
        password: String(form.get("password") ?? ""),
      }),
    }).catch(() => null);
    if (!response?.ok) {
      const body = (await response?.json().catch(() => ({}))) as ApiError | undefined;
      setMessage(body?.error?.message ?? "No fue posible crear la empresa.");
      setBusy(false);
      return;
    }
    const body = (await response.json()) as { tenant: { tenantSlug: string } };
    router.push(`/panel/empresa/${body.tenant.tenantSlug}/configuracion?onboarding=1`);
    router.refresh();
  }

  return (
    <form className="tenant-form onboarding-company-form" onSubmit={submit}>
      <p className="onboarding-subscription-note">
        Tu suscripción ya está asociada a tu cuenta. Cada suscripción disponible permite crear una
        empresa adicional.
      </p>
      <label htmlFor="company-display-name">Nombre de la empresa</label>
      <input
        autoComplete="organization"
        id="company-display-name"
        maxLength={120}
        name="displayName"
        placeholder="Cobranzas del Norte"
        required
      />
      <small>Usaremos este nombre para crear el espacio de trabajo de tu empresa.</small>
      <label htmlFor="company-password">Confirma tu contraseña</label>
      <input
        autoComplete="current-password"
        id="company-password"
        minLength={12}
        name="password"
        required
        type="password"
      />
      <small>La usamos solo para confirmar que eres el dueño de la cuenta.</small>
      {message ? (
        <p className="tenant-form-message form-message-error" role="alert">
          {message}
        </p>
      ) : null}
      <button disabled={busy} type="submit">
        {busy ? "Creando empresa…" : "Crear empresa"}
      </button>
    </form>
  );
}
