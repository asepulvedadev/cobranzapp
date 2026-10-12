"use client";

import Image from "next/image";
import { type FormEvent, useState } from "react";
import type { MfaStatus } from "../../../lib/platform";
import { useSensitiveFetch } from "../ReauthenticationProvider";

type Enrollment = {
  secret: string;
  qrDataUrl: string;
  expiresAt: string;
};

async function errorMessage(response: Response | null, fallback: string) {
  const body = (await response?.json().catch(() => ({}))) as
    | { error?: { message?: string } }
    | undefined;
  return body?.error?.message ?? fallback;
}

export function MfaSettings({ initialStatus }: { initialStatus: MfaStatus }) {
  const sensitiveFetch = useSensitiveFetch();
  const [enabled, setEnabled] = useState(initialStatus.enabled);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isPending, setIsPending] = useState(false);

  function showMessage(value: string, error = false) {
    setMessage(value);
    setIsError(error);
  }

  async function startEnrollment() {
    setIsPending(true);
    showMessage("");
    const response = await sensitiveFetch("/api/v1/auth/mfa/setup", { method: "POST" });
    if (!response?.ok) {
      showMessage(await errorMessage(response, "No fue posible iniciar la configuración."), true);
      setIsPending(false);
      return;
    }
    const body = (await response.json()) as { enrollment: Enrollment };
    setEnrollment(body.enrollment);
    setRecoveryCodes([]);
    setIsPending(false);
  }

  async function confirmEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    showMessage("");
    const form = new FormData(event.currentTarget);
    const response = await sensitiveFetch("/api/v1/auth/mfa/enable", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: form.get("code") }),
    });
    if (!response?.ok) {
      showMessage(await errorMessage(response, "No fue posible activar la verificación."), true);
      setIsPending(false);
      return;
    }
    const body = (await response.json()) as { recoveryCodes: string[] };
    setEnabled(true);
    setEnrollment(null);
    setRecoveryCodes(body.recoveryCodes);
    showMessage("La verificación en dos pasos quedó activa.");
    setIsPending(false);
  }

  async function disable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!window.confirm("¿Desactivar la verificación en dos pasos para tu cuenta?")) return;
    setIsPending(true);
    showMessage("");
    const form = new FormData(event.currentTarget);
    const response = await sensitiveFetch("/api/v1/auth/mfa", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: form.get("disableCode") }),
    });
    if (!response?.ok) {
      showMessage(await errorMessage(response, "No fue posible desactivar la verificación."), true);
      setIsPending(false);
      return;
    }
    setEnabled(false);
    setEnrollment(null);
    setRecoveryCodes([]);
    showMessage("La verificación en dos pasos fue desactivada.");
    setIsPending(false);
  }

  function downloadRecoveryCodes() {
    const content = [
      "Códigos de recuperación de cobranzapp",
      "Cada código funciona una sola vez. Guárdalos en un lugar seguro.",
      "",
      ...recoveryCodes,
    ].join("\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "cobranzapp-codigos-recuperacion.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mfa-settings">
      <div className="mfa-summary">
        <div>
          <strong>{enabled ? "Protección activa" : "Protección disponible"}</strong>
          <p>
            {enabled
              ? "Al ingresar necesitarás tu contraseña y un código temporal."
              : "Añade un segundo paso para proteger tu cuenta aunque alguien conozca tu contraseña."}
          </p>
        </div>
        <span className={`status ${enabled ? "status-active" : "status-draft"}`}>
          {enabled ? "Activa" : "Inactiva"}
        </span>
      </div>

      {!enabled && !enrollment ? (
        <button
          className="mfa-primary-action"
          disabled={isPending}
          onClick={startEnrollment}
          type="button"
        >
          {isPending
            ? "Preparando…"
            : initialStatus.setupPending
              ? "Reiniciar configuración"
              : "Configurar aplicación"}
        </button>
      ) : null}

      {enrollment ? (
        <div className="mfa-enrollment">
          <div className="mfa-setup-step">
            <span>1</span>
            <div>
              <strong>Escanea el código QR</strong>
              <p>Usa una aplicación autenticadora compatible con códigos TOTP.</p>
            </div>
          </div>
          <Image
            alt="Código QR para configurar la aplicación autenticadora"
            height={240}
            src={enrollment.qrDataUrl}
            unoptimized
            width={240}
          />
          <div className="mfa-secret">
            <span>Clave manual</span>
            <code>{enrollment.secret}</code>
          </div>
          <form className="mfa-code-form" onSubmit={confirmEnrollment}>
            <label htmlFor="mfa-code">2. Confirma el código generado</label>
            <input
              autoComplete="one-time-code"
              id="mfa-code"
              inputMode="numeric"
              maxLength={6}
              minLength={6}
              name="code"
              pattern="[0-9]{6}"
              placeholder="000000"
              required
            />
            <button disabled={isPending} type="submit">
              {isPending ? "Activando…" : "Activar verificación"}
            </button>
          </form>
        </div>
      ) : null}

      {recoveryCodes.length ? (
        <div className="mfa-recovery" role="status">
          <strong>Guarda estos códigos ahora</strong>
          <p>
            No volverán a mostrarse. Cada uno permite un único ingreso si pierdes el autenticador.
          </p>
          <ul>
            {recoveryCodes.map((code) => (
              <li key={code}>{code}</li>
            ))}
          </ul>
          <button onClick={downloadRecoveryCodes} type="button">
            Descargar códigos
          </button>
        </div>
      ) : null}

      {enabled && !recoveryCodes.length ? (
        <form className="mfa-disable-form" onSubmit={disable}>
          <label htmlFor="mfa-disable-code">Código para desactivar</label>
          <input
            autoCapitalize="characters"
            autoComplete="one-time-code"
            id="mfa-disable-code"
            maxLength={32}
            minLength={6}
            name="disableCode"
            placeholder="Código temporal o de recuperación"
            required
          />
          <button disabled={isPending} type="submit">
            {isPending ? "Desactivando…" : "Desactivar verificación"}
          </button>
        </form>
      ) : null}

      {message ? (
        <p className={`mfa-message${isError ? " form-message-error" : ""}`} role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
