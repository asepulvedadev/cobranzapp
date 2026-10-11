import { redirect } from "next/navigation";
import type { PlatformOverview } from "../../../lib/platform";
import { serverApi } from "../../../lib/server-api";
import { CreateTenantForm } from "./CreateTenantForm";

const statusLabels = {
  draft: "Borrador",
  active: "Activa",
  suspended: "Suspendida",
  archived: "Archivada",
};

export default async function DeveloperDashboard() {
  const response = await serverApi("/v1/platform/overview");
  if (response.status === 401) redirect("/ingresar");
  if (response.status === 403) redirect("/ingresar?error=sin-acceso");
  if (!response.ok) throw new Error("No fue posible cargar la consola de plataforma");
  const overview = (await response.json()) as PlatformOverview;

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <span className="panel-eyebrow">Consola de plataforma</span>
          <h1>Vista general</h1>
          <p>Supervisa la base multitenant y habilita nuevos espacios empresariales.</p>
        </div>
        <span className="environment-badge">
          <i /> Producción
        </span>
      </header>

      <section aria-label="Indicadores principales" className="metric-grid">
        <article>
          <span>Empresas totales</span>
          <strong>{overview.metrics.tenants}</strong>
          <small>{overview.metrics.activeTenants} activas</small>
        </article>
        <article>
          <span>Usuarios registrados</span>
          <strong>{overview.metrics.users}</strong>
          <small>Identidades de plataforma</small>
        </article>
        <article>
          <span>Membresías activas</span>
          <strong>{overview.metrics.activeMemberships}</strong>
          <small>Accesos empresariales</small>
        </article>
        <article className="metric-accent">
          <span>Aislamiento</span>
          <strong>RLS</strong>
          <small>Protección activa en PostgreSQL</small>
        </article>
      </section>

      <div className="dashboard-columns">
        <section className="dashboard-card tenant-card" id="empresas">
          <div className="card-heading">
            <div>
              <span className="panel-eyebrow">Directorio</span>
              <h2>Empresas</h2>
            </div>
            <span>{overview.tenants.length} registros</span>
          </div>
          {overview.tenants.length ? (
            <div className="tenant-table-wrap">
              <table className="tenant-table">
                <thead>
                  <tr>
                    <th>Empresa</th>
                    <th>Estado</th>
                    <th>Miembros</th>
                    <th>Creada</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.tenants.map((tenant) => (
                    <tr key={tenant.id}>
                      <td>
                        <strong>{tenant.displayName}</strong>
                        <small>{tenant.slug}</small>
                      </td>
                      <td>
                        <span className={`status status-${tenant.status}`}>
                          {statusLabels[tenant.status]}
                        </span>
                      </td>
                      <td>{tenant.members}</td>
                      <td>
                        {new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(
                          new Date(tenant.createdAt),
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <span aria-hidden="true">◇</span>
              <h3>Aún no hay empresas</h3>
              <p>Crea el primer espacio. Quedará en borrador hasta completar su configuración.</p>
            </div>
          )}
        </section>

        <aside className="dashboard-card create-card">
          <div className="card-heading">
            <div>
              <span className="panel-eyebrow">Alta controlada</span>
              <h2>Nueva empresa</h2>
            </div>
          </div>
          <p>Crea únicamente el espacio aislado. Los usuarios y reglas se configuran después.</p>
          <CreateTenantForm />
        </aside>
      </div>

      <section className="dashboard-card activity-card" id="actividad">
        <div className="card-heading">
          <div>
            <span className="panel-eyebrow">Estado técnico</span>
            <h2>Controles habilitados</h2>
          </div>
        </div>
        <div className="control-list">
          <div>
            <i className="control-ok" />
            <span>
              <strong>Sesiones seguras</strong>
              <small>Cookie HttpOnly y revocación en servidor</small>
            </span>
          </div>
          <div>
            <i className="control-ok" />
            <span>
              <strong>Aislamiento multitenant</strong>
              <small>Políticas RLS verificadas en base de datos</small>
            </span>
          </div>
          <div>
            <i className="control-pending" />
            <span>
              <strong>Módulos financieros</strong>
              <small>Bloqueados hasta aprobar reglas legales y contables</small>
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
