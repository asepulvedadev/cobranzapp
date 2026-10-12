"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

type LoginResponse = {
  mfaRequired?: boolean;
  error?: { message?: string };
};

type LoginStep = "credentials" | "mfa";

export function LoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<LoginStep>("credentials");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function enterPanel() {
    const nextPath = new URLSearchParams(window.location.search).get("siguiente");
    const safeNextPath =
      nextPath?.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/panel";
    router.push(safeNextPath);
    router.refresh();
  }

  async function submitCredentials(event: FormEvent<HTMLFormElement>) {
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
      const body = (await response.json()) as LoginResponse;
      if (response.status === 202 && body.mfaRequired) {
        setStep("mfa");
        return;
      }
      enterPanel();
    } catch {
      setMessage("No hay conexión con la plataforma. Intenta nuevamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/v1/auth/mfa/verify-login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: form.get("code") }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as LoginResponse;
        setMessage(body.error?.message ?? "No pudimos verificar el código. Intenta nuevamente.");
        return;
      }
      enterPanel();
    } catch {
      setMessage("No hay conexión con la plataforma. Intenta nuevamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (step === "mfa") {
    return (
      <form className="login-form login-mfa-form" onSubmit={submitMfa}>
        <div className="login-mfa-intro">
          <strong>Confirma que eres tú</strong>
          <p>
            Escribe el código de tu aplicación autenticadora o uno de tus códigos de recuperación.
          </p>
        </div>
        <label htmlFor="code">Código de seguridad</label>
        <input
          autoCapitalize="characters"
          autoComplete="one-time-code"
          autoCorrect="off"
          id="code"
          maxLength={32}
          minLength={6}
          name="code"
          placeholder="000000"
          required
          spellCheck={false}
          type="text"
        />
        {message ? (
          <p className="form-message form-message-error" role="alert">
            {message}
          </p>
        ) : null}
        <button className="login-submit" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Verificando…" : "Verificar e ingresar"}
        </button>
        <button
          className="login-secondary"
          disabled={isSubmitting}
          onClick={() => {
            setStep("credentials");
            setMessage("");
          }}
          type="button"
        >
          Usar otra cuenta
        </button>
      </form>
    );
  }

  return (
    <form className="login-form" onSubmit={submitCredentials}>
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
