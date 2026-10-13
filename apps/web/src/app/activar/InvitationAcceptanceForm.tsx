"use client";

import { type FormEvent, useState } from "react";
import { fetchWithTimeout } from "../../lib/fetch-with-timeout";

export function InvitationAcceptanceForm({
  accountExists,
  email,
  tenantSlug,
  token,
}: {
  accountExists: boolean;
  email: string;
  tenantSlug: string;
  token: string;
}) {
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    if (!accountExists && form.get("password") !== form.get("confirmation")) {
      setMessage("La confirmación no coincide con la contraseña.");
      setIsSubmitting(false);
      return;
    }
    const response = await fetchWithTimeout(
      `/api/v1/invitations/${encodeURIComponent(token)}/accept`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: accountExists
          ? "{}"
          : JSON.stringify({
              username: form.get("username"),
              displayName: form.get("displayName"),
              password: form.get("password"),
            }),
      },
    );
    if (!response?.ok) {
      const body = (await response?.json().catch(() => ({}))) as
        | { error?: { message?: string } }
        | undefined;
      setMessage(body?.error?.message ?? "No fue posible aceptar la invitación.");
      setIsSubmitting(false);
      return;
    }
    window.location.assign(
      accountExists ? `/panel/empresa/${tenantSlug}` : "/ingresar?cuenta=activada",
    );
  }

  return (
    <form className="activation-form" onSubmit={submit}>
      <span className="activation-kicker">{accountExists ? "Confirmación" : "Crear cuenta"}</span>
      <h2>{accountExists ? "Acepta el acceso" : "Completa tus datos"}</h2>
      <p>
        {accountExists
          ? `Confirma la incorporación de ${email}.`
          : "Define tus credenciales para ingresar a la empresa."}
      </p>
      {!accountExists ? (
        <>
          <label htmlFor="displayName">Nombre completo</label>
          <input autoComplete="name" id="displayName" maxLength={100} name="displayName" required />
          <label htmlFor="username">Nombre de usuario</label>
          <input
            autoComplete="username"
            id="username"
            maxLength={40}
            name="username"
            pattern="[a-z0-9._-]{3,40}"
            required
          />
          <small>
            Usa entre 3 y 40 caracteres: minúsculas, números, punto, guion o guion bajo.
          </small>
          <label htmlFor="password">Contraseña</label>
          <input
            autoComplete="new-password"
            id="password"
            minLength={12}
            name="password"
            required
            type="password"
          />
          <label htmlFor="confirmation">Confirma la contraseña</label>
          <input
            autoComplete="new-password"
            id="confirmation"
            minLength={12}
            name="confirmation"
            required
            type="password"
          />
        </>
      ) : null}
      {message ? (
        <p className="activation-message" role="alert">
          {message}
        </p>
      ) : null}
      <button className="activation-primary" disabled={isSubmitting} type="submit">
        {isSubmitting
          ? "Procesando…"
          : accountExists
            ? "Aceptar invitación"
            : "Crear cuenta y aceptar"}
      </button>
    </form>
  );
}
