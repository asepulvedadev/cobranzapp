"use client";

import { CalendarBlank, CheckCircle, CreditCard, PencilSimple } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { formatCop, type MembershipId, memberships } from "../../../data/memberships";
import type {
  PlatformSubscription,
  PlatformSubscriptionBillingCycle,
  PlatformSubscriptionDirectory,
  PlatformSubscriptionStatus,
} from "../../../lib/platform";
import { Modal } from "../Modal";
import { useSensitiveFetch } from "../ReauthenticationProvider";

type OwnerOption = { id: string; displayName: string; email: string };

const statusLabels: Record<PlatformSubscriptionStatus, string> = {
  active: "Activa",
  suspended: "Suspendida",
  expired: "Vencida",
  cancelled: "Cancelada",
};

function nextPeriodEnd(cycle: PlatformSubscriptionBillingCycle) {
  const date = new Date();
  if (cycle === "yearly") date.setFullYear(date.getFullYear() + 1);
  else date.setMonth(date.getMonth() + 1);
  return date.toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function planPrice(plan: MembershipId, cycle: PlatformSubscriptionBillingCycle) {
  const monthly = memberships.find((item) => item.id === plan)?.monthlyPriceCop ?? 0;
  return cycle === "yearly" ? monthly * 12 : monthly;
}

function periodLabel(start: string, end: string) {
  const formatter = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" });
  return `${formatter.format(new Date(`${start}T12:00:00`))} – ${formatter.format(
    new Date(`${end}T12:00:00`),
  )}`;
}

export function SubscriptionManager({
  directory,
  owners,
}: {
  directory: PlatformSubscriptionDirectory;
  owners: OwnerOption[];
}) {
  const router = useRouter();
  const sensitiveFetch = useSensitiveFetch();
  const [editing, setEditing] = useState<PlatformSubscription | "create" | null>(null);
  const [ownerId, setOwnerId] = useState(owners[0]?.id ?? "");
  const [plan, setPlan] = useState<MembershipId>("pro");
  const [billingCycle, setBillingCycle] = useState<PlatformSubscriptionBillingCycle>("monthly");
  const [amountCop, setAmountCop] = useState(150_000);
  const [periodStart, setPeriodStart] = useState(today());
  const [periodEnd, setPeriodEnd] = useState(nextPeriodEnd("monthly"));
  const [autoRenew, setAutoRenew] = useState(true);
  const [status, setStatus] = useState<PlatformSubscriptionStatus>("active");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const selectedPlan = useMemo(
    () => memberships.find((membership) => membership.id === plan),
    [plan],
  );

  function openCreate() {
    setOwnerId(owners[0]?.id ?? "");
    setPlan("pro");
    setBillingCycle("monthly");
    setAmountCop(planPrice("pro", "monthly"));
    setPeriodStart(today());
    setPeriodEnd(nextPeriodEnd("monthly"));
    setAutoRenew(true);
    setStatus("active");
    setNotes("");
    setMessage("");
    setEditing("create");
  }

  function openEdit(subscription: PlatformSubscription) {
    setOwnerId(subscription.userId);
    setPlan(subscription.membershipPlan);
    setBillingCycle(subscription.billingCycle);
    setAmountCop(subscription.amountCop);
    setPeriodStart(subscription.currentPeriodStart);
    setPeriodEnd(subscription.currentPeriodEnd);
    setAutoRenew(subscription.autoRenew);
    setStatus(subscription.status);
    setNotes(subscription.internalNotes ?? "");
    setMessage("");
    setEditing(subscription);
  }

  function changePlan(nextPlan: MembershipId) {
    setPlan(nextPlan);
    setAmountCop(planPrice(nextPlan, billingCycle));
  }

  function changeCycle(nextCycle: PlatformSubscriptionBillingCycle) {
    setBillingCycle(nextCycle);
    setAmountCop(planPrice(plan, nextCycle));
    if (editing === "create") setPeriodEnd(nextPeriodEnd(nextCycle));
  }

  async function save() {
    if (!editing || !ownerId || amountCop < 0 || !periodStart || !periodEnd) return;
    setSubmitting(true);
    setMessage("");
    const isCreate = editing === "create";
    const response = await sensitiveFetch(
      isCreate ? "/api/v1/platform/subscriptions" : `/api/v1/platform/subscriptions/${editing.id}`,
      {
        method: isCreate ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(isCreate ? { userId: ownerId } : { status }),
          membershipPlan: plan,
          billingCycle,
          amountCop,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          autoRenew,
          internalNotes: notes.trim() || null,
        }),
      },
    ).catch(() => null);
    if (!response?.ok) {
      const body = (await response?.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      setMessage(body.error?.message ?? "No fue posible guardar la suscripción.");
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    setEditing(null);
    router.refresh();
  }

  return (
    <>
      <section aria-label="Resumen de suscripciones" className="subscription-summary-grid">
        <article>
          <span>Ingreso mensual</span>
          <strong>{formatCop(directory.metrics.monthlyRecurringRevenueCop)}</strong>
          <small>Equivalente recurrente activo</small>
        </article>
        <article>
          <span>Activas</span>
          <strong>{directory.metrics.active}</strong>
          <small>{directory.metrics.assigned} vinculadas a empresas</small>
        </article>
        <article>
          <span>Disponibles</span>
          <strong>{directory.metrics.available}</strong>
          <small>Listas para crear empresa</small>
        </article>
        <article className={directory.metrics.expiringWithinSevenDays ? "needs-attention" : ""}>
          <span>Próximas a vencer</span>
          <strong>{directory.metrics.expiringWithinSevenDays}</strong>
          <small>Dentro de los próximos 7 días</small>
        </article>
      </section>

      <div className="subscription-toolbar">
        <div>
          <strong>{directory.metrics.total} suscripciones</strong>
          <span>Planes, cobro y vigencia en un solo lugar.</span>
        </div>
        <button disabled={!owners.length} onClick={openCreate} type="button">
          <CreditCard aria-hidden="true" size={19} weight="bold" />
          Nueva suscripción
        </button>
      </div>

      {directory.subscriptions.length ? (
        <div className="subscription-list">
          {directory.subscriptions.map((subscription) => (
            <article className="subscription-row" key={subscription.id}>
              <div className="subscription-owner">
                <span className="subscription-plan">{subscription.membershipPlan}</span>
                <div>
                  <strong>{subscription.ownerDisplayName}</strong>
                  <small>{subscription.ownerEmail}</small>
                </div>
              </div>
              <div className="subscription-data">
                <div>
                  <span>Estado</span>
                  <strong
                    className={`subscription-status subscription-status-${subscription.status}`}
                  >
                    {statusLabels[subscription.status]}
                  </strong>
                </div>
                <div>
                  <span>Facturación</span>
                  <strong>
                    {formatCop(subscription.amountCop)} /
                    {subscription.billingCycle === "monthly" ? "mes" : "año"}
                  </strong>
                  <small>{formatCop(subscription.monthlyEquivalentCop)} mensual equivalente</small>
                </div>
                <div>
                  <span>Periodo</span>
                  <strong>
                    {periodLabel(subscription.currentPeriodStart, subscription.currentPeriodEnd)}
                  </strong>
                  <small>
                    {subscription.autoRenew ? "Renovación automática" : "Sin renovación"}
                  </small>
                </div>
                <div>
                  <span>Asignación</span>
                  <strong>{subscription.tenantName ?? "Disponible"}</strong>
                  <small>
                    {subscription.tenantSlug
                      ? `${subscription.tenantSlug}${subscription.additionalEmployeeSeats ? ` · +${subscription.additionalEmployeeSeats} cupos` : ""}`
                      : "Sin empresa vinculada"}
                  </small>
                </div>
              </div>
              <button
                aria-label={`Administrar suscripción de ${subscription.ownerDisplayName}`}
                className="subscription-edit"
                onClick={() => openEdit(subscription)}
                type="button"
              >
                <PencilSimple aria-hidden="true" size={18} weight="bold" />
                Administrar
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className="subscription-empty">
          <CreditCard aria-hidden="true" size={30} />
          <strong>No hay suscripciones con estos filtros</strong>
          <span>Prueba otra búsqueda o crea una suscripción para un propietario.</span>
        </div>
      )}

      {editing ? (
        <Modal
          className="subscription-modal"
          onClose={() => setEditing(null)}
          title={editing === "create" ? "Nueva suscripción" : "Administrar suscripción"}
        >
          <div className="subscription-modal-body">
            {editing === "create" ? (
              <label className="subscription-field subscription-field-wide">
                <span>Propietario</span>
                <select onChange={(event) => setOwnerId(event.target.value)} value={ownerId}>
                  {owners.map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.displayName} · {owner.email}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="subscription-modal-owner subscription-field-wide">
                <span>{editing.ownerDisplayName}</span>
                <small>
                  {editing.ownerEmail} · {editing.tenantName ?? "Aún sin empresa"}
                </small>
              </div>
            )}
            <label className="subscription-field">
              <span>Plan</span>
              <select
                onChange={(event) => changePlan(event.target.value as MembershipId)}
                value={plan}
              >
                {memberships.map((membership) => (
                  <option key={membership.id} value={membership.id}>
                    {membership.name}
                  </option>
                ))}
              </select>
              <small>{selectedPlan?.includedEmployeeSeats ?? 0} empleados incluidos</small>
            </label>
            <label className="subscription-field">
              <span>Ciclo</span>
              <select
                onChange={(event) =>
                  changeCycle(event.target.value as PlatformSubscriptionBillingCycle)
                }
                value={billingCycle}
              >
                <option value="monthly">Mensual</option>
                <option value="yearly">Anual</option>
              </select>
            </label>
            <label className="subscription-field">
              <span>Valor en COP</span>
              <input
                inputMode="numeric"
                onChange={(event) =>
                  setAmountCop(Number(event.target.value.replace(/\D/g, "").slice(0, 13)) || 0)
                }
                type="text"
                value={new Intl.NumberFormat("es-CO").format(amountCop)}
              />
            </label>
            <label className="subscription-field">
              <span>Inicio del periodo</span>
              <input
                onChange={(event) => setPeriodStart(event.target.value)}
                type="date"
                value={periodStart}
              />
            </label>
            <label className="subscription-field">
              <span>Fin del periodo</span>
              <input
                min={periodStart}
                onChange={(event) => setPeriodEnd(event.target.value)}
                type="date"
                value={periodEnd}
              />
            </label>
            {editing !== "create" ? (
              <label className="subscription-field">
                <span>Estado</span>
                <select
                  onChange={(event) => setStatus(event.target.value as PlatformSubscriptionStatus)}
                  value={status}
                >
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="subscription-toggle subscription-field-wide">
              <input
                checked={autoRenew}
                onChange={(event) => setAutoRenew(event.target.checked)}
                type="checkbox"
              />
              <span>
                <strong>Renovación automática</strong>
                <small>Mantiene el seguimiento del siguiente ciclo de cobro.</small>
              </span>
            </label>
            <label className="subscription-field subscription-field-wide">
              <span>Nota interna</span>
              <textarea
                maxLength={500}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Acuerdo comercial, referencia de pago o seguimiento…"
                rows={3}
                value={notes}
              />
            </label>
            {editing !== "create" && status !== "active" && editing.tenantId ? (
              <div className="subscription-warning subscription-field-wide">
                <CalendarBlank aria-hidden="true" size={20} />
                <span>Al guardar, la empresa activa vinculada quedará suspendida.</span>
              </div>
            ) : null}
            {message ? (
              <p className="subscription-form-error subscription-field-wide" role="alert">
                {message}
              </p>
            ) : null}
            <div className="subscription-modal-actions subscription-field-wide">
              <button onClick={() => setEditing(null)} type="button">
                Cancelar
              </button>
              <button
                disabled={submitting || !ownerId || !periodStart || !periodEnd}
                onClick={save}
                type="button"
              >
                <CheckCircle aria-hidden="true" size={19} weight="bold" />
                {submitting ? "Guardando…" : "Guardar suscripción"}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
