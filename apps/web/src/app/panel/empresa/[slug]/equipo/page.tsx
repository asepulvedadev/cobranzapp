import type { Metadata } from "next";
import type { CSSProperties } from "react";
import type { TenantMemberProfile } from "../../../../../lib/platform";
import { serverApi } from "../../../../../lib/server-api";
import { CreateMemberModal } from "../CreateMemberModal";
import { MemberAccessControl } from "../MemberAccessControl";
import { MemberProfileDirectory } from "../MemberProfileDirectory";
import { loadTenantContext } from "../tenant-context";

export const metadata: Metadata = { title: "Personal" };

const roleLabels = {
  owner: "Propietario",
  supervisor: "Supervisor",
  collector: "Cobrador",
  customer: "Cliente",
} as const;

const statusLabels = {
  invited: "Invitación pendiente",
  active: "Activo",
  suspended: "Suspendido",
  revoked: "Revocado",
} as const;

const statusClasses = {
  invited: "draft",
  active: "active",
  suspended: "suspended",
  revoked: "archived",
} as const;

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { user, overview } = await loadTenantContext(slug);
  const canManage = overview.actorRole === "owner" || overview.actorRole === "supervisor";
  const profiles = canManage
    ? (
        await Promise.all(
          overview.members
            .filter((member) => ["owner", "supervisor", "collector"].includes(member.role))
            .map(async (member) => {
              const response = await serverApi(
                `/v1/tenants/${overview.tenant.id}/members/${member.userId}/profile`,
              );
              if (!response.ok) return null;
              const body = (await response.json()) as { profile: TenantMemberProfile };
              return body.profile;
            }),
        )
      ).filter((profile): profile is TenantMemberProfile => profile !== null)
    : [];
  const brandStyle = {
    "--tenant-brand-primary": overview.settings.primaryColor,
    "--tenant-brand-accent": overview.settings.accentColor,
  } as CSSProperties;

  return (
    <div className="dashboard-page tenant-subpage" style={brandStyle}>
      <header className="dashboard-header">
        <div>
          <span className="panel-eyebrow">{overview.tenant.displayName}</span>
          <h1>Personal de la empresa</h1>
          <p>Administra empleados, roles y datos operativos desde una vista independiente.</p>
        </div>
      </header>
      <div className="dashboard-columns">
        <section className="dashboard-card tenant-card">
          <div className="card-heading">
            <div>
              <span className="panel-eyebrow">Accesos</span>
              <h2>{overview.members.length} integrantes</h2>
            </div>
          </div>
          {canManage ? (
            <div className="tenant-table-wrap">
              <table className="tenant-table">
                <thead>
                  <tr>
                    <th>Persona</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th>Administrar</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.members.map((member) => (
                    <tr key={member.userId}>
                      <td data-label="Persona">
                        <strong>{member.displayName}</strong>
                        <small>{member.phone ?? "Sin teléfono registrado"}</small>
                      </td>
                      <td data-label="Rol">{roleLabels[member.role]}</td>
                      <td data-label="Estado">
                        <span className={`status status-${statusClasses[member.status]}`}>
                          {statusLabels[member.status]}
                        </span>
                      </td>
                      <td data-label="Administrar">
                        {member.userId === user.id ? (
                          "Tu acceso"
                        ) : (
                          <MemberAccessControl member={member} tenantId={overview.tenant.id} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="operational-note">Tu rol no permite administrar el directorio.</p>
          )}
        </section>
        {overview.actorRole === "owner" ? (
          <aside className="dashboard-card create-card">
            <div className="card-heading">
              <div>
                <span className="panel-eyebrow">Personal</span>
                <h2>Crear empleado</h2>
              </div>
            </div>
            <p>Registra el acceso directamente. No se envían invitaciones ni se requiere correo.</p>
            <CreateMemberModal
              availableSeats={overview.membershipEntitlement?.availableEmployeeSeats ?? null}
              tenantId={overview.tenant.id}
            />
          </aside>
        ) : null}
      </div>
      {canManage ? <MemberProfileDirectory members={overview.members} profiles={profiles} /> : null}
    </div>
  );
}
