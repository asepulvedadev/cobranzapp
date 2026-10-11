"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import type { SupportAccessRecord } from "../../../lib/platform";
import { useSensitiveFetch } from "../ReauthenticationProvider";

const statusLabels = {
  pending: "Pendiente",
  active: "Autorizado",
  denied: "Rechazado",
  revoked: "Revocado",
  expired: "Vencido",
};

export function SupportAccessControl({
  access,
  tenantId,
}: {
  access: SupportAccessRecord | null;
  tenantId: string;
}) {
  const router = useRouter();
  const sensitiveFetch = useSensitiveFetch();
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isCurrent = access?.status === "pending" || access?.status === "active";

  async function requestAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await sensitiveFetch(`/api/v1/platform/tenants/${tenantId}/support-access`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        purpose: form.get("purpose"),
        durationMinutes: Number(form.get("durationMinutes")),
      }),
    }).catch(() => null);
    if (!response?.ok) {
      const body = (await response?.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      setMessage(body.error?.message ?? "No fue posible solicitar el acceso.");
      setIsSubmitting(false);
      return;
    }
    setMessage("Solicitud enviada al propietario.");
    setIsSubmitting(false);
    router.refresh();
  }

  async function cancelAccess() {
    if (!access) return;
    setIsSubmitting(true);
    setMessage("");
    const response = await sensitiveFetch(`/api/v1/platform/support-access/${access.id}`, {
      method: "DELETE",
    }).catch(() => null);
    if (!response?.ok) {
      const body = (await response?.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      setMessage(body.error?.message ?? "No fue posible cancelar el acceso.");
      setIsSubmitting(false);
      return;
    }
    setMessage("Acceso cancelado.");
    setIsSubmitting(false);
    router.refresh();
  }

  return (
    <div className="support-access-control">
      {access ? (
        <div className="support-access-state">
          <span className={`support-status support-status-${access.status}`}>
            {statusLabels[access.status]}
          </span>
          {access.status === "active" && access.expiresAt ? (
            <small>
              Hasta{" "}
              {new Intl.DateTimeFormat("es-CO", {
                dateStyle: "short",
                timeStyle: "short",
                timeZone: "America/Bogota",
              }).format(new Date(access.expiresAt))}
            </small>
          ) : null}
        </div>
      ) : null}
      {access?.status === "active" ? (
        <Link className="support-primary-action" href={`/panel/desarrollador/empresa/${tenantId}`}>
          Abrir soporte
        </Link>
      ) : null}
      {isCurrent ? (
        <button disabled={isSubmitting} onClick={cancelAccess} type="button">
          {isSubmitting ? "Procesando…" : "Cancelar acceso"}
        </button>
      ) : (
        <details className="support-request">
          <summary>Solicitar soporte</summary>
          <form onSubmit={requestAccess}>
            <label>
              Motivo
              <textarea
                maxLength={240}
                minLength={12}
                name="purpose"
                placeholder="Describe qué necesitas revisar"
                required
                rows={3}
              />
            </label>
            <label>
              Duración
              <select defaultValue="60" name="durationMinutes">
                <option value="30">30 minutos</option>
                <option value="60">1 hora</option>
                <option value="120">2 horas</option>
                <option value="240">4 horas</option>
                <option value="480">8 horas</option>
              </select>
            </label>
            <button disabled={isSubmitting} type="submit">
              {isSubmitting ? "Enviando…" : "Enviar solicitud"}
            </button>
          </form>
        </details>
      )}
      {message ? <small role="status">{message}</small> : null}
    </div>
  );
}
