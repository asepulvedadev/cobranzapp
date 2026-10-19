import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { loadTenantContext } from "../tenant-context";
import { ClientVerificationSearch } from "../VerificationNetworkPanel";

export const metadata: Metadata = { title: "Verificar cliente" };

export default async function ClientVerificationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { membership, overview } = await loadTenantContext(slug);
  if (!["owner", "supervisor", "collector"].includes(membership.role)) notFound();
  const brandStyle = {
    "--tenant-brand-primary": overview.settings.primaryColor,
    "--tenant-brand-accent": overview.settings.accentColor,
  } as CSSProperties;

  return (
    <div className="dashboard-page tenant-dashboard verification-page" style={brandStyle}>
      <div className="tenant-brand-band" aria-hidden="true" />
      <header className="dashboard-header">
        <div>
          <span className="panel-eyebrow">{overview.tenant.displayName}</span>
          <h1>Verificar cliente</h1>
          <p>Consulta rápida por número de cédula antes de iniciar una operación.</p>
        </div>
      </header>
      <ClientVerificationSearch
        canManageRiskRegistry={["owner", "supervisor"].includes(membership.role)}
        tenantId={overview.tenant.id}
      />
    </div>
  );
}
