"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { type MembershipId, memberships } from "../../../data/memberships";
import type { MembershipEntitlement } from "../../../lib/platform";
import { useSensitiveFetch } from "../ReauthenticationProvider";

export function TenantMembershipPlanControl({
  membershipPlan,
  membershipEntitlement,
  tenantId,
}: {
  membershipPlan: MembershipId | null;
  membershipEntitlement: MembershipEntitlement | null;
  tenantId: string;
}) {
  const router = useRouter();
  const sensitiveFetch = useSensitiveFetch();
  const [selectedPlan, setSelectedPlan] = useState<MembershipId>(membershipPlan ?? "pro");
  const [additionalEmployeeSeats, setAdditionalEmployeeSeats] = useState(
    membershipEntitlement?.additionalEmployeeSeats ?? 0,
  );
  const [message, setMessage] = useState("");
  const [submission, setSubmission] = useState<"plan" | "capacity" | null>(null);

  async function savePlan() {
    setSubmission("plan");
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
      setSubmission(null);
      return;
    }
    setMessage("Plan actualizado.");
    setSubmission(null);
    router.refresh();
  }

  async function saveCapacity() {
    setSubmission("capacity");
    setMessage("");
    const response = await sensitiveFetch(
      `/api/v1/platform/tenants/${tenantId}/membership-entitlement`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ additionalEmployeeSeats }),
      },
    ).catch(() => null);
    if (!response?.ok) {
      const body = (await response?.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      setMessage(body.error?.message ?? "No fue posible actualizar la capacidad.");
      setSubmission(null);
      return;
    }
    setMessage("Capacidad actualizada.");
    setSubmission(null);
    router.refresh();
  }

  const isSubmitting = submission !== null;
  const currentAdditionalSeats = membershipEntitlement?.additionalEmployeeSeats ?? 0;

  return (
    <div className="membership-plan-control">
      <div className="membership-control-row">
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
          {submission === "plan" ? "Guardando…" : membershipPlan ? "Cambiar" : "Asignar"}
        </button>
      </div>
      <div className="membership-control-row membership-capacity-row">
        <label>
          <span>Cupos adicionales</span>
          <input
            aria-label="Cupos adicionales de empleados"
            disabled={isSubmitting || membershipPlan === null}
            inputMode="numeric"
            max={1000}
            min={0}
            onChange={(event) => setAdditionalEmployeeSeats(event.target.valueAsNumber || 0)}
            type="number"
            value={additionalEmployeeSeats}
          />
        </label>
        <button
          disabled={
            isSubmitting ||
            membershipPlan === null ||
            additionalEmployeeSeats === currentAdditionalSeats
          }
          onClick={saveCapacity}
          type="button"
        >
          {submission === "capacity" ? "Guardando…" : "Guardar cupos"}
        </button>
      </div>
      {membershipEntitlement ? (
        <small>
          {membershipEntitlement.employeeSeatLimit} cupos totales · versión{" "}
          {membershipEntitlement.version}
        </small>
      ) : null}
      {message ? <small role="status">{message}</small> : null}
    </div>
  );
}
