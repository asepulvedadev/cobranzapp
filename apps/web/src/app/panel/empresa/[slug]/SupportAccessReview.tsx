"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SupportAccessRecord } from "../../../../lib/platform";
import { useSensitiveFetch } from "../../ReauthenticationProvider";

const statusLabels = {
  pending: "Pendiente",
  active: "Autorizado",
  denied: "Rechazado",
  revoked: "Revocado",
  expired: "Vencido",
};

export function SupportAccessReview({
  access,
  tenantId,
}: {
  access: SupportAccessRecord[];
  tenantId: string;
}) {
  const router = useRouter();
  const sensitiveFetch = useSensitiveFetch();
  const [processingId, setProcessingId] = useState("");
  const [message, setMessage] = useState("");

  async function review(accessId: string, action: "approve" | "deny" | "revoke") {
    setProcessingId(accessId);
    setMessage("");
    const response = await sensitiveFetch(
      `/api/v1/tenants/${tenantId}/support-access/${accessId}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      },
    ).catch(() => null);
    if (!response?.ok) {
      const body = (await response?.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      setMessage(body.error?.message ?? "No fue posible actualizar el acceso.");
      setProcessingId("");
      return;
    }
    setMessage(
      action === "approve"
        ? "Acceso autorizado temporalmente."
        : action === "deny"
          ? "Solicitud rechazada."
          : "Acceso revocado.",
    );
    setProcessingId("");
    router.refresh();
  }

  if (!access.length) {
    return (
      <div className="support-access-empty">
        <strong>Sin solicitudes de soporte</strong>
        <p>Nadie de la plataforma puede consultar este espacio sin tu autorización.</p>
      </div>
    );
  }

  return (
    <div className="support-access-review">
      <ul>
        {access.map((item) => (
          <li key={item.id}>
            <header>
              <div>
                <strong>{item.requestedByDisplayName}</strong>
                <small>
                  {new Intl.DateTimeFormat("es-CO", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "America/Bogota",
                  }).format(new Date(item.requestedAt))}
                </small>
              </div>
              <span className={`support-status support-status-${item.status}`}>
                {statusLabels[item.status]}
              </span>
            </header>
            <p>{item.purpose}</p>
            <dl>
              <div>
                <dt>Duración solicitada</dt>
                <dd>{item.requestedDurationMinutes} minutos</dd>
              </div>
              {item.expiresAt ? (
                <div>
                  <dt>Vence</dt>
                  <dd>
                    {new Intl.DateTimeFormat("es-CO", {
                      dateStyle: "short",
                      timeStyle: "short",
                      timeZone: "America/Bogota",
                    }).format(new Date(item.expiresAt))}
                  </dd>
                </div>
              ) : null}
            </dl>
            {item.status === "pending" ? (
              <div className="support-review-actions">
                <button
                  disabled={processingId === item.id}
                  onClick={() => review(item.id, "approve")}
                  type="button"
                >
                  Autorizar
                </button>
                <button
                  className="secondary-action"
                  disabled={processingId === item.id}
                  onClick={() => review(item.id, "deny")}
                  type="button"
                >
                  Rechazar
                </button>
              </div>
            ) : null}
            {item.status === "active" ? (
              <button
                className="support-revoke-action"
                disabled={processingId === item.id}
                onClick={() => review(item.id, "revoke")}
                type="button"
              >
                Revocar ahora
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {message ? <p role="status">{message}</p> : null}
    </div>
  );
}
