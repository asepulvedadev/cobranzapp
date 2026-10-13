import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import type { CurrentUser } from "../../../../../lib/platform";
import { serverApi } from "../../../../../lib/server-api";
import { ClientVerificationSearch } from "../VerificationNetworkPanel";

export const metadata: Metadata = { title: "Verificar cliente" };

export default async function ClientVerificationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const userResponse = await serverApi("/v1/auth/me");
  if (!userResponse.ok) redirect("/ingresar");
  const { user } = (await userResponse.json()) as { user: CurrentUser };
  const membership = user.memberships.find((item) => item.tenantSlug === slug);
  if (!membership || !["owner", "supervisor", "collector"].includes(membership.role)) notFound();

  return (
    <div className="dashboard-page tenant-dashboard verification-page">
      <div className="tenant-brand-band" aria-hidden="true" />
      <header className="dashboard-header">
        <div>
          <span className="panel-eyebrow">{membership.tenantName}</span>
          <h1>Verificar cliente</h1>
          <p>Consulta rápida por número de cédula antes de iniciar una operación.</p>
        </div>
      </header>
      <ClientVerificationSearch tenantId={membership.tenantId} />
    </div>
  );
}
