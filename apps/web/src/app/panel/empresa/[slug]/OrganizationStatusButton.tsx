"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSensitiveFetch } from "../../ReauthenticationProvider";

type OrganizationResource = "branch" | "team";

const resourceLabels = {
  branch: "sede",
  team: "equipo",
};

async function responseMessage(response: Response | null) {
  const body = (await response?.json().catch(() => ({}))) as
    | { error?: { message?: string } }
    | undefined;
  return body?.error?.message ?? "No fue posible cambiar el estado.";
}

export function OrganizationStatusButton({
  kind,
  name,
  resourceId,
  status,
  tenantId,
}: {
  kind: OrganizationResource;
  name: string;
  resourceId: string;
  status: "active" | "inactive";
  tenantId: string;
}) {
  const router = useRouter();
  const sensitiveFetch = useSensitiveFetch();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const nextStatus = status === "active" ? "inactive" : "active";
  const actionLabel = nextStatus === "active" ? "Activar" : "Desactivar";

  async function updateStatus() {
    if (
      nextStatus === "inactive" &&
      !window.confirm(`¿Desactivar ${resourceLabels[kind]} ${name}?`)
    ) {
      return;
    }
    setIsSubmitting(true);
    setMessage("");
    const response = await sensitiveFetch(
      `/api/v1/tenants/${tenantId}/${kind === "branch" ? "branches" : "teams"}/${resourceId}/status`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      },
    );
    if (!response?.ok) {
      setMessage(await responseMessage(response));
      setIsSubmitting(false);
      return;
    }
    setIsSubmitting(false);
    router.refresh();
  }

  return (
    <div className="organization-status-control">
      <button
        aria-label={`${actionLabel} ${resourceLabels[kind]} ${name}`}
        className={nextStatus === "inactive" ? "danger-action" : undefined}
        disabled={isSubmitting}
        onClick={updateStatus}
        type="button"
      >
        {isSubmitting ? "Actualizando…" : actionLabel}
      </button>
      {message ? <small role="status">{message}</small> : null}
    </div>
  );
}
