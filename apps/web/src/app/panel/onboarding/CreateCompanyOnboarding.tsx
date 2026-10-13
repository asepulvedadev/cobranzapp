"use client";

import type { ApiError } from "@cobranzapp/contracts";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { fetchWithTimeout } from "../../../lib/fetch-with-timeout";
import type { OwnerSubscriptionSummary } from "../../../lib/platform";
import { formatApiError } from "../api-error";

export function CreateCompanyOnboarding({
  availableSubscriptions,
}: {
  availableSubscriptions: OwnerSubscriptionSummary | null;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const hasAvailableSubscription =
    availableSubscriptions === null || availableSubscriptions.availableCount > 0;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetchWithTimeout("/api/v1/account/tenants", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        displayName: String(form.get("displayName") ?? "").trim(),
        password: String(form.get("password") ?? ""),
      }),
    });
    if (!response?.ok) {
      const body = (await response?.json().catch(() => ({}))) as ApiError | undefined;
      setMessage(formatApiError(body, "No fue posible crear la empresa."));
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
        {availableSubscriptions === null
          ? "Consulta tus suscripciones disponibles para crear una empresa adicional."
          : availableSubscriptions.availableCount > 0
            ? `Tienes ${availableSubscriptions.availableCount} suscripción(es) disponible(s) para crear empresa(s).`
            : "No tienes suscripciones disponibles. Solicita al desarrollador que active una antes de crear otra empresa."}
      </p>
      {availableSubscriptions?.availableSubscriptions.length ? (
        <small>
          Planes disponibles:{" "}
          {availableSubscriptions.availableSubscriptions
            .map((item) => (item.membershipPlan === "pro" ? "Pro" : "Ultra"))
            .join(", ")}
          .
        </small>
      ) : null}
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
      <button disabled={busy || !hasAvailableSubscription} type="submit">
        {busy ? "Creando empresa…" : hasAvailableSubscription ? "Crear empresa" : "Sin suscripción"}
      </button>
    </form>
  );
}
