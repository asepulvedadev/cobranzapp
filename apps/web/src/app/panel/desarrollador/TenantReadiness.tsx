import type { PlatformOverview } from "../../../lib/platform";

type Readiness = PlatformOverview["tenants"][number]["readiness"];

const readinessSteps: Array<{ key: keyof Readiness; label: string }> = [
  { key: "activeOwner", label: "Propietario" },
  { key: "contactEmail", label: "Contacto" },
  { key: "activeBranch", label: "Sede" },
];

export function TenantReadiness({ readiness }: { readiness: Readiness }) {
  const completed = readinessSteps.filter((step) => readiness[step.key]).length;

  return (
    <section
      aria-label={`Preparación de la empresa: ${completed} de ${readinessSteps.length} requisitos`}
      className="tenant-readiness"
    >
      <div>
        <strong>{completed === readinessSteps.length ? "Lista" : "En preparación"}</strong>
        <span>
          {completed}/{readinessSteps.length}
        </span>
      </div>
      <progress max={readinessSteps.length} value={completed}>
        {completed} de {readinessSteps.length}
      </progress>
      <ul>
        {readinessSteps.map((step) => (
          <li className={readiness[step.key] ? "is-complete" : undefined} key={step.key}>
            <i aria-hidden="true" />
            {step.label}
          </li>
        ))}
      </ul>
    </section>
  );
}
