import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { AccountSession, SecurityActivity } from "../../../lib/platform";
import { serverApi } from "../../../lib/server-api";
import { PasswordForm } from "./PasswordForm";
import { SecurityActivityList } from "./SecurityActivityList";
import { SessionManager } from "./SessionManager";

export const metadata: Metadata = { title: "Seguridad" };

export default async function SecurityPage() {
  const [sessionsResponse, activityResponse] = await Promise.all([
    serverApi("/v1/auth/sessions"),
    serverApi("/v1/auth/security-activity"),
  ]);
  if (sessionsResponse.status === 401 || activityResponse.status === 401) redirect("/ingresar");
  if (!sessionsResponse.ok) throw new Error("No fue posible cargar las sesiones activas");
  if (!activityResponse.ok) throw new Error("No fue posible cargar la actividad de seguridad");
  const { sessions } = (await sessionsResponse.json()) as { sessions: AccountSession[] };
  const { activity } = (await activityResponse.json()) as { activity: SecurityActivity[] };

  return (
    <div className="dashboard-page narrow-page">
      <header className="dashboard-header">
        <div>
          <span className="panel-eyebrow">Cuenta</span>
          <h1>Seguridad</h1>
          <p>Controla tu contraseña y los dispositivos que mantienen acceso a tu cuenta.</p>
        </div>
      </header>
      <div className="security-stack">
        <section className="dashboard-card security-card">
          <div className="card-heading">
            <div>
              <span className="panel-eyebrow">Dispositivos</span>
              <h2>Sesiones activas</h2>
            </div>
          </div>
          <p className="security-card-copy">
            Cierra cualquier sesión que no reconozcas. La sesión actual permanece protegida.
          </p>
          <SessionManager initialSessions={sessions} />
        </section>
        <section className="dashboard-card security-card">
          <div className="card-heading">
            <div>
              <span className="panel-eyebrow">Credenciales</span>
              <h2>Cambiar contraseña</h2>
            </div>
          </div>
          <PasswordForm />
        </section>
        <section className="dashboard-card security-card">
          <div className="card-heading">
            <div>
              <span className="panel-eyebrow">Trazabilidad</span>
              <h2>Actividad de seguridad</h2>
            </div>
          </div>
          <SecurityActivityList activity={activity} />
        </section>
      </div>
    </div>
  );
}
