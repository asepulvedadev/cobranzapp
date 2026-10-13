import { CheckCircle, Circle } from "@phosphor-icons/react/dist/ssr";
import { formatCop, memberships } from "../../../../data/memberships";
import type { TenantOverview } from "../../../../lib/platform";

export function WorkspaceMembershipSummary({ overview }: { overview: TenantOverview }) {
  const plan = memberships.find((item) => item.id === overview.tenant.membershipPlan) ?? null;
  const entitlement = overview.membershipEntitlement;
  const steps = [
    { label: "Plan comercial asignado", complete: plan !== null },
    { label: "Propietario con acceso activo", complete: true },
    { label: "Correo operativo registrado", complete: overview.settings.contactEmail !== null },
    { label: "Operación preparada", complete: overview.metrics.branches > 0 },
  ];
  const completedSteps = steps.filter((step) => step.complete).length;

  return (
    <section className="workspace-membership-summary" aria-labelledby="membership-summary-title">
      <article className="dashboard-card membership-plan-card">
        <div>
          <span className="panel-eyebrow">Membresía</span>
          <h2 id="membership-summary-title">{plan ? `Plan ${plan.name}` : "Plan pendiente"}</h2>
          <p>
            {plan
              ? `${formatCop(plan.monthlyPriceCop)} COP al mes como valor base.`
              : "El equipo de cobranzapp debe asignar el plan antes de activar la empresa."}
          </p>
        </div>
        {plan && entitlement ? (
          <dl>
            <div>
              <dt>Personal activo</dt>
              <dd>
                {overview.metrics.activeEmployeeSeats} de {entitlement.employeeSeatLimit} cupos
              </dd>
            </div>
            <div>
              <dt>Capacidad contratada</dt>
              <dd>
                {entitlement.includedEmployeeSeats} incluidos
                {entitlement.additionalEmployeeSeats > 0
                  ? ` + ${entitlement.additionalEmployeeSeats} adicionales`
                  : ""}
              </dd>
            </div>
            <div>
              <dt>Cupos disponibles</dt>
              <dd>{entitlement.availableEmployeeSeats}</dd>
            </div>
            <div>
              <dt>Clientes</dt>
              <dd>Hasta {entitlement.clientLimit}</dd>
            </div>
            <div>
              <dt>Soporte</dt>
              <dd>{entitlement.prioritySupport ? "Prioritario" : "Estándar"}</dd>
            </div>
          </dl>
        ) : null}
        <small>
          Los cupos se validan al activar cada empleado. No se generan cobros automáticos por
          accesos sin activar.
        </small>
      </article>

      <article className="dashboard-card onboarding-progress-card">
        <header>
          <div>
            <span className="panel-eyebrow">Activación</span>
            <h2>Preparación de la empresa</h2>
          </div>
          <strong title={`${completedSteps} de ${steps.length} pasos completados`}>
            {completedSteps}/{steps.length}
          </strong>
        </header>
        <ul>
          {steps.map((step) => (
            <li className={step.complete ? "is-complete" : undefined} key={step.label}>
              {step.complete ? (
                <CheckCircle aria-hidden="true" size={20} weight="fill" />
              ) : (
                <Circle aria-hidden="true" size={20} />
              )}
              <span>{step.label}</span>
            </li>
          ))}
        </ul>
      </article>
    </section>
  );
}
