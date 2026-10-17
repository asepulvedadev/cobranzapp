import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { CSSProperties } from "react";
import type {
  BorrowerDirectory,
  CurrentUser,
  LoanAnalytics,
  TenantOverview,
} from "../../../../lib/platform";
import { serverApi } from "../../../../lib/server-api";
import { CustomerWorkspace } from "./CustomerWorkspace";
import { OwnerCreditAnalytics } from "./OwnerCreditAnalytics";

export const metadata: Metadata = { title: "Inicio" };

const roleLabels = {
  owner: "Propietario",
  supervisor: "Supervisor",
  collector: "Cobrador",
  customer: "Cliente",
  support: "Soporte temporal",
};

const statusLabels = {
  draft: "En configuración",
  active: "Activa",
  suspended: "Suspendida",
  archived: "Archivada",
};

const roleGuidance = {
  owner: "Decisiones del negocio y alertas que necesitan tu atención.",
  supervisor: "Seguimiento del equipo y pendientes de la operación.",
  collector: "Tu trabajo de campo, clientes y cobros del día.",
  support: "Acceso temporal limitado a la asistencia autorizada.",
};

export default async function TenantDashboard({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const userResponse = await serverApi("/v1/auth/me");
  if (!userResponse.ok) redirect("/ingresar");
  const { user } = (await userResponse.json()) as { user: CurrentUser };
  const membership = user.memberships.find((item) => item.tenantSlug === slug);
  if (!membership) notFound();

  const response = await serverApi(`/v1/tenants/${membership.tenantId}/overview`);
  if (response.status === 401) redirect("/ingresar");
  if (response.status === 403 || response.status === 404) notFound();
  if (!response.ok) throw new Error("No fue posible cargar la empresa");
  const overview = (await response.json()) as TenantOverview;

  if (overview.actorRole === "customer") return <CustomerWorkspace overview={overview} />;

  let borrowerDirectory: BorrowerDirectory | null = null;
  if (overview.actorRole !== "support") {
    const borrowersResponse = await serverApi(
      `/v1/tenants/${membership.tenantId}/borrowers?page=1&pageSize=20`,
    );
    if (borrowersResponse.ok) {
      borrowerDirectory = (await borrowersResponse.json()) as BorrowerDirectory;
    }
  }

  const brandStyle = {
    "--tenant-brand-primary": overview.settings.primaryColor,
    "--tenant-brand-accent": overview.settings.accentColor,
  } as CSSProperties;
  const basePath = `/panel/empresa/${membership.tenantSlug}`;
  const activeClients = borrowerDirectory?.borrowerSummary.active ?? 0;
  const pendingIdentities = borrowerDirectory?.identitySummary.pending ?? 0;
  const activeCredits = overview.metrics.activeCredits ?? 0;
  const applicationsInReview = overview.metrics.creditApplicationsInReview ?? 0;
  const overdueInstallments = overview.metrics.overdueInstallments ?? 0;
  const isCollector = overview.actorRole === "collector";
  const dueTodayCredits = overview.metrics.dueTodayCredits ?? 0;
  const postponedCollections = overview.metrics.postponedCollections ?? 0;
  const firstName = user.displayName.trim().split(/\s+/)[0] ?? user.displayName;
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: overview.tenant.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  let ownerAnalytics: LoanAnalytics | null = null;
  if (overview.actorRole === "owner") {
    const from = `${today.slice(0, 7)}-01`;
    const analyticsResponse = await serverApi(
      `/v1/tenants/${membership.tenantId}/credit-analytics?from=${from}&to=${today}&preset=month`,
    );
    if (analyticsResponse.ok) {
      ownerAnalytics = ((await analyticsResponse.json()) as { analytics: LoanAnalytics }).analytics;
    }
  }

  const priorities = [
    ...(isCollector && dueTodayCredits > 0
      ? [
          {
            value: dueTodayCredits,
            label: "Cobros para hoy",
            detail: "Revisa los clientes asignados.",
            href: `${basePath}/creditos`,
            tone: "warning",
          },
        ]
      : []),
    ...(isCollector && postponedCollections > 0
      ? [
          {
            value: postponedCollections,
            label: "Cobros aplazados",
            detail: "Tienen una nueva fecha de seguimiento.",
            href: `${basePath}/clientes`,
            tone: "danger",
          },
        ]
      : []),
    ...(!isCollector && overdueInstallments > 0
      ? [
          {
            value: overdueInstallments,
            label: "Cuotas vencidas",
            detail: "Revisa a quién contactar primero.",
            href: `${basePath}/creditos`,
            tone: "danger",
          },
        ]
      : []),
    ...(applicationsInReview > 0 && !isCollector
      ? [
          {
            value: applicationsInReview,
            label: "Solicitudes por revisar",
            detail: "Hay decisiones de crédito pendientes.",
            href: `${basePath}/creditos`,
            tone: "warning",
          },
        ]
      : []),
    ...(pendingIdentities > 0
      ? [
          {
            value: pendingIdentities,
            label: "Identidades pendientes",
            detail: "Confirma los documentos antes de continuar.",
            href: `${basePath}/clientes`,
            tone: "warning",
          },
        ]
      : []),
  ];

  const quickActions = isCollector
    ? [
        {
          label: "Buscar cliente",
          href: `${basePath}/clientes`,
          detail: "Consulta su información",
        },
        { label: "Ver visitas de hoy", href: `${basePath}/rutas`, detail: "Ruta automática" },
        {
          label: "Verificar identidad",
          href: `${basePath}/verificacion`,
          detail: "Valida una cédula",
        },
        {
          label: "Crear crédito",
          href: `${basePath}/clientes`,
          detail: "Ábrelo desde el perfil del cliente",
        },
      ]
    : [
        { label: "Nuevo cliente", href: `${basePath}/clientes`, detail: "Registra sus datos" },
        {
          label: "Gestionar créditos",
          href: `${basePath}/creditos`,
          detail: "Solicitudes y productos",
        },
        { label: "Ver rutas automáticas", href: `${basePath}/rutas`, detail: "Cobros del día" },
      ];

  return (
    <div className="dashboard-page tenant-dashboard role-dashboard" style={brandStyle}>
      <div className="tenant-brand-band" aria-hidden="true" />
      <header className="dashboard-header role-dashboard-header">
        <div>
          <span className="panel-eyebrow">
            {overview.tenant.displayName} · {roleLabels[overview.actorRole]}
          </span>
          <h1>{isCollector ? `Tu día, ${firstName}` : `Hola, ${firstName}`}</h1>
          <p>{roleGuidance[overview.actorRole]}</p>
        </div>
        {overview.tenant.status !== "active" ? (
          <span className={`status status-${overview.tenant.status}`}>
            {statusLabels[overview.tenant.status]}
          </span>
        ) : null}
      </header>

      <section aria-label="Resumen operativo" className="metric-grid role-metrics">
        <article>
          <span>{isCollector ? "Clientes asignados" : "Clientes activos"}</span>
          <strong>{activeClients}</strong>
          <small>{isCollector ? "Disponibles para tu gestión" : "En la operación"}</small>
        </article>
        {isCollector ? (
          <>
            <article className={dueTodayCredits > 0 ? "metric-attention" : "metric-accent"}>
              <span>Cobros para hoy</span>
              <strong>{dueTodayCredits}</strong>
              <small>{dueTodayCredits > 0 ? "Cuotas programadas" : "Sin cobros pendientes"}</small>
            </article>
            <article className={postponedCollections > 0 ? "metric-alert" : "metric-accent"}>
              <span>Cobros aplazados</span>
              <strong>{postponedCollections}</strong>
              <small>{postponedCollections > 0 ? "Requieren seguimiento" : "Ninguno"}</small>
            </article>
          </>
        ) : (
          <>
            <article>
              <span>Créditos activos</span>
              <strong>{activeCredits}</strong>
              <small>Seguimiento vigente</small>
            </article>
            <article className={overdueInstallments > 0 ? "metric-alert" : "metric-accent"}>
              <span>Cuotas vencidas</span>
              <strong>{overdueInstallments}</strong>
              <small>{overdueInstallments > 0 ? "Necesitan gestión" : "Sin pendientes"}</small>
            </article>
          </>
        )}
        {!isCollector ? (
          <article className={applicationsInReview > 0 ? "metric-attention" : undefined}>
            <span>Por revisar</span>
            <strong>{applicationsInReview}</strong>
            <small>Solicitudes de crédito</small>
          </article>
        ) : null}
      </section>

      {ownerAnalytics ? (
        <OwnerCreditAnalytics
          initialAnalytics={ownerAnalytics}
          tenantId={membership.tenantId}
          today={today}
        />
      ) : null}

      <div className="role-dashboard-grid">
        <section className="dashboard-card priority-card">
          <div className="card-heading">
            <div>
              <span className="panel-eyebrow">Enfoque</span>
              <h2>Prioridades de hoy</h2>
            </div>
            <span>{priorities.length} pendientes</span>
          </div>
          {priorities.length ? (
            <div className="priority-list">
              {priorities.map((priority) => (
                <Link
                  className={`priority-item priority-${priority.tone}`}
                  href={priority.href}
                  key={priority.label}
                >
                  <strong>{priority.value}</strong>
                  <span>
                    <b>{priority.label}</b>
                    <small>{priority.detail}</small>
                  </span>
                  <i aria-hidden="true">→</i>
                </Link>
              ))}
            </div>
          ) : (
            <div className="dashboard-empty-compact">
              <span aria-hidden="true">✓</span>
              <div>
                <strong>Todo al día</strong>
                <p>No hay alertas operativas pendientes.</p>
              </div>
            </div>
          )}
        </section>

        <section className="dashboard-card quick-actions-card">
          <div className="card-heading">
            <div>
              <span className="panel-eyebrow">Accesos rápidos</span>
              <h2>¿Qué necesitas hacer?</h2>
            </div>
          </div>
          <div className="quick-action-grid">
            {quickActions.map((action) => (
              <Link href={action.href} key={action.label}>
                <strong>{action.label}</strong>
                <small>{action.detail}</small>
                <span aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        </section>
      </div>

      {overview.actorRole === "owner" ? (
        <section className="dashboard-card business-summary-card">
          <div>
            <span className="panel-eyebrow">Negocio</span>
            <h2>Equipo y capacidad</h2>
            <p>Solo tú ves la capacidad del plan y la administración de la empresa.</p>
          </div>
          <dl>
            <div>
              <dt>Personal activo</dt>
              <dd>{overview.metrics.members}</dd>
            </div>
            <div>
              <dt>Cupos disponibles</dt>
              <dd>{overview.membershipEntitlement?.availableEmployeeSeats ?? "—"}</dd>
            </div>
          </dl>
          <Link className="secondary-action" href={`${basePath}/equipo`}>
            Administrar personal
          </Link>
        </section>
      ) : null}
    </div>
  );
}
