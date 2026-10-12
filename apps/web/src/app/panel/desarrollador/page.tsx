import { CloudCheck, Database, GitCommit, Queue } from "@phosphor-icons/react/dist/ssr";
import { redirect } from "next/navigation";
import type {
  PlatformOverview,
  PlatformSystemStatus,
  PlatformUserDirectory,
  SupportAccessRecord,
  TenantDirectory,
} from "../../../lib/platform";
import { serverApi } from "../../../lib/server-api";
import { ActivityFeed } from "../ActivityFeed";
import { InviteUserForm } from "../InviteUserForm";
import { CreateTenantForm } from "./CreateTenantForm";
import { SupportAccessControl } from "./SupportAccessControl";
import { TenantMembershipPlanControl } from "./TenantMembershipPlanControl";
import { TenantReadiness } from "./TenantReadiness";
import { TenantStatusButton } from "./TenantStatusButton";
import { UserStatusControl } from "./UserStatusControl";

const statusLabels = {
  draft: "Borrador",
  active: "Activa",
  suspended: "Suspendida",
  archived: "Archivada",
};

const tenantStatuses = new Set(["draft", "active", "suspended", "archived"]);

function firstQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function directoryHref(page: number, search: string, status: string | null) {
  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (status) params.set("estado", status);
  if (page > 1) params.set("pagina", String(page));
  const query = params.toString();
  return `/panel/desarrollador${query ? `?${query}` : ""}#empresas`;
}

function userDirectoryHref(page: number, search: string, status: string | null) {
  const params = new URLSearchParams();
  if (search) params.set("usuario", search);
  if (status) params.set("estadoUsuario", status);
  if (page > 1) params.set("paginaUsuario", String(page));
  const query = params.toString();
  return `/panel/desarrollador${query ? `?${query}` : ""}#usuarios`;
}

function jobStatusDetail(jobs: PlatformSystemStatus["jobs"]) {
  if (jobs.dead > 0) {
    return jobs.dead === 1 ? "1 trabajo en cola de errores" : `${jobs.dead} trabajos con error`;
  }
  if (jobs.expiredLeases > 0) {
    return jobs.expiredLeases === 1
      ? "1 trabajo sin renovar"
      : `${jobs.expiredLeases} trabajos sin renovar`;
  }
  if (jobs.due > 0) {
    const pending = jobs.due === 1 ? "1 pendiente" : `${jobs.due} pendientes`;
    return jobs.processing > 0 ? `${pending} · ${jobs.processing} en proceso` : pending;
  }
  return jobs.scheduled === 1 ? "1 trabajo programado" : `${jobs.scheduled} programados`;
}

export default async function DeveloperDashboard({
  searchParams,
}: {
  searchParams: Promise<{
    soporte?: string | string[];
    q?: string | string[];
    estado?: string | string[];
    pagina?: string | string[];
    usuario?: string | string[];
    estadoUsuario?: string | string[];
    paginaUsuario?: string | string[];
  }>;
}) {
  const query = await searchParams;
  const search = (firstQueryValue(query.q) ?? "").trim().slice(0, 80);
  const requestedStatus = firstQueryValue(query.estado) ?? null;
  const status = requestedStatus && tenantStatuses.has(requestedStatus) ? requestedStatus : null;
  const requestedPage = Number(firstQueryValue(query.pagina));
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const directoryQuery = new URLSearchParams({ page: String(page), pageSize: "20" });
  if (search) directoryQuery.set("q", search);
  if (status) directoryQuery.set("status", status);
  const userSearch = (firstQueryValue(query.usuario) ?? "").trim().slice(0, 80);
  const requestedUserStatus = firstQueryValue(query.estadoUsuario) ?? null;
  const userStatus =
    requestedUserStatus === "active" || requestedUserStatus === "disabled"
      ? requestedUserStatus
      : null;
  const requestedUserPage = Number(firstQueryValue(query.paginaUsuario));
  const userPage =
    Number.isInteger(requestedUserPage) && requestedUserPage > 0 ? requestedUserPage : 1;
  const userDirectoryQuery = new URLSearchParams({ page: String(userPage), pageSize: "20" });
  if (userSearch) userDirectoryQuery.set("q", userSearch);
  if (userStatus) userDirectoryQuery.set("status", userStatus);
  const [response, directoryResponse, userDirectoryResponse, supportResponse, systemResponse] =
    await Promise.all([
      serverApi("/v1/platform/overview"),
      serverApi(`/v1/platform/tenants?${directoryQuery}`),
      serverApi(`/v1/platform/users?${userDirectoryQuery}`),
      serverApi("/v1/platform/support-access"),
      serverApi("/v1/platform/system-status"),
    ]);
  if (response.status === 401) redirect("/ingresar");
  if (response.status === 403) redirect("/ingresar?error=sin-acceso");
  if (!response.ok) throw new Error("No fue posible cargar la consola de plataforma");
  if (!directoryResponse.ok) throw new Error("No fue posible cargar el directorio de empresas");
  if (!userDirectoryResponse.ok) throw new Error("No fue posible cargar el directorio de usuarios");
  if (!supportResponse.ok) throw new Error("No fue posible cargar los accesos de soporte");
  if (!systemResponse.ok) throw new Error("No fue posible validar el estado de la plataforma");
  const overview = (await response.json()) as PlatformOverview;
  const directory = (await directoryResponse.json()) as TenantDirectory;
  const userDirectory = (await userDirectoryResponse.json()) as PlatformUserDirectory;
  const { access } = (await supportResponse.json()) as { access: SupportAccessRecord[] };
  const system = (await systemResponse.json()) as PlatformSystemStatus;
  const version =
    system.api.version === "development" ? "Desarrollo" : system.api.version.slice(0, 8);
  const schemaVersion = system.database.schemaVersion?.split("_")[0] ?? "Sin migraciones";

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

      {firstQueryValue(query.soporte) === "sin-autorizacion" ? (
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

      <section aria-label="Estado de la plataforma" className="system-status-grid">
        <article>
          <CloudCheck aria-hidden="true" size={22} weight="fill" />
          <div>
            <span>API</span>
            <strong>Operativa</strong>
          </div>
          <small>Comprobada ahora</small>
        </article>
        <article>
          <Database aria-hidden="true" size={22} weight="fill" />
          <div>
            <span>Base de datos</span>
            <strong>Esquema {schemaVersion}</strong>
          </div>
          <small>PostgreSQL disponible</small>
        </article>
        <article>
          <GitCommit aria-hidden="true" size={22} weight="fill" />
          <div>
            <span>Versión desplegada</span>
            <strong>{version}</strong>
          </div>
          <small>
            {new Intl.DateTimeFormat("es-CO", {
              timeStyle: "short",
              timeZone: "America/Bogota",
            }).format(new Date(system.checkedAt))}
          </small>
        </article>
        <article className={system.jobs.status === "attention" ? "status-attention" : undefined}>
          <Queue aria-hidden="true" size={22} weight="fill" />
          <div>
            <span>Trabajos automáticos</span>
            <strong>
              {system.jobs.status === "attention" ? "Requieren atención" : "Operativos"}
            </strong>
          </div>
          <small>{jobStatusDetail(system.jobs)}</small>
        </article>
      </section>

      <div className="dashboard-columns">
        <section className="dashboard-card tenant-card" id="empresas">
          <div className="card-heading">
            <div>
              <span className="panel-eyebrow">Directorio</span>
              <h2>Empresas</h2>
            </div>
            <span>
              {directory.pagination.total}{" "}
              {directory.pagination.total === 1 ? "registro" : "registros"}
            </span>
          </div>
          <p className="operational-note">
            Activar habilita el espacio de trabajo. No aprueba créditos ni movimientos de dinero.
          </p>
          <form className="tenant-directory-filters" action="/panel/desarrollador#empresas">
            <label>
              <span>Buscar empresa</span>
              <input
                defaultValue={search}
                maxLength={80}
                name="q"
                placeholder="Nombre o identificador"
                type="search"
              />
            </label>
            <label>
              <span>Estado</span>
              <select defaultValue={status ?? ""} name="estado">
                <option value="">Todos</option>
                <option value="draft">Borrador</option>
                <option value="active">Activa</option>
                <option value="suspended">Suspendida</option>
                <option value="archived">Archivada</option>
              </select>
            </label>
            <div className="tenant-directory-filter-actions">
              <button type="submit">Filtrar</button>
              {search || status ? <a href="/panel/desarrollador#empresas">Limpiar</a> : null}
            </div>
          </form>
          {directory.tenants.length ? (
            <div className="tenant-table-wrap">
              <table className="tenant-table">
                <thead>
                  <tr>
                    <th>Empresa</th>
                    <th>Estado</th>
                    <th>Plan</th>
                    <th>Miembros</th>
                    <th>Preparación</th>
                    <th>Soporte</th>
                    <th>Creada</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {directory.tenants.map((tenant) => (
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
                      <td data-label="Plan">
                        <TenantMembershipPlanControl
                          membershipEntitlement={tenant.membershipEntitlement}
                          membershipPlan={tenant.membershipPlan}
                          tenantId={tenant.id}
                        />
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
              <h3>{search || status ? "No encontramos empresas" : "Aún no hay empresas"}</h3>
              <p>
                {search || status
                  ? "Prueba con otro nombre o cambia el estado seleccionado."
                  : "Crea el primer espacio. Quedará en borrador hasta completar su configuración."}
              </p>
            </div>
          )}
          {directory.pagination.totalPages > 1 ? (
            <nav className="tenant-directory-pagination" aria-label="Páginas del directorio">
              {directory.pagination.page > 1 ? (
                <a href={directoryHref(directory.pagination.page - 1, search, status)}>Anterior</a>
              ) : (
                <span aria-disabled="true">Anterior</span>
              )}
              <strong>
                Página {directory.pagination.page} de {directory.pagination.totalPages}
              </strong>
              {directory.pagination.page < directory.pagination.totalPages ? (
                <a href={directoryHref(directory.pagination.page + 1, search, status)}>Siguiente</a>
              ) : (
                <span aria-disabled="true">Siguiente</span>
              )}
            </nav>
          ) : null}
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

      <section className="dashboard-card activity-card user-directory-card" id="usuarios">
        <div className="card-heading">
          <div>
            <span className="panel-eyebrow">Identidades</span>
            <h2>Usuarios de la plataforma</h2>
          </div>
          <span>
            {userDirectory.pagination.total}{" "}
            {userDirectory.pagination.total === 1 ? "registro" : "registros"}
          </span>
        </div>
        <p className="operational-note">
          Deshabilitar bloquea el ingreso y cierra todas las sesiones activas. No elimina el
          historial ni las membresías empresariales.
        </p>
        <form className="tenant-directory-filters" action="/panel/desarrollador#usuarios">
          <label>
            <span>Buscar usuario</span>
            <input
              defaultValue={userSearch}
              maxLength={80}
              name="usuario"
              placeholder="Nombre, usuario o correo"
              type="search"
            />
          </label>
          <label>
            <span>Estado</span>
            <select defaultValue={userStatus ?? ""} name="estadoUsuario">
              <option value="">Todos</option>
              <option value="active">Activo</option>
              <option value="disabled">Deshabilitado</option>
            </select>
          </label>
          <div className="tenant-directory-filter-actions">
            <button type="submit">Filtrar</button>
            {userSearch || userStatus ? <a href="/panel/desarrollador#usuarios">Limpiar</a> : null}
          </div>
        </form>
        {userDirectory.users.length ? (
          <div className="tenant-table-wrap">
            <table className="tenant-table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Estado</th>
                  <th>Membresías</th>
                  <th>Sesiones</th>
                  <th>Última actividad</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {userDirectory.users.map((user) => (
                  <tr key={user.id}>
                    <td data-label="Usuario">
                      <strong>{user.displayName}</strong>
                      <small>
                        @{user.username} · {user.email}
                      </small>
                    </td>
                    <td data-label="Estado">
                      <span
                        className={`status status-${user.status === "active" ? "active" : "archived"}`}
                      >
                        {user.status === "active" ? "Activo" : "Deshabilitado"}
                      </span>
                    </td>
                    <td data-label="Membresías">{user.activeMemberships}</td>
                    <td data-label="Sesiones">{user.activeSessions}</td>
                    <td data-label="Última actividad">
                      {user.lastSeenAt
                        ? new Intl.DateTimeFormat("es-CO", {
                            dateStyle: "medium",
                            timeStyle: "short",
                            timeZone: "America/Bogota",
                          }).format(new Date(user.lastSeenAt))
                        : "Nunca"}
                    </td>
                    <td data-label="Acción">
                      {user.platformRole === "developer" ? (
                        <span className="table-muted">Cuenta protegida</span>
                      ) : (
                        <UserStatusControl status={user.status} userId={user.id} />
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
            <h3>No encontramos usuarios</h3>
            <p>Prueba con otro nombre, usuario, correo o estado.</p>
          </div>
        )}
        {userDirectory.pagination.totalPages > 1 ? (
          <nav className="tenant-directory-pagination" aria-label="Páginas de usuarios">
            {userDirectory.pagination.page > 1 ? (
              <a
                href={userDirectoryHref(userDirectory.pagination.page - 1, userSearch, userStatus)}
              >
                Anterior
              </a>
            ) : (
              <span aria-disabled="true">Anterior</span>
            )}
            <strong>
              Página {userDirectory.pagination.page} de {userDirectory.pagination.totalPages}
            </strong>
            {userDirectory.pagination.page < userDirectory.pagination.totalPages ? (
              <a
                href={userDirectoryHref(userDirectory.pagination.page + 1, userSearch, userStatus)}
              >
                Siguiente
              </a>
            ) : (
              <span aria-disabled="true">Siguiente</span>
            )}
          </nav>
        ) : null}
      </section>

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
