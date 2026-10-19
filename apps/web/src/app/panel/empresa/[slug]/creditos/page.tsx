import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import type { BorrowerDirectory, LoanApplication, LoanProduct } from "../../../../../lib/platform";
import { serverApi } from "../../../../../lib/server-api";
import { CreditProductCatalog } from "../CreditProductCatalog";
import { LoanApplicationBoard } from "../LoanApplicationBoard";
import { loadTenantContext } from "../tenant-context";

export const metadata: Metadata = { title: "Créditos" };

export default async function CreditsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ cliente?: string; nuevo?: string; cobros?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const { overview } = await loadTenantContext(slug);
  if (!["owner", "supervisor", "collector"].includes(overview.actorRole)) notFound();

  const [productsResponse, applicationsResponse, borrowersResponse] = await Promise.all([
    serverApi(`/v1/tenants/${overview.tenant.id}/loan-products`),
    serverApi(`/v1/tenants/${overview.tenant.id}/loan-applications`),
    serverApi(`/v1/tenants/${overview.tenant.id}/borrowers?page=1&pageSize=100`),
  ]);
  const products = productsResponse.ok
    ? ((await productsResponse.json()) as { products: LoanProduct[] }).products
    : null;
  const applications = applicationsResponse.ok
    ? ((await applicationsResponse.json()) as { applications: LoanApplication[] }).applications
    : null;
  const borrowers = borrowersResponse.ok
    ? ((await borrowersResponse.json()) as BorrowerDirectory).borrowers
    : null;
  const brandStyle = {
    "--tenant-brand-primary": overview.settings.primaryColor,
    "--tenant-brand-accent": overview.settings.accentColor,
  } as CSSProperties;
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: overview.tenant.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const initialCollectionView = ["todos", "vencidos", "hoy", "proximos", "por-aprobar"].includes(
    query.cobros ?? "",
  )
    ? query.cobros
    : "todos";

  return (
    <div className="dashboard-page tenant-subpage" style={brandStyle}>
      <header className="dashboard-header">
        <div>
          <span className="panel-eyebrow">{overview.tenant.displayName}</span>
          <h1>Créditos</h1>
          <p>Configura productos y registra operaciones sin mezclar este flujo con el inicio.</p>
        </div>
      </header>
      {!products || !applications || !borrowers ? (
        <section className="dashboard-card">
          <p className="operational-note">No fue posible cargar el módulo de créditos.</p>
        </section>
      ) : (
        <>
          {overview.actorRole === "owner" || overview.actorRole === "supervisor" ? (
            <CreditProductCatalog
              canConfigure={overview.actorRole === "owner"}
              canReview={overview.actorRole === "owner" || overview.actorRole === "supervisor"}
              products={products}
              tenantId={overview.tenant.id}
            />
          ) : null}
          <LoanApplicationBoard
            actorRole={overview.actorRole as "owner" | "supervisor" | "collector"}
            applications={applications}
            borrowers={borrowers}
            canReview={overview.actorRole === "owner" || overview.actorRole === "supervisor"}
            initialBorrowerId={
              borrowers.some((borrower) => borrower.id === query.cliente)
                ? query.cliente
                : undefined
            }
            openCreate={
              query.nuevo === "1" &&
              borrowers.some(
                (borrower) =>
                  borrower.id === query.cliente &&
                  borrower.status === "active" &&
                  borrower.identity.verificationState === "reviewed",
              )
            }
            products={products}
            tenantId={overview.tenant.id}
            today={today}
            initialCollectionView={initialCollectionView}
          />
        </>
      )}
    </div>
  );
}
