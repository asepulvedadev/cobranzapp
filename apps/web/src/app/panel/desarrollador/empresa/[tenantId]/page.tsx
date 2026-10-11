import { ArrowLeft, Eye, LockKey, Timer } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { SupportAccessRecord, TenantOverview } from "../../../../../lib/platform";
import { serverApi } from "../../../../../lib/server-api";
import { ActivityFeed } from "../../../ActivityFeed";

export const metadata: Metadata = { title: "Soporte autorizado" };

const roleLabels = {
  owner: "Propietario",
  supervisor: "Supervisor",
  collector: "Cobrador",
  customer: "Cliente",
};

const statusLabels = {
  active: "Activo",
  inactive: "Inactivo",
  invited: "Invitado",
  suspended: "Suspendido",
  revoked: "Revocado",
};

export default async function SupportWorkspace({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const response = await serverApi(`/v1/platform/tenants/${tenantId}/support-overview`);
  if (response.status === 401) redirect("/ingresar");
  if (response.status === 403) redirect("/panel/desarrollador?soporte=sin-autorizacion");
  if (response.status === 404) notFound();
  if (!response.ok) throw new Error("No fue posible cargar el espacio de soporte");

  const { access, overview } = (await response.json()) as {
    access: SupportAccessRecord;
    overview: TenantOverview;
  };
  const expiresAt = access.expiresAt
    ? new Intl.DateTimeFormat("es-CO", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "America/Bogota",
      }).format(new Date(access.expiresAt))
    : "Sin fecha disponible";

  return (
    <div className="dashboard-page support-workspace">
      <Link className="support-back-link" href="/panel/desarrollador#empresas">
        <ArrowLeft aria-hidden="true" size={18} />
        Volver a empresas
      </Link>

      <header className="dashboard-header support-workspace-header">
        <div>
          <span className="panel-eyebrow">Soporte autorizado</span>
          <h1>{overview.tenant.displayName}</h1>
          <p>{access.purpose}</p>
        </div>
        <span className="support-readonly-badge">
          <Eye aria-hidden="true" size={17} /> Solo lectura
        </span>
      </header>

      <section aria-label="Vigencia del acceso" className="support-session-banner">
        <LockKey aria-hidden="true" size={22} weight="fill" />
        <div>
          <strong>Sesión temporal y auditada</strong>
          <span>El acceso termina el {expiresAt} o cuando el propietario lo revoque.</span>
        </div>
        <Timer aria-hidden="true" size={22} />
      </section>

      <section aria-label="Indicadores de la empresa" className="metric-grid">
        <article>
          <span>Miembros activos</span>
          <strong>{overview.metrics.members}</strong>
          <small>Usuarios con acceso</small>
        </article>
        <article>
          <span>Sedes activas</span>
          <strong>{overview.metrics.branches}</strong>
          <small>Estructura operativa</small>
        </article>
        <article>
          <span>Equipos activos</span>
          <strong>{overview.metrics.teams}</strong>
          <small>Grupos configurados</small>
        </article>
        <article className="metric-accent">
          <span>Configuración</span>
          <strong>v{overview.settings.version}</strong>
          <small>Versión vigente</small>
        </article>
      </section>

      <div className="support-overview-grid">
        <section className="dashboard-card">
          <div className="card-heading">
            <div>
              <span className="panel-eyebrow">Configuración</span>
              <h2>Datos operativos</h2>
            </div>
          </div>
          <dl className="support-detail-list">
            <div>
              <dt>Correo de contacto</dt>
              <dd>{overview.settings.contactEmail ?? "Sin configurar"}</dd>
            </div>
            <div>
              <dt>Teléfono</dt>
              <dd>{overview.settings.contactPhone ?? "Sin configurar"}</dd>
            </div>
            <div>
              <dt>Dirección</dt>
              <dd>{overview.settings.address ?? "Sin configurar"}</dd>
            </div>
            <div>
              <dt>Operación</dt>
              <dd>
                {overview.tenant.currency} · {overview.tenant.timezone}
              </dd>
            </div>
          </dl>
        </section>

        <section className="dashboard-card">
          <div className="card-heading">
            <div>
              <span className="panel-eyebrow">Estructura</span>
              <h2>Sedes y equipos</h2>
            </div>
          </div>
          <div className="support-structure-list">
            {overview.branches.length ? (
              overview.branches.map((branch) => (
                <article key={branch.id}>
                  <div>
                    <strong>{branch.displayName}</strong>
                    <small>{branch.code}</small>
                  </div>
                  <span className={`status status-${branch.status}`}>
                    {statusLabels[branch.status]}
                  </span>
                </article>
              ))
            ) : (
              <p>La empresa aún no tiene sedes configuradas.</p>
            )}
            {overview.teams.map((team) => (
              <article key={team.id}>
                <div>
                  <strong>{team.displayName}</strong>
                  <small>
                    {team.branchName ?? "Sin sede"} · {team.memberIds.length} integrantes
                  </small>
                </div>
                <span className={`status status-${team.status}`}>{statusLabels[team.status]}</span>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className="dashboard-card activity-card">
        <div className="card-heading">
          <div>
            <span className="panel-eyebrow">Accesos</span>
            <h2>Miembros</h2>
          </div>
          <span>{overview.members.length} registros</span>
        </div>
        <div className="support-member-list">
          {overview.members.map((member) => (
            <article key={member.userId}>
              <span aria-hidden="true">{member.displayName.slice(0, 1).toUpperCase()}</span>
              <div>
                <strong>{member.displayName}</strong>
                <small>{member.email}</small>
              </div>
              <div>
                <strong>{roleLabels[member.role]}</strong>
                <small>{statusLabels[member.status]}</small>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="dashboard-card activity-card">
        <div className="card-heading">
          <div>
            <span className="panel-eyebrow">Trazabilidad</span>
            <h2>Actividad reciente</h2>
          </div>
        </div>
        <ActivityFeed activity={overview.activity} />
      </section>
    </div>
  );
}
