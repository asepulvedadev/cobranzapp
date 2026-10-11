"use client";

import { useState } from "react";
import type { AccountSession } from "../../../lib/platform";

function sessionName(userAgent: string | null) {
  if (!userAgent) return "Navegador no identificado";
  const browser = userAgent.includes("Edg/")
    ? "Microsoft Edge"
    : userAgent.includes("Firefox/")
      ? "Firefox"
      : userAgent.includes("Chrome/")
        ? "Chrome"
        : userAgent.includes("Safari/")
          ? "Safari"
          : "Navegador";
  const device = /Android/i.test(userAgent)
    ? "Android"
    : /iPhone|iPad/i.test(userAgent)
      ? "iPhone o iPad"
      : /Windows/i.test(userAgent)
        ? "Windows"
        : /Mac OS/i.test(userAgent)
          ? "Mac"
          : /Linux/i.test(userAgent)
            ? "Linux"
            : "dispositivo desconocido";
  return `${browser} en ${device}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

async function errorMessage(response: Response | null) {
  const body = (await response?.json().catch(() => ({}))) as
    | { error?: { message?: string } }
    | undefined;
  return body?.error?.message ?? "No fue posible cerrar la sesión.";
}

export function SessionManager({ initialSessions }: { initialSessions: AccountSession[] }) {
  const [sessions, setSessions] = useState(initialSessions);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const otherSessions = sessions.filter((session) => !session.current);

  async function revoke(session: AccountSession) {
    if (!window.confirm(`¿Cerrar la sesión "${sessionName(session.userAgent)}"?`)) return;
    setPendingId(session.id);
    setMessage("");
    setIsError(false);
    const response = await fetch(`/api/v1/auth/sessions/${session.id}`, {
      method: "DELETE",
    }).catch(() => null);
    if (!response?.ok) {
      setMessage(await errorMessage(response));
      setIsError(true);
      setPendingId(null);
      return;
    }
    setSessions((current) => current.filter((item) => item.id !== session.id));
    setMessage("Sesión cerrada.");
    setPendingId(null);
  }

  async function revokeOthers() {
    if (!window.confirm("¿Cerrar todas las demás sesiones de tu cuenta?")) return;
    setPendingId("others");
    setMessage("");
    setIsError(false);
    const response = await fetch("/api/v1/auth/sessions/revoke-others", {
      method: "POST",
    }).catch(() => null);
    if (!response?.ok) {
      setMessage(await errorMessage(response));
      setIsError(true);
      setPendingId(null);
      return;
    }
    const body = (await response.json()) as { revoked: number };
    setSessions((current) => current.filter((session) => session.current));
    setMessage(
      body.revoked === 1
        ? "Se cerró una sesión adicional."
        : `Se cerraron ${body.revoked} sesiones.`,
    );
    setPendingId(null);
  }

  return (
    <div className="session-manager">
      <div className="session-list">
        {sessions.map((session) => (
          <article className="session-item" key={session.id}>
            <div>
              <strong>{sessionName(session.userAgent)}</strong>
              <span>Última actividad: {formatDate(session.lastSeenAt)}</span>
              <small>Expira: {formatDate(session.expiresAt)}</small>
            </div>
            {session.current ? (
              <span className="status status-active">Esta sesión</span>
            ) : (
              <button disabled={pendingId !== null} onClick={() => revoke(session)} type="button">
                {pendingId === session.id ? "Cerrando…" : "Cerrar sesión"}
              </button>
            )}
          </article>
        ))}
      </div>
      {message ? (
        <p className={`session-message${isError ? " form-message-error" : ""}`} role="status">
          {message}
        </p>
      ) : null}
      <button
        className="revoke-others"
        disabled={!otherSessions.length || pendingId !== null}
        onClick={revokeOthers}
        type="button"
      >
        {pendingId === "others" ? "Cerrando sesiones…" : "Cerrar todas las demás"}
      </button>
    </div>
  );
}
