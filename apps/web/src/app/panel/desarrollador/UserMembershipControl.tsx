"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { type MembershipId, memberships } from "../../../data/memberships";
import { useSensitiveFetch } from "../ReauthenticationProvider";

export function UserMembershipControl({
  userId,
  membershipPlan,
  membershipActivatedAt,
  disabled,
}: {
  userId: string;
  membershipPlan: MembershipId | null;
  membershipActivatedAt: string | null;
  disabled?: boolean;
}) {
  const router = useRouter();
  const sensitiveFetch = useSensitiveFetch();
  const [selectedPlan, setSelectedPlan] = useState<MembershipId>(membershipPlan ?? "pro");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function activate() {
    setIsSubmitting(true);
    setMessage("");
    const response = await sensitiveFetch(`/api/v1/platform/users/${userId}/membership`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ membershipPlan: selectedPlan }),
    }).catch(() => null);
    if (!response?.ok) {
      const body = (await response?.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      setMessage(body.error?.message ?? "No fue posible activar la membresía.");
      setIsSubmitting(false);
      return;
    }
    setMessage("Membresía activa.");
    setIsSubmitting(false);
    router.refresh();
  }

  return (
    <div className="user-membership-control">
      <div className="membership-control-row">
        <select
          aria-label="Membresía del usuario"
          disabled={disabled || isSubmitting}
          onChange={(event) => setSelectedPlan(event.target.value as MembershipId)}
          value={selectedPlan}
        >
          {memberships.map((membership) => (
            <option key={membership.id} value={membership.id}>
              {membership.name}
            </option>
          ))}
        </select>
        <button disabled={disabled || isSubmitting} onClick={activate} type="button">
          {isSubmitting ? "Guardando…" : membershipPlan ? "Activar otra" : "Activar"}
        </button>
      </div>
      {membershipActivatedAt ? (
        <small>
          Activa desde{" "}
          {new Intl.DateTimeFormat("es-CO", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "America/Bogota",
          }).format(new Date(membershipActivatedAt))}
        </small>
      ) : null}
      {message ? <small role="status">{message}</small> : null}
    </div>
  );
}
