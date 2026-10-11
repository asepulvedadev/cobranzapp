"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { TenantOverview } from "../../../../lib/platform";
import { useSensitiveFetch } from "../../ReauthenticationProvider";

const roleLabels = {
  owner: "Propietario",
  supervisor: "Supervisor",
  collector: "Cobrador",
  customer: "Cliente",
};

export function PendingInvitationList({
  invitations: initialInvitations,
  tenantId,
}: {
  invitations: TenantOverview["pendingInvitations"];
  tenantId: string;
}) {
  const router = useRouter();
  const sensitiveFetch = useSensitiveFetch();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function revoke(invitationId: string) {
    setPendingId(invitationId);
    setMessage("");
    const response = await sensitiveFetch(
      `/api/v1/tenants/${tenantId}/invitations/${invitationId}`,
      { method: "DELETE" },
    ).catch(() => null);
    if (!response?.ok) {
      const body = (await response?.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      setMessage(body.error?.message ?? "No fue posible revocar la invitación.");
      setPendingId(null);
      return;
    }
    setMessage("Invitación revocada.");
    setPendingId(null);
    router.refresh();
  }

  return (
    <section className="pending-invitations" aria-labelledby="pending-invitations-title">
      <div>
        <h3 id="pending-invitations-title">Invitaciones pendientes</h3>
        <span>{initialInvitations.length}</span>
      </div>
      {initialInvitations.length ? (
        <ul>
          {initialInvitations.map((invitation) => (
            <li key={invitation.id}>
              <span>
                <strong>{invitation.email}</strong>
                <small>
                  {roleLabels[invitation.role]} · vence el{" "}
                  {new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(
                    new Date(invitation.expiresAt),
                  )}
                  {invitation.role === "owner" ? " · gestión de plataforma" : ""}
                </small>
              </span>
              <button
                disabled={pendingId !== null || invitation.role === "owner"}
                onClick={() => revoke(invitation.id)}
                type="button"
              >
                {pendingId === invitation.id ? "Revocando…" : "Revocar"}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p>No hay invitaciones por aceptar.</p>
      )}
      {message ? <p role="status">{message}</p> : null}
    </section>
  );
}
