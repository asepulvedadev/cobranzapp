import type { SecurityActivity } from "../../../lib/platform";

const labels: Record<string, string> = {
  "auth.login_succeeded": "Inicio de sesión correcto",
  "auth.logged_out": "Cierre de sesión",
  "auth.password_changed": "Cambio de contraseña",
  "auth.reauthenticated": "Confirmación de identidad",
  "auth.session_revoked": "Cierre de una sesión remota",
  "auth.other_sessions_revoked": "Cierre de las demás sesiones",
  "auth.mfa_setup_started": "Inicio de configuración de seguridad",
  "auth.mfa_enabled": "Activación de la verificación en dos pasos",
  "auth.mfa_disabled": "Desactivación de la verificación en dos pasos",
  "auth.mfa_challenge_created": "Solicitud de segundo factor",
  "auth.mfa_login_succeeded": "Ingreso con segundo factor",
  "auth.mfa_login_failed": "Código de segundo factor rechazado",
  "auth.mfa_login_locked": "Verificación bloqueada por intentos fallidos",
};

export function SecurityActivityList({ activity }: { activity: SecurityActivity[] }) {
  if (!activity.length) {
    return <p className="security-activity-empty">Aún no hay actividad registrada.</p>;
  }

  return (
    <ol className="security-activity-list">
      {activity.map((event) => (
        <li key={event.id}>
          <i aria-hidden="true" />
          <span>
            <strong>{labels[event.action] ?? "Acción de seguridad"}</strong>
            <time dateTime={event.happenedAt}>
              {new Intl.DateTimeFormat("es-CO", {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "America/Bogota",
              }).format(new Date(event.happenedAt))}
            </time>
          </span>
        </li>
      ))}
    </ol>
  );
}
