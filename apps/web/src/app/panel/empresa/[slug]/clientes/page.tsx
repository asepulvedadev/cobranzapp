import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import type { BorrowerDirectory } from "../../../../../lib/platform";
import { serverApi } from "../../../../../lib/server-api";
import { BorrowerDirectory as BorrowerDirectoryView } from "../BorrowerDirectory";
import { loadTenantContext } from "../tenant-context";

export const metadata: Metadata = { title: "Clientes" };

export default async function CustomersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { overview } = await loadTenantContext(slug);
  if (!["owner", "supervisor", "collector"].includes(overview.actorRole)) notFound();
  const response = await serverApi(
    `/v1/tenants/${overview.tenant.id}/borrowers?page=1&pageSize=20`,
  );
  const directory = response.ok ? ((await response.json()) as BorrowerDirectory) : null;
  const brandStyle = {
    "--tenant-brand-primary": overview.settings.primaryColor,
    "--tenant-brand-accent": overview.settings.accentColor,
  } as CSSProperties;
  return (
    <div className="dashboard-page tenant-subpage" style={brandStyle}>
      <header className="dashboard-header">
        <div>
          <span className="panel-eyebrow">{overview.tenant.displayName}</span>
          <h1>Clientes</h1>
          <p>Busca, verifica y revisa la cartera sin cargar el resto de la operación.</p>
        </div>
      </header>
      <section className="dashboard-card borrower-directory-card">
        {directory ? (
          <BorrowerDirectoryView
            canCreate={
              overview.actorRole === "owner" ||
              overview.actorRole === "supervisor" ||
              overview.actorRole === "collector"
            }
            canReview={overview.actorRole === "owner" || overview.actorRole === "supervisor"}
            directory={directory}
            search=""
            tenantSlug={slug}
            tenantId={overview.tenant.id}
          />
        ) : (
          <p className="operational-note">El directorio todavía no está disponible.</p>
        )}
      </section>
    </div>
  );
}
