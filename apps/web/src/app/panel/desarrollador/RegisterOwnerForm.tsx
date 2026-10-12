"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { useSensitiveFetch } from "../ReauthenticationProvider";

export function RegisterOwnerForm() {
  const router = useRouter();
  const sensitiveFetch = useSensitiveFetch();
  const [message, setMessage] = useState("");
  const [credentials, setCredentials] = useState<{ username: string; password: string } | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setCredentials(null);
    setIsSubmitting(true);
    const form = new FormData(event.currentTarget);
    const response = await sensitiveFetch("/api/v1/platform/owners", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        displayName: form.get("displayName"),
        email: form.get("email"),
        temporaryPassword: form.get("temporaryPassword"),
        username: form.get("username"),
      }),
    }).catch(() => null);
    if (!response?.ok) {
      const body = (await response?.json().catch(() => ({}))) as
        | { error?: { message?: string } }
        | undefined;
      setMessage(body?.error?.message ?? "No fue posible registrar al propietario.");
      setIsSubmitting(false);
      return;
    }
    const body = (await response.json()) as {
      temporaryPassword: string;
      user: { username: string };
    };
    setCredentials({ username: body.user.username, password: body.temporaryPassword });
    setMessage("Propietario registrado. Comparte estas credenciales por un canal seguro.");
    setIsSubmitting(false);
    event.currentTarget.reset();
    router.refresh();
  }

  return (
    <form className="tenant-form" onSubmit={submit}>
      <label htmlFor="owner-display-name">Nombre completo</label>
      <input id="owner-display-name" maxLength={100} name="displayName" required />
      <label htmlFor="owner-email">Correo</label>
      <input id="owner-email" name="email" required type="email" />
      <label htmlFor="owner-username">Usuario</label>
      <input id="owner-username" name="username" pattern="[a-z0-9._-]{3,40}" required />
      <label htmlFor="owner-temporary-password">Contraseña temporal</label>
      <input
        id="owner-temporary-password"
        minLength={12}
        name="temporaryPassword"
        required
        type="text"
      />
      <small>El propietario deberá cambiarla en su primer ingreso.</small>
      {message ? (
        <p className="tenant-form-message" role="status">
          {message}
        </p>
      ) : null}
      {credentials ? (
        <div className="creation-code-result" role="status">
          <strong>Acceso inicial</strong>
          <span>Usuario: {credentials.username}</span>
          <span>Contraseña temporal: {credentials.password}</span>
        </div>
      ) : null}
      <button disabled={isSubmitting} type="submit">
        {isSubmitting ? "Registrando…" : "Registrar propietario"}
      </button>
    </form>
  );
}
