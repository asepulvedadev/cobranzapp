import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { CSSProperties } from "react";
import type {
  BorrowerDirectory,
  CurrentUser,
  LoanApplication,
  LoanProduct,
  Route,
  SupportAccessRecord,
  TenantMemberProfile,
  TenantOverview,
} from "../../../../lib/platform";
import { serverApi } from "../../../../lib/server-api";
import { ActivityFeed } from "../../ActivityFeed";
import { BorrowerDirectory as BorrowerDirectoryView } from "./BorrowerDirectory";
import { CollectionRouteBoard } from "./CollectionRouteBoard";
import { CreditProductCatalog } from "./CreditProductCatalog";
import { CustomerWorkspace } from "./CustomerWorkspace";
import { LoanApplicationBoard } from "./LoanApplicationBoard";
import { MemberAccessControl } from "./MemberAccessControl";
import { MemberProfileDirectory } from "./MemberProfileDirectory";
import { MemberProfileForm } from "./MemberProfileForm";
import { OrganizationStatusButton } from "./OrganizationStatusButton";
import { SettingsVersionHistory } from "./SettingsVersionHistory";
import { SupportAccessReview } from "./SupportAccessReview";
import { TeamAssignmentManager } from "./TeamAssignmentManager";
import { VerificationNetworkPanel } from "./VerificationNetworkPanel";
import { WorkspaceMembershipSummary } from "./WorkspaceMembershipSummary";
import { CreateBranchForm, CreateTeamForm, WorkspaceSettingsForm } from "./WorkspaceOperations";

export const metadata: Metadata = { title: "Espacio empresarial" };

const roleLabels = {
  owner: "Propietario",
  supervisor: "Supervisor",
  collector: "Cobrador",
  customer: "Cliente",
  support: "Soporte temporal",
};

const statusLabels = {
  draft: "Configuración",
  active: "Activa",
  suspended: "Suspendida",
  archived: "Archivada",
};

const memberStatusLabels = {
  invited: "Invitado",
  active: "Activo",
  suspended: "Suspendido",
  revoked: "Revocado",
};

const memberStatusClasses = {
  invited: "draft",
  active: "active",
  suspended: "suspended",
  revoked: "archived",
};

function firstQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function TenantDashboard({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ cliente?: string | string[]; paginaCliente?: string | string[] }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const borrowerSearch = (firstQueryValue(query.cliente) ?? "").trim().slice(0, 80);
  const requestedBorrowerPage = Number(firstQueryValue(query.paginaCliente));
  const borrowerPage =
    Number.isInteger(requestedBorrowerPage) && requestedBorrowerPage > 0
      ? requestedBorrowerPage
      : 1;
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
  let memberProfile: TenantMemberProfile | null = null;
  let memberProfiles: TenantMemberProfile[] = [];
  let loanProducts: LoanProduct[] | null = null;
  let loanApplications: LoanApplication[] | null = null;
  let borrowerDirectory: BorrowerDirectory | null = null;
  let routes: Route[] | null = null;
  if (overview.actorRole !== "customer" && overview.actorRole !== "support") {
    const profileResponse = await serverApi(
      `/v1/tenants/${membership.tenantId}/members/${user.id}/profile`,
    );
    if (!profileResponse.ok) throw new Error("No fue posible cargar tu ficha operativa");
    ({ profile: memberProfile } = (await profileResponse.json()) as {
      profile: TenantMemberProfile;
    });
    const borrowerQuery = new URLSearchParams({ page: String(borrowerPage), pageSize: "20" });
    if (borrowerSearch) borrowerQuery.set("q", borrowerSearch);
    const borrowersResponse = await serverApi(
      `/v1/tenants/${membership.tenantId}/borrowers?${borrowerQuery}`,
    );
    if (borrowersResponse.ok) {
      borrowerDirectory = (await borrowersResponse.json()) as BorrowerDirectory;
    }
    if (canSeeTeam) {
      const profileResponses = await Promise.all(
        overview.members
          .filter((member) => ["owner", "supervisor", "collector"].includes(member.role))
          .map((member) =>
            serverApi(`/v1/tenants/${membership.tenantId}/members/${member.userId}/profile`),
          ),
      );
      memberProfiles = (
        await Promise.all(
          profileResponses.map(async (profileResponse) => {
            if (!profileResponse.ok) return null;
            const body = (await profileResponse.json()) as { profile: TenantMemberProfile };
            return body.profile;
          }),
        )
      ).filter((profile): profile is TenantMemberProfile => profile !== null);
    }
    if (["owner", "supervisor", "collector"].includes(overview.actorRole)) {
      const routesResponse = await serverApi(`/v1/tenants/${membership.tenantId}/routes`);
      if (routesResponse.ok) {
        ({ routes } = (await routesResponse.json()) as { routes: Route[] });
      }
      const productsResponse = await serverApi(`/v1/tenants/${membership.tenantId}/loan-products`);
      if (productsResponse.ok) {
        ({ products: loanProducts } = (await productsResponse.json()) as {
          products: LoanProduct[];
        });
      }
      const applicationsResponse = await serverApi(
        `/v1/tenants/${membership.tenantId}/loan-applications`,
      );
      if (applicationsResponse.ok) {
        ({ applications: loanApplications } = (await applicationsResponse.json()) as {
          applications: LoanApplication[];
        });
      }
    }
  }
  let supportAccess: SupportAccessRecord[] = [];
  if (overview.actorRole === "owner") {
    const supportResponse = await serverApi(`/v1/tenants/${membership.tenantId}/support-access`);
    if (!supportResponse.ok) throw new Error("No fue posible cargar los accesos de soporte");
    ({ access: supportAccess } = (await supportResponse.json()) as {
      access: SupportAccessRecord[];
    });
  }
  const brandStyle = {
    "--tenant-brand-primary": overview.settings.primaryColor,
    "--tenant-brand-accent": overview.settings.accentColor,
  } as CSSProperties;

  if (overview.actorRole === "customer") {
    return <CustomerWorkspace overview={overview} />;
  }

  return (
    <div className="dashboard-page tenant-dashboard" style={brandStyle}>
      <div className="tenant-brand-band" aria-hidden="true" />
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

      {overview.actorRole === "owner" ? <WorkspaceMembershipSummary overview={overview} /> : null}

      {overview.actorRole === "collector" ? (
        <section aria-label="Alcance asignado" className="metric-grid tenant-metrics">
          <article>
            <span>Sedes asignadas</span>
            <strong>{overview.metrics.branches}</strong>
            <small>Solo las vinculadas a tus equipos</small>
          </article>
          <article>
            <span>Equipos asignados</span>
            <strong>{overview.metrics.teams}</strong>
            <small>Alcance operativo vigente</small>
          </article>
          <article>
            <span>Perfil</span>
            <strong>Campo</strong>
            <small>Acceso de cobrador</small>
          </article>
          <article className="metric-accent">
            <span>Aislamiento</span>
            <strong>RLS</strong>
            <small>Sin acceso a la organización completa</small>
          </article>
        </section>
      ) : (
        <section aria-label="Indicadores de la empresa" className="metric-grid tenant-metrics">
          <article>
            <span>Integrantes activos</span>
            <strong>{overview.metrics.members}</strong>
            <small>Accesos vigentes</small>
          </article>
          <article>
            <span>Cupos de empleados</span>
            <strong>{overview.membershipEntitlement?.availableEmployeeSeats ?? "—"}</strong>
            <small>Disponibles según tu plan</small>
          </article>
        </section>
      )}

      {borrowerDirectory ? (
        <section
          aria-label="Estado de clientes y solicitudes"
          className="metric-grid tenant-metrics"
        >
          <article>
            <span>Clientes activos</span>
            <strong>{borrowerDirectory.borrowerSummary.active}</strong>
            <small>Registros disponibles para operación</small>
          </article>
          <article>
            <span>Identidades pendientes</span>
            <strong>{borrowerDirectory.identitySummary.pending}</strong>
            <small>Requieren revisión humana</small>
          </article>
          <article>
            <span>Identidades revisadas</span>
            <strong>{borrowerDirectory.identitySummary.reviewed}</strong>
            <small>Con evidencia documental completa</small>
          </article>
          {loanApplications ? (
            <article className="metric-accent">
              <span>Solicitudes en revisión</span>
              <strong>
                {
                  loanApplications.filter(
                    (application) =>
                      application.status === "submitted" || application.status === "under_review",
                  ).length
                }
              </strong>
              <small>{loanApplications.length} solicitudes registradas</small>
            </article>
          ) : null}
        </section>
      ) : null}

      <div className="dashboard-columns">
        <section className="dashboard-card tenant-card" id="equipo">
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
                    {overview.actorRole === "owner" ? <th>Administrar</th> : null}
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
                        <span className={`status status-${memberStatusClasses[member.status]}`}>
                          {memberStatusLabels[member.status]}
                        </span>
                      </td>
                      {overview.actorRole === "owner" ? (
                        <td data-label="Administrar">
                          {member.userId === user.id ? (
                            <span className="table-muted">Tu acceso</span>
                          ) : (
                            <MemberAccessControl member={member} tenantId={overview.tenant.id} />
                          )}
                        </td>
                      ) : null}
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
                  ? "Crea empleados desde la vista Personal cuando necesites ampliar la operación."
                  : "Tu rol no permite consultar el directorio completo de la empresa."}
              </p>
            </div>
          )}
        </section>

        {overview.actorRole === "owner" ? (
          <aside className="dashboard-card create-card">
            <div className="card-heading">
              <div>
                <span className="panel-eyebrow">Personal</span>
                <h2>Gestiona empleados</h2>
              </div>
            </div>
            <p>Crea accesos directos con usuario, teléfono y contraseña desde la vista Personal.</p>
            <Link
              className="primary-action"
              href={`/panel/empresa/${membership.tenantSlug}/equipo`}
            >
              Abrir Personal
            </Link>
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

      {canSeeTeam ? (
        <MemberProfileDirectory members={overview.members} profiles={memberProfiles} />
      ) : null}

      {loanProducts ? (
        overview.actorRole === "owner" || overview.actorRole === "supervisor" ? (
          <CreditProductCatalog products={loanProducts} tenantId={overview.tenant.id} />
        ) : null
      ) : null}

      {loanProducts && loanApplications && borrowerDirectory ? (
        <LoanApplicationBoard
          applications={loanApplications}
          borrowers={borrowerDirectory.borrowers}
          products={loanProducts}
          tenantId={overview.tenant.id}
          canReview={overview.actorRole === "owner" || overview.actorRole === "supervisor"}
        />
      ) : null}

      {routes && borrowerDirectory ? (
        <CollectionRouteBoard
          branches={overview.branches}
          borrowers={borrowerDirectory.borrowers}
          canManage={overview.actorRole === "owner" || overview.actorRole === "supervisor"}
          collectors={overview.members.filter(
            (member) => member.role === "collector" && member.status === "active",
          )}
          routes={routes}
          tenantId={overview.tenant.id}
        />
      ) : null}

      {borrowerDirectory ? (
        <section className="dashboard-card borrower-directory-card" id="clientes">
          <BorrowerDirectoryView
            canCreate={false}
            canReview={overview.actorRole === "owner" || overview.actorRole === "supervisor"}
            directory={borrowerDirectory}
            search={borrowerSearch}
            tenantSlug={slug}
            tenantId={overview.tenant.id}
          />
        </section>
      ) : (
        <section className="dashboard-card borrower-directory-card" id="clientes">
          <span className="panel-eyebrow">Cartera</span>
          <h2>Clientes</h2>
          <p className="operational-note">
            El módulo de clientes está pendiente de configurar su clave privada de protección.
          </p>
        </section>
      )}

      {overview.actorRole !== "support" ? (
        <VerificationNetworkPanel
          canPublish={overview.actorRole === "owner" || overview.actorRole === "supervisor"}
          tenantId={overview.tenant.id}
        />
      ) : null}

      <section className="workspace-configuration" id="configuracion">
        <div className="dashboard-card settings-card">
          <div className="card-heading">
            <div>
              <span className="panel-eyebrow">Datos operativos</span>
              <h2>Configuración de la empresa</h2>
            </div>
          </div>
          {overview.actorRole === "owner" ? (
            <WorkspaceSettingsForm settings={overview.settings} tenantId={overview.tenant.id} />
          ) : (
            <div className="settings-readonly">
              <p>Solo el propietario puede modificar esta información.</p>
              <dl>
                <div>
                  <dt>Correo</dt>
                  <dd>{overview.settings.contactEmail ?? "Sin registrar"}</dd>
                </div>
                <div>
                  <dt>Teléfono</dt>
                  <dd>{overview.settings.contactPhone ?? "Sin registrar"}</dd>
                </div>
                <div>
                  <dt>Dirección</dt>
                  <dd>{overview.settings.address ?? "Sin registrar"}</dd>
                </div>
              </dl>
            </div>
          )}
          {canSeeTeam ? <SettingsVersionHistory versions={overview.settingsHistory} /> : null}
        </div>

        <div className="dashboard-card structure-card">
          <div className="card-heading">
            <div>
              <span className="panel-eyebrow">Organización</span>
              <h2>Sedes y equipos</h2>
            </div>
          </div>
          <div className="structure-grid">
            <section>
              <h3>Sedes</h3>
              {overview.branches.length ? (
                <div className="structure-list">
                  {overview.branches.map((branch) => (
                    <article className="structure-item" key={branch.id}>
                      <span>
                        <strong>{branch.displayName}</strong>
                        <small>Código: {branch.code}</small>
                      </span>
                      <div className="organization-status-actions">
                        <span className={`status status-${branch.status}`}>
                          {branch.status === "active" ? "Activa" : "Inactiva"}
                        </span>
                        <OrganizationStatusButton
                          kind="branch"
                          name={branch.displayName}
                          resourceId={branch.id}
                          status={branch.status}
                          tenantId={overview.tenant.id}
                        />
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="structure-empty">Aún no hay sedes registradas.</p>
              )}
            </section>
            <section>
              <h3>Equipos</h3>
              {canSeeTeam ? (
                <TeamAssignmentManager
                  key={[
                    ...overview.branches.map((branch) => `${branch.id}:${branch.status}`),
                    ...overview.teams.map((team) => `${team.id}:${team.status}`),
                  ].join("|")}
                  members={overview.members}
                  teams={overview.teams}
                  tenantId={overview.tenant.id}
                />
              ) : overview.teams.length ? (
                <div className="structure-list">
                  {overview.teams.map((team) => (
                    <article className="structure-item" key={team.id}>
                      <span>
                        <strong>{team.displayName}</strong>
                        <small>{team.branchName ?? "Sin sede asignada"}</small>
                      </span>
                      <span className={`status status-${team.status}`}>
                        {team.status === "active" ? "Activo" : "Inactivo"}
                      </span>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="structure-empty">Aún no hay equipos registrados.</p>
              )}
            </section>
          </div>
          {canSeeTeam ? (
            <div className="operations-grid">
              <section>
                <h3>Nueva sede</h3>
                <CreateBranchForm tenantId={overview.tenant.id} />
              </section>
              <section>
                <h3>Nuevo equipo</h3>
                <CreateTeamForm branches={overview.branches} tenantId={overview.tenant.id} />
              </section>
            </div>
          ) : null}
        </div>
      </section>

      {canSeeTeam ? (
        <section className="dashboard-card activity-card">
          <div className="card-heading">
            <div>
              <span className="panel-eyebrow">Trazabilidad</span>
              <h2>Actividad reciente</h2>
            </div>
          </div>
          <ActivityFeed activity={overview.activity} />
        </section>
      ) : null}

      {overview.actorRole === "owner" ? (
        <section className="dashboard-card activity-card" id="soporte">
          <div className="card-heading">
            <div>
              <span className="panel-eyebrow">Privacidad</span>
              <h2>Acceso temporal de soporte</h2>
            </div>
          </div>
          <p className="operational-note support-access-note">
            Cada solicitud indica un motivo y una duración. Puedes rechazarla o revocarla en
            cualquier momento.
          </p>
          <SupportAccessReview access={supportAccess} tenantId={overview.tenant.id} />
        </section>
      ) : null}

      {memberProfile ? (
        <section className="dashboard-card activity-card" id="mi-ficha">
          <div className="card-heading">
            <div>
              <span className="panel-eyebrow">Información del equipo</span>
              <h2>Mi ficha operativa</h2>
            </div>
          </div>
          <MemberProfileForm profile={memberProfile} tenantId={overview.tenant.id} />
        </section>
      ) : null}

      <section className="dashboard-card activity-card">
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
