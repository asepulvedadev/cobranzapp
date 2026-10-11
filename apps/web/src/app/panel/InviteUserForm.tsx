"use client";

import { type FormEvent, useState } from "react";
import { useSensitiveFetch } from "./ReauthenticationProvider";

type Role = "owner" | "supervisor" | "collector" | "customer";

const roleLabels: Record<Role, string> = {
  owner: "Propietario",
  supervisor: "Supervisor",
  collector: "Cobrador",
  customer: "Cliente",
};

export function InviteUserForm({
  allowedRoles,
  platform = false,
  tenantId,
  tenants = [],
}: {
  allowedRoles: Role[];
  platform?: boolean;
  tenantId?: string;
  tenants?: Array<{ id: string; displayName: string }>;
}) {
  const sensitiveFetch = useSensitiveFetch();
  const [message, setMessage] = useState("");
  const [acceptanceUrl, setAcceptanceUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setAcceptanceUrl("");
    setIsSubmitting(true);
    const form = new FormData(event.currentTarget);
    const selectedTenant = tenantId ?? String(form.get("tenantId") ?? "");
    const prefix = platform ? "/api/v1/platform/tenants" : "/api/v1/tenants";
    const response = await sensitiveFetch(`${prefix}/${selectedTenant}/invitations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: form.get("email"), role: form.get("role") }),
    }).catch(() => null);
    if (!response?.ok) {
      const body = (await response?.json().catch(() => ({}))) as
        | { error?: { message?: string } }
        | undefined;
      setMessage(body?.error?.message ?? "No fue posible crear la invitación.");
      setIsSubmitting(false);
      return;
    }
    const body = (await response.json()) as { invitation: { acceptanceUrl: string } };
    setAcceptanceUrl(body.invitation.acceptanceUrl);
    setMessage("Invitación creada. Comparte el enlace por un canal seguro.");
    setIsSubmitting(false);
  }

  return (
    <form className="tenant-form" onSubmit={submit}>
      {platform ? (
        <>
          <label htmlFor="invitationTenant">Empresa</label>
          <select id="invitationTenant" name="tenantId" required>
            <option value="">Selecciona una empresa</option>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.displayName}
              </option>
            ))}
          </select>
        </>
      ) : null}
      <label htmlFor={`invitationEmail-${tenantId ?? "platform"}`}>Correo electrónico</label>
      <input
        id={`invitationEmail-${tenantId ?? "platform"}`}
        name="email"
        placeholder="persona@empresa.com"
        required
        type="email"
      />
      <label htmlFor={`invitationRole-${tenantId ?? "platform"}`}>Rol</label>
      <select
        defaultValue={allowedRoles[0]}
        id={`invitationRole-${tenantId ?? "platform"}`}
        name="role"
        required
      >
        {allowedRoles.map((role) => (
          <option key={role} value={role}>
            {roleLabels[role]}
          </option>
        ))}
      </select>
      {message ? (
        <p className="tenant-form-message" role="status">
          {message}
        </p>
      ) : null}
      {acceptanceUrl ? (
        <label className="invitation-result">
          Enlace de activación
          <input aria-label="Enlace de activación" readOnly value={acceptanceUrl} />
        </label>
      ) : null}
      <button disabled={isSubmitting || (platform && tenants.length === 0)} type="submit">
        {isSubmitting ? "Creando…" : "Crear invitación"}
      </button>
    </form>
  );
}
