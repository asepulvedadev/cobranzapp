import { redirect } from "next/navigation";
import type { PlatformOverview, SupportAccessRecord } from "../../../lib/platform";
import { serverApi } from "../../../lib/server-api";
import { ActivityFeed } from "../ActivityFeed";
import { InviteUserForm } from "../InviteUserForm";
import { CreateTenantForm } from "./CreateTenantForm";
import { SupportAccessControl } from "./SupportAccessControl";
import { TenantReadiness } from "./TenantReadiness";
import { TenantStatusButton } from "./TenantStatusButton";

const statusLabels = {
  draft: "Borrador",
  active: "Activa",
  suspended: "Suspendida",
  archived: "Archivada",
};

export default async function DeveloperDashboard({
  searchParams,
}: {
  searchParams: Promise<{ soporte?: string }>;
}) {
  const query = await searchParams;
  const [response, supportResponse] = await Promise.all([
    serverApi("/v1/platform/overview"),
    serverApi("/v1/platform/support-access"),
  ]);
  if (response.status === 401) redirect("/ingresar");
  if (response.status === 403) redirect("/ingresar?error=sin-acceso");
  if (!response.ok) throw new Error("No fue posible cargar la consola de plataforma");
  if (!supportResponse.ok) throw new Error("No fue posible cargar los accesos de soporte");
  const overview = (await response.json()) as PlatformOverview;
  const { access } = (await supportResponse.json()) as { access: SupportAccessRecord[] };

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

      {query.soporte === "sin-autorizacion" ? (
        <div className="support-expired-notice" role="status">
          <strong>El acceso de soporte ya no está disponible.</strong>
          <span>Solicita una nueva autorización si necesitas volver a consultar la empresa.</span>
        </div>
      ) : null}

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
          <p className="operational-note">
            Activar habilita el espacio de trabajo. No aprueba créditos ni movimientos de dinero.
          </p>
          {overview.tenants.length ? (
            <div className="tenant-table-wrap">
              <table className="tenant-table">
                <thead>
                  <tr>
                    <th>Empresa</th>
                    <th>Estado</th>
                    <th>Miembros</th>
                    <th>Preparación</th>
                    <th>Soporte</th>
                    <th>Creada</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.tenants.map((tenant) => (
                    <tr key={tenant.id}>
                      <td data-label="Empresa">
                        <strong>{tenant.displayName}</strong>
                        <small>{tenant.slug}</small>
                      </td>
                      <td data-label="Estado">
                        <span className={`status status-${tenant.status}`}>
                          {statusLabels[tenant.status]}
                        </span>
                      </td>
                      <td data-label="Miembros">{tenant.members}</td>
                      <td data-label="Preparación">
                        <TenantReadiness readiness={tenant.readiness} />
                      </td>
                      <td data-label="Soporte">
                        <SupportAccessControl
                          access={access.find((item) => item.tenantId === tenant.id) ?? null}
                          tenantId={tenant.id}
                        />
                      </td>
                      <td data-label="Creada">
                        {new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(
                          new Date(tenant.createdAt),
                        )}
                      </td>
                      <td data-label="Acción">
                        <TenantStatusButton
                          isReady={Object.values(tenant.readiness).every(Boolean)}
                          status={tenant.status}
                          tenantId={tenant.id}
                        />
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

        <div className="dashboard-side-stack">
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
          <aside className="dashboard-card create-card">
            <div className="card-heading">
              <div>
                <span className="panel-eyebrow">Acceso inicial</span>
                <h2>Invitar propietario</h2>
              </div>
            </div>
            <p>Genera un enlace de activación individual con vigencia de 72 horas.</p>
            <InviteUserForm
              allowedRoles={["owner"]}
              platform
              tenants={overview.tenants.map((tenant) => ({
                id: tenant.id,
                displayName: tenant.displayName,
              }))}
            />
          </aside>
        </div>
      </div>

      <section className="dashboard-card activity-card" id="actividad">
        <div className="card-heading">
          <div>
            <span className="panel-eyebrow">Trazabilidad</span>
            <h2>Actividad reciente</h2>
          </div>
        </div>
        <ActivityFeed activity={overview.activity} />
      </section>

      <section className="dashboard-card activity-card">
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
