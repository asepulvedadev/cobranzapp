import type { TenantMemberProfile, TenantOverview } from "../../../../lib/platform";

const roleLabels: Record<TenantOverview["members"][number]["role"], string> = {
  owner: "Propietario",
  supervisor: "Supervisor",
  collector: "Cobrador",
  customer: "Cliente",
};

const statusLabels: Record<TenantOverview["members"][number]["status"], string> = {
  invited: "Invitación pendiente",
  active: "Activo",
  suspended: "Suspendido",
  revoked: "Revocado",
};

const statusClasses: Record<TenantOverview["members"][number]["status"], string> = {
  invited: "draft",
  active: "active",
  suspended: "suspended",
  revoked: "archived",
};

export function MemberProfileDirectory({
  members,
  profiles,
}: {
  members: TenantOverview["members"];
  profiles: TenantMemberProfile[];
}) {
  const profileByUserId = new Map(profiles.map((profile) => [profile.userId, profile]));
  const operationalMembers = members.filter((member) =>
    ["owner", "supervisor", "collector"].includes(member.role),
  );

  return (
    <section className="dashboard-card member-profile-directory" id="fichas-equipo">
      <div className="card-heading">
        <div>
          <span className="panel-eyebrow">Equipo operativo</span>
          <h2>Fichas del personal</h2>
        </div>
        <span>{operationalMembers.length} personas</span>
      </div>
      <p className="operational-note">
        Solo propietario y supervisor pueden consultar estas fichas. El tipo de sangre aparece
        únicamente cuando la persona autorizó guardarlo.
      </p>
      <div className="member-profile-directory-grid">
        {operationalMembers.map((member) => {
          const profile = profileByUserId.get(member.userId);
          return (
            <article className="member-profile-summary" key={member.userId}>
              <div className="member-profile-summary-heading">
                <div>
                  <strong>{member.displayName}</strong>
                  <small>{roleLabels[member.role]}</small>
                </div>
                <span className={`status status-${statusClasses[member.status]}`}>
                  {statusLabels[member.status]}
                </span>
              </div>
              {profile ? (
                <dl>
                  <div>
                    <dt>Documento</dt>
                    <dd>
                      {profile.documentType && profile.documentLast4
                        ? `${profile.documentType} · •••• ${profile.documentLast4}`
                        : "Pendiente de registro"}
                    </dd>
                  </div>
                  <div>
                    <dt>Estado del documento</dt>
                    <dd>
                      {profile.documentVerificationState === "reviewed"
                        ? "Revisado"
                        : profile.documentVerificationState === "rejected"
                          ? "Rechazado"
                          : "Pendiente de revisión"}
                    </dd>
                  </div>
                  <div>
                    <dt>Celular</dt>
                    <dd>{profile.phone ?? "Sin registrar"}</dd>
                  </div>
                  <div>
                    <dt>Casa</dt>
                    <dd>{profile.homeAddress ?? "Sin registrar"}</dd>
                  </div>
                  <div>
                    <dt>Trabajo</dt>
                    <dd>{profile.workAddress ?? "Sin registrar"}</dd>
                  </div>
                  <div>
                    <dt>Tipo de sangre</dt>
                    <dd>
                      {profile.bloodType && profile.bloodTypeConsentVersion
                        ? profile.bloodType
                        : "No autorizado"}
                    </dd>
                  </div>
                  <div>
                    <dt>Emergencias</dt>
                    <dd>{profile.emergencyContacts.length} contacto(s)</dd>
                  </div>
                  <div>
                    <dt>Foto</dt>
                    <dd>{profile.profilePhotoObjectKey ? "Privada registrada" : "Pendiente"}</dd>
                  </div>
                </dl>
              ) : (
                <p className="structure-empty">La persona aún no completa su ficha.</p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
