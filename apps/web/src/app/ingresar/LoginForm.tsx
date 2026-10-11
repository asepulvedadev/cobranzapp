"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

type LoginResponse = { error?: { message?: string } };

export function LoginForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          identifier: form.get("identifier"),
          password: form.get("password"),
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as LoginResponse;
        setMessage(body.error?.message ?? "No pudimos iniciar la sesión. Intenta nuevamente.");
        return;
      }
      router.push("/panel");
      router.refresh();
    } catch {
      setMessage("No hay conexión con la plataforma. Intenta nuevamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="login-form" onSubmit={submit}>
      <label htmlFor="identifier">Usuario o correo electrónico</label>
      <input
        autoComplete="username"
        id="identifier"
        name="identifier"
        placeholder="usuario@empresa.com"
        required
        type="text"
      />
      <label htmlFor="password">Contraseña</label>
      <input
        autoComplete="current-password"
        id="password"
        minLength={12}
        name="password"
        required
        type="password"
      />
      {message ? (
        <p className="form-message form-message-error" role="alert">
          {message}
        </p>
      ) : null}
      <button className="login-submit" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Verificando…" : "Ingresar"}
      </button>
    </form>
  );
}
