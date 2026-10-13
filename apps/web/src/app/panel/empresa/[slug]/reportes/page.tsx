import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import type { LoanApplication } from "../../../../../lib/platform";
import { serverApi } from "../../../../../lib/server-api";
import { OperationalReport } from "../OperationalReport";
import { loadTenantContext } from "../tenant-context";

export const metadata: Metadata = { title: "Reportes operativos" };

export default async function OperationalReportsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { overview } = await loadTenantContext(slug);
  if (
    overview.actorRole !== "owner" &&
    overview.actorRole !== "supervisor" &&
    overview.actorRole !== "collector"
  ) {
    notFound();
  }
  const response = await serverApi(`/v1/tenants/${overview.tenant.id}/loan-applications`);
  const applications = response.ok
    ? ((await response.json()) as { applications: LoanApplication[] }).applications
    : null;
  const brandStyle = {
    "--tenant-brand-primary": overview.settings.primaryColor,
    "--tenant-brand-accent": overview.settings.accentColor,
  } as CSSProperties;

  return (
    <div className="dashboard-page tenant-subpage" style={brandStyle}>
      <header className="dashboard-header">
        <div>
          <span className="panel-eyebrow">{overview.tenant.displayName}</span>
          <h1>Reportes operativos</h1>
          <p>Prioriza la gestión de cuotas sin presentar proyecciones como saldos contables.</p>
        </div>
      </header>
      {applications ? (
        <OperationalReport applications={applications} />
      ) : (
        <section className="dashboard-card">
          <p className="operational-note">No fue posible cargar los reportes operativos.</p>
        </section>
      )}
    </div>
  );
}
