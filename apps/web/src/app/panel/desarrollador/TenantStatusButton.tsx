"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSensitiveFetch } from "../ReauthenticationProvider";

type TenantStatus = "draft" | "active" | "suspended" | "archived";

const actions: Partial<Record<TenantStatus, { label: string; target: TenantStatus }>> = {
  draft: { label: "Activar", target: "active" },
  active: { label: "Suspender", target: "suspended" },
  suspended: { label: "Reactivar", target: "active" },
};

export function TenantStatusButton({
  isReady,
  tenantId,
  status,
}: {
  isReady: boolean;
  tenantId: string;
  status: TenantStatus;
}) {
  const router = useRouter();
  const sensitiveFetch = useSensitiveFetch();
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const action = actions[status];
  const activationBlocked = action?.target === "active" && !isReady;

  if (!action) return <span className="table-muted">Sin acciones</span>;

  async function updateStatus() {
    if (!action) return;
    setMessage("");
    setIsSubmitting(true);
    const response = await sensitiveFetch(`/api/v1/platform/tenants/${tenantId}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: action.target }),
    }).catch(() => null);
    if (!response?.ok) {
      const body = (await response?.json().catch(() => ({}))) as
        | { error?: { message?: string } }
        | undefined;
      setMessage(body?.error?.message ?? "No fue posible cambiar el estado.");
      setIsSubmitting(false);
      return;
    }
    setMessage(action.target === "suspended" ? "Empresa suspendida." : "Empresa activada.");
    setIsSubmitting(false);
    router.refresh();
  }

  return (
    <div className="table-action">
      <button disabled={isSubmitting || activationBlocked} onClick={updateStatus} type="button">
        {isSubmitting ? "Procesando…" : activationBlocked ? "Preparación pendiente" : action.label}
      </button>
      {activationBlocked ? (
        <small className="table-action-note">Completa todos los requisitos para activar.</small>
      ) : null}
      {message ? <small role="status">{message}</small> : null}
    </div>
  );
}
