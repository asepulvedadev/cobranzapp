"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { type MembershipId, memberships } from "../../../data/memberships";
import { useSensitiveFetch } from "../ReauthenticationProvider";

export function TenantMembershipPlanControl({
  membershipPlan,
  tenantId,
}: {
  membershipPlan: MembershipId | null;
  tenantId: string;
}) {
  const router = useRouter();
  const sensitiveFetch = useSensitiveFetch();
  const [selectedPlan, setSelectedPlan] = useState<MembershipId>(membershipPlan ?? "pro");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function savePlan() {
    setIsSubmitting(true);
    setMessage("");
    const response = await sensitiveFetch(`/api/v1/platform/tenants/${tenantId}/membership-plan`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ membershipPlan: selectedPlan }),
    }).catch(() => null);
    if (!response?.ok) {
      const body = (await response?.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      setMessage(body.error?.message ?? "No fue posible actualizar el plan.");
      setIsSubmitting(false);
      return;
    }
    setMessage("Plan actualizado.");
    setIsSubmitting(false);
    router.refresh();
  }

  return (
    <div className="membership-plan-control">
      <select
        aria-label="Plan comercial"
        disabled={isSubmitting}
        onChange={(event) => setSelectedPlan(event.target.value as MembershipId)}
        value={selectedPlan}
      >
        {memberships.map((membership) => (
          <option key={membership.id} value={membership.id}>
            {membership.name}
          </option>
        ))}
      </select>
      <button
        disabled={isSubmitting || selectedPlan === membershipPlan}
        onClick={savePlan}
        type="button"
      >
        {isSubmitting ? "Guardando…" : membershipPlan ? "Cambiar" : "Asignar"}
      </button>
      {message ? <small role="status">{message}</small> : null}
    </div>
  );
}
