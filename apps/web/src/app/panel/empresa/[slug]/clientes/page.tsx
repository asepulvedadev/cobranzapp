import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import type { BorrowerDirectory } from "../../../../../lib/platform";
import { serverApi } from "../../../../../lib/server-api";
import { BorrowerDirectory as BorrowerDirectoryView } from "../BorrowerDirectory";
import { borrowerDirectoryApiPath, parseBorrowerDirectoryQuery } from "../borrower-directory-query";
import { loadTenantContext } from "../tenant-context";

export const metadata: Metadata = { title: "Clientes" };

export default async function CustomersPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    cliente?: string | string[];
    paginaCliente?: string | string[];
  }>;
}) {
  const { slug } = await params;
  const { page, search } = parseBorrowerDirectoryQuery(await searchParams);
  const { overview } = await loadTenantContext(slug);
  if (
    overview.actorRole !== "owner" &&
    overview.actorRole !== "supervisor" &&
    overview.actorRole !== "collector"
  ) {
    notFound();
  }
  const response = await serverApi(borrowerDirectoryApiPath(overview.tenant.id, search, page));
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
        </div>
      </header>
      <section className="dashboard-card borrower-directory-card">
        {directory ? (
          <BorrowerDirectoryView
            actorRole={overview.actorRole}
            canCreate={
              overview.actorRole === "owner" ||
              overview.actorRole === "supervisor" ||
              overview.actorRole === "collector"
            }
            canReview={overview.actorRole === "owner" || overview.actorRole === "supervisor"}
            collectors={overview.members.filter(
              (member) => member.role === "collector" && member.status === "active",
            )}
            directory={directory}
            search={search}
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
