import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RouteWorkspace } from "../RouteWorkspace";
import { loadTenantContext } from "../tenant-context";

export const metadata: Metadata = { title: "Rutas" };

export default async function RoutesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { overview } = await loadTenantContext(slug);
  if (!["owner", "supervisor", "collector"].includes(overview.actorRole)) notFound();

  return (
    <RouteWorkspace
      actorRole={overview.actorRole}
      collectors={overview.members}
      tenantId={overview.tenant.id}
      tenantName={overview.tenant.displayName}
    />
  );
}
