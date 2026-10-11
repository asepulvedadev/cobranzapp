"use client";

import { type FormEvent, useState } from "react";

export function PasswordForm() {
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("newPassword") ?? "");
    if (newPassword !== form.get("confirmation")) {
      setMessage("La confirmación no coincide con la nueva contraseña.");
      setIsSubmitting(false);
      return;
    }
    const response = await fetch("/api/v1/auth/change-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        currentPassword: form.get("currentPassword"),
        newPassword,
      }),
    }).catch(() => null);
    if (!response?.ok) {
      const body = (await response?.json().catch(() => ({}))) as
        | { error?: { message?: string } }
        | undefined;
      setMessage(body?.error?.message ?? "No fue posible cambiar la contraseña.");
      setIsSubmitting(false);
      return;
    }
    window.location.assign("/ingresar?contrasena=actualizada");
  }

  return (
    <form className="password-form" onSubmit={submit}>
      <label htmlFor="currentPassword">Contraseña actual</label>
      <input
        autoComplete="current-password"
        id="currentPassword"
        minLength={12}
        name="currentPassword"
        required
        type="password"
      />
      <label htmlFor="newPassword">Nueva contraseña</label>
      <input
        autoComplete="new-password"
        id="newPassword"
        minLength={12}
        name="newPassword"
        required
        type="password"
      />
      <small>Usa al menos 12 caracteres y evita reutilizar contraseñas.</small>
      <label htmlFor="confirmation">Confirma la nueva contraseña</label>
      <input
        autoComplete="new-password"
        id="confirmation"
        minLength={12}
        name="confirmation"
        required
        type="password"
      />
      {message ? (
        <p className="tenant-form-message form-message-error" role="alert">
          {message}
        </p>
      ) : null}
      <button disabled={isSubmitting} type="submit">
        {isSubmitting ? "Actualizando…" : "Actualizar contraseña"}
      </button>
    </form>
  );
}
