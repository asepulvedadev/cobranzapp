import { CheckCircleIcon } from "@phosphor-icons/react/dist/ssr";
import {
  formatCop,
  membershipContactHref,
  membershipExtraEmployeePriceCop,
  membershipFeatures,
  membershipSetupFeeCop,
  memberships,
} from "../data/memberships";

export function PricingSection() {
  return (
    <section className="pricing-section section-shell" id="planes" aria-labelledby="plans-title">
      <div className="section-heading narrow pricing-heading">
        <span className="eyebrow">Membresías para tu empresa</span>
        <h2 id="plans-title">Dos planes. Toda tu operación en un solo lugar.</h2>
        <p>
          Elige la capacidad que necesita tu equipo. Ambos incluyen las mismas herramientas; Ultra
          suma más empleados, más clientes y soporte prioritario.
        </p>
      </div>

      <div className="pricing-grid">
        {memberships.map((plan) => (
          <article
            className={`plan-card plan-${plan.id}`}
            key={plan.id}
            aria-labelledby={`plan-${plan.id}`}
          >
            <div className="plan-card-heading">
              <h3 id={`plan-${plan.id}`}>{plan.name}</h3>
              <span className="plan-badge">
                {plan.prioritySupport ? "Soporte prioritario" : "Control esencial"}
              </span>
            </div>
            <p className="plan-description">{plan.description}</p>
            <p className="plan-price">
              <strong>{formatCop(plan.monthlyPriceCop)}</strong>
              <span>COP / mes</span>
            </p>
            <dl className="plan-capacity">
              <div>
                <dt>Empleados</dt>
                <dd>{plan.includedEmployeeSeats} incluidos</dd>
              </div>
              <div>
                <dt>Clientes</dt>
                <dd>Hasta {plan.clientLimit}</dd>
              </div>
              <div>
                <dt>Préstamos</dt>
                <dd>Ilimitados</dd>
              </div>
            </dl>
            <p className="plan-owner-note">
              El dueño va aparte:{" "}
              <strong>
                {plan.includedEmployeeSeats + plan.ownerSeats} usuarios incluidos en total
              </strong>
              . Combina los empleados según los roles de tu operación.
            </p>
            <p className="plan-extra-note">
              ¿Necesitas más empleados?{" "}
              <strong>+ {formatCop(membershipExtraEmployeePriceCop)} COP</strong> por usuario
              adicional del equipo / mes. El dueño ya está incluido.
            </p>
            <ul className="plan-feature-list">
              {membershipFeatures.map((feature) => (
                <li key={feature.id}>
                  <CheckCircleIcon size={20} weight="fill" aria-hidden="true" />
                  <span>{feature.label}</span>
                </li>
              ))}
              {plan.prioritySupport && (
                <li>
                  <CheckCircleIcon size={20} weight="fill" aria-hidden="true" />
                  <span>Soporte prioritario incluido</span>
                </li>
              )}
            </ul>
            <a className="button plan-action" href={membershipContactHref(plan.name)}>
              Consultar plan {plan.name} <span aria-hidden="true">↗</span>
            </a>
            <small className="plan-setup-note">
              + {formatCop(membershipSetupFeeCop)} COP de creación de empresa y onboarding, una sola
              vez.
            </small>
          </article>
        ))}
      </div>

      <aside className="pricing-onboarding" aria-label="Costo de creación y onboarding">
        <div>
          <span className="eyebrow">Un solo pago para empezar</span>
          <h3>Creación de empresa + onboarding</h3>
          <p>Se cobra aparte de la mensualidad, por empresa, en cualquiera de los dos planes.</p>
        </div>
        <p className="onboarding-price">
          <strong>{formatCop(membershipSetupFeeCop)}</strong>
          <span>COP · pago único</span>
        </p>
      </aside>

      <section className="pricing-details" aria-labelledby="plan-details-title">
        <h3 id="plan-details-title">El alcance, sin letra pequeña.</h3>
        <div className="pricing-detail-grid">
          {membershipFeatures.map((feature) => (
            <div key={feature.id}>
              <h4>{feature.label}</h4>
              <p>{feature.detail}</p>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}
