"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { memberships } from "../../../data/memberships";
import { useSensitiveFetch } from "../ReauthenticationProvider";

type Owner = { id: string; displayName: string; email: string };

export function IssueCompanyCodeForm({ owners }: { owners: Owner[] }) {
  const router = useRouter();
  const sensitiveFetch = useSensitiveFetch();
  const [message, setMessage] = useState("");
  const [issued, setIssued] = useState<{ code: string; expiresAt: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIssued(null);
    setIsSubmitting(true);
    const form = new FormData(event.currentTarget);
    const response = await sensitiveFetch("/api/v1/platform/company-codes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        membershipPlan: form.get("membershipPlan"),
        ownerUserId: form.get("ownerUserId"),
      }),
    }).catch(() => null);
    if (!response?.ok) {
      const body = (await response?.json().catch(() => ({}))) as
        | { error?: { message?: string } }
        | undefined;
      setMessage(body?.error?.message ?? "No fue posible emitir el código.");
      setIsSubmitting(false);
      return;
    }
    const body = (await response.json()) as { code: { code: string; expiresAt: string } };
    setIssued(body.code);
    setMessage("Código emitido una sola vez. Entrégalo al propietario por un canal seguro.");
    setIsSubmitting(false);
    router.refresh();
  }

  return (
    <form className="tenant-form" onSubmit={submit}>
      <label htmlFor="company-code-owner">Propietario</label>
      <select defaultValue="" id="company-code-owner" name="ownerUserId" required>
        <option value="">Selecciona un propietario</option>
        {owners.map((owner) => (
          <option key={owner.id} value={owner.id}>
            {owner.displayName} · {owner.email}
          </option>
        ))}
      </select>
      <label htmlFor="company-code-plan">Plan pagado</label>
      <select defaultValue="pro" id="company-code-plan" name="membershipPlan" required>
        {memberships.map((membership) => (
          <option key={membership.id} value={membership.id}>
            {membership.name}
          </option>
        ))}
      </select>
      {message ? (
        <p className="tenant-form-message" role="status">
          {message}
        </p>
      ) : null}
      {issued ? (
        <div className="creation-code-result" role="status">
          <strong>{issued.code}</strong>
          <span>Válido hasta {new Date(issued.expiresAt).toLocaleDateString("es-CO")}</span>
          <small>
            Este código solo puede activar una empresa para el propietario seleccionado.
          </small>
        </div>
      ) : null}
      <button disabled={isSubmitting || owners.length === 0} type="submit">
        {isSubmitting ? "Emitiendo…" : "Emitir código"}
      </button>
    </form>
  );
}
