import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import type { CurrentUser, TenantOverview } from "../../../../lib/platform";
import { serverApi } from "../../../../lib/server-api";
import { InviteUserForm } from "../../InviteUserForm";

export const metadata: Metadata = { title: "Espacio empresarial" };

const roleLabels = {
  owner: "Propietario",
  supervisor: "Supervisor",
  collector: "Cobrador",
  customer: "Cliente",
};

const statusLabels = {
  draft: "Configuración",
  active: "Activa",
  suspended: "Suspendida",
  archived: "Archivada",
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
  const canSeeTeam = overview.actorRole === "owner" || overview.actorRole === "supervisor";

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <span className="panel-eyebrow">Espacio empresarial</span>
          <h1>{overview.tenant.displayName}</h1>
          <p>
            Sesión como {roleLabels[overview.actorRole]}. Operación en {overview.tenant.currency} y
            zona horaria {overview.tenant.timezone}.
          </p>
        </div>
        <span className={`status status-${overview.tenant.status}`}>
          {statusLabels[overview.tenant.status]}
        </span>
      </header>

      <section aria-label="Indicadores de la empresa" className="metric-grid tenant-metrics">
        <article>
          <span>Integrantes activos</span>
          <strong>{overview.metrics.members}</strong>
          <small>Accesos vigentes</small>
        </article>
        <article>
          <span>Sedes activas</span>
          <strong>{overview.metrics.branches}</strong>
          <small>Estructura operativa</small>
        </article>
        <article>
          <span>Invitaciones pendientes</span>
          <strong>{overview.metrics.pendingInvitations}</strong>
          <small>Vencen automáticamente</small>
        </article>
        <article className="metric-accent">
          <span>Moneda</span>
          <strong>{overview.tenant.currency}</strong>
          <small>{overview.tenant.locale}</small>
        </article>
      </section>

      <div className="dashboard-columns" id="equipo">
        <section className="dashboard-card tenant-card">
          <div className="card-heading">
            <div>
              <span className="panel-eyebrow">Accesos</span>
              <h2>Equipo de trabajo</h2>
            </div>
            <span>{overview.members.length} visibles</span>
          </div>
          {canSeeTeam && overview.members.length ? (
            <div className="tenant-table-wrap">
              <table className="tenant-table">
                <thead>
                  <tr>
                    <th>Persona</th>
                    <th>Rol</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.members.map((member) => (
                    <tr key={member.userId}>
                      <td data-label="Persona">
                        <strong>{member.displayName}</strong>
                        <small>{member.email}</small>
                      </td>
                      <td data-label="Rol">{roleLabels[member.role]}</td>
                      <td data-label="Estado">
                        <span
                          className={`status status-${member.status === "active" ? "active" : "draft"}`}
                        >
                          {member.status === "active" ? "Activo" : "Restringido"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <span aria-hidden="true">◇</span>
              <h3>{canSeeTeam ? "Aún no hay más integrantes" : "Información protegida"}</h3>
              <p>
                {canSeeTeam
                  ? "Invita al equipo cuando la estructura operativa esté definida."
                  : "Tu rol no permite consultar el directorio completo de la empresa."}
              </p>
            </div>
          )}
        </section>

        {overview.actorRole === "owner" ? (
          <aside className="dashboard-card create-card">
            <div className="card-heading">
              <div>
                <span className="panel-eyebrow">Equipo</span>
                <h2>Invitar persona</h2>
              </div>
            </div>
            <p>Asigna solo el rol necesario. El acceso se activa desde un enlace individual.</p>
            <InviteUserForm
              allowedRoles={["supervisor", "collector", "customer"]}
              tenantId={overview.tenant.id}
            />
          </aside>
        ) : (
          <aside className="dashboard-card create-card">
            <div className="card-heading">
              <div>
                <span className="panel-eyebrow">Permisos</span>
                <h2>Acceso limitado</h2>
              </div>
            </div>
            <p>La administración de usuarios corresponde al propietario de la empresa.</p>
          </aside>
        )}
      </div>

      <section className="dashboard-card activity-card" id="configuracion">
        <div className="card-heading">
          <div>
            <span className="panel-eyebrow">Activación operativa</span>
            <h2>Estado de los módulos</h2>
          </div>
        </div>
        <div className="control-list">
          <div>
            <i className="control-ok" />
            <span>
              <strong>Empresa aislada</strong>
              <small>El espacio y sus membresías están protegidos por RLS</small>
            </span>
          </div>
          <div>
            <i className="control-ok" />
            <span>
              <strong>Roles habilitados</strong>
              <small>Propietario, supervisor, cobrador y cliente</small>
            </span>
          </div>
          <div>
            <i className="control-pending" />
            <span>
              <strong>Crédito y recaudo</strong>
              <small>Pendientes de reglas legales, contables y operativas aprobadas</small>
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
