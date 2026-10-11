"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { TenantOverview } from "../../../../lib/platform";

type ManagedRole = "supervisor" | "collector" | "customer";
type ManagedStatus = "active" | "suspended" | "revoked";

async function responseError(response: Response | null) {
  const body = (await response?.json().catch(() => ({}))) as
    | { error?: { message?: string } }
    | undefined;
  return body?.error?.message ?? "No fue posible actualizar el acceso.";
}

export function MemberAccessControl({
  member,
  tenantId,
}: {
  member: TenantOverview["members"][number];
  tenantId: string;
}) {
  const router = useRouter();
  const [role, setRole] = useState(member.role as ManagedRole);
  const [status, setStatus] = useState(member.status as ManagedStatus);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (member.role === "owner") return <span className="table-muted">Acceso protegido</span>;
  if (member.status === "invited") return <span className="table-muted">Invitación pendiente</span>;
  if (status === "revoked") return <span className="table-muted">Acceso revocado</span>;

  async function update(nextStatus: ManagedStatus) {
    if (
      nextStatus === "revoked" &&
      !window.confirm("Este acceso no podrá reactivarse. ¿Deseas revocarlo?")
    ) {
      return;
    }
    setMessage("");
    setIsError(false);
    setIsSubmitting(true);
    const response = await fetch(`/api/v1/tenants/${tenantId}/members/${member.userId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role, status: nextStatus }),
    }).catch(() => null);
    if (!response?.ok) {
      setMessage(await responseError(response));
      setIsError(true);
      setIsSubmitting(false);
      return;
    }
    setStatus(nextStatus);
    setMessage(nextStatus === "revoked" ? "Acceso revocado." : "Acceso actualizado.");
    setIsSubmitting(false);
    router.refresh();
  }

  return (
    <div className="member-access-control">
      <label>
        <span>Rol asignado</span>
        <select
          aria-label={`Rol de ${member.displayName}`}
          disabled={isSubmitting}
          onChange={(event) => setRole(event.target.value as ManagedRole)}
          value={role}
        >
          <option value="supervisor">Supervisor</option>
          <option value="collector">Cobrador</option>
          <option value="customer">Cliente</option>
        </select>
      </label>
      <div>
        <button disabled={isSubmitting} onClick={() => update(status)} type="button">
          Guardar rol
        </button>
        <button
          className="secondary-action"
          disabled={isSubmitting}
          onClick={() => update(status === "active" ? "suspended" : "active")}
          type="button"
        >
          {status === "active" ? "Suspender" : "Reactivar"}
        </button>
        <button
          className="danger-action"
          disabled={isSubmitting}
          onClick={() => update("revoked")}
          type="button"
        >
          Revocar
        </button>
      </div>
      {message ? (
        <small className={isError ? "form-message-error" : ""} role="status">
          {message}
        </small>
      ) : null}
    </div>
  );
}
