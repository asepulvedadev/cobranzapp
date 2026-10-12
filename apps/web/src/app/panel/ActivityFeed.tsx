import type { AuditActivity } from "../../lib/platform";

const actionLabels: Record<string, string> = {
  "tenant.created": "Creó la empresa",
  "tenant.membership_plan_changed": "Cambió el plan comercial",
  "tenant.membership_capacity_changed": "Actualizó la capacidad de empleados",
  "tenant.status_changed": "Cambió el estado de la empresa",
  "user.status_changed": "Cambió el acceso de un usuario",
  "invitation.created": "Creó una invitación",
  "invitation.accepted": "Aceptó una invitación",
  "invitation.revoked": "Revocó una invitación",
  "tenant.settings_updated": "Actualizó la configuración",
  "branch.created": "Creó una sede",
  "branch.status_changed": "Cambió el estado de una sede",
  "team.created": "Creó un equipo",
  "team.status_changed": "Cambió el estado de un equipo",
  "team.member_assigned": "Asignó un integrante a un equipo",
  "team.member_removed": "Retiró un integrante de un equipo",
  "membership.updated": "Actualizó el acceso de un integrante",
  "auth.reauthenticated": "Confirmó su identidad",
  "auth.login_succeeded": "Inició sesión",
  "auth.logged_out": "Cerró sesión",
  "auth.password_changed": "Cambió su contraseña",
  "auth.session_revoked": "Cerró una sesión remota",
  "auth.other_sessions_revoked": "Cerró sus demás sesiones",
  "auth.mfa_setup_started": "Inició la configuración de seguridad",
  "auth.mfa_enabled": "Activó la verificación en dos pasos",
  "auth.mfa_disabled": "Desactivó la verificación en dos pasos",
  "auth.mfa_challenge_created": "Solicitó el segundo factor",
  "auth.mfa_login_succeeded": "Ingresó con segundo factor",
  "auth.mfa_login_failed": "Falló la verificación del segundo factor",
  "auth.mfa_login_locked": "Bloqueó la verificación por intentos fallidos",
  "support_access.requested": "Solicitó acceso temporal de soporte",
  "support_access.approved": "Autorizó acceso temporal de soporte",
  "support_access.denied": "Rechazó acceso temporal de soporte",
  "support_access.revoked": "Revocó acceso temporal de soporte",
  "support_access.cancelled": "Canceló una solicitud de soporte",
  "support_access.expired": "Venció el acceso temporal de soporte",
};

export function activityActionLabel(action: string) {
  return actionLabels[action] ?? action;
}

type ActivityItem = AuditActivity & { tenantName?: string | null };

export function ActivityFeed({ activity }: { activity: ActivityItem[] }) {
  if (!activity.length) {
    return (
      <div className="empty-state compact-empty-state">
        <span aria-hidden="true">◇</span>
        <h3>Aún no hay actividad</h3>
        <p>Las acciones administrativas aparecerán aquí.</p>
      </div>
    );
  }

  return (
    <ol className="audit-feed">
      {activity.map((event) => {
        const actor = event.actorDisplayName ?? "Sistema";
        return (
          <li key={event.id}>
            <span className="audit-avatar" aria-hidden="true">
              {actor.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <p>
                <strong>{actor}</strong> {actionLabels[event.action] ?? "Registró una acción"}
              </p>
              <small>
                {event.actorUsername ? `@${event.actorUsername}` : "Acción automática"}
                {event.tenantName ? ` · ${event.tenantName}` : ""}
              </small>
            </div>
            <time dateTime={event.happenedAt}>
              {new Intl.DateTimeFormat("es-CO", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(event.happenedAt))}
            </time>
          </li>
        );
      })}
    </ol>
  );
}
