import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { AccountSession, MfaStatus, SecurityActivity } from "../../../lib/platform";
import { serverApi } from "../../../lib/server-api";
import { MfaSettings } from "./MfaSettings";
import { PasswordForm } from "./PasswordForm";
import { SecurityActivityList } from "./SecurityActivityList";
import { SessionManager } from "./SessionManager";

export const metadata: Metadata = { title: "Seguridad" };

export default async function SecurityPage() {
  const [sessionsResponse, activityResponse, mfaResponse] = await Promise.all([
    serverApi("/v1/auth/sessions"),
    serverApi("/v1/auth/security-activity"),
    serverApi("/v1/auth/mfa"),
  ]);
  if (
    [sessionsResponse, activityResponse, mfaResponse].some((response) => response.status === 401)
  ) {
    redirect("/ingresar");
  }
  if (!sessionsResponse.ok) throw new Error("No fue posible cargar las sesiones activas");
  if (!activityResponse.ok) throw new Error("No fue posible cargar la actividad de seguridad");
  if (!mfaResponse.ok) throw new Error("No fue posible cargar la verificación en dos pasos");
  const { sessions } = (await sessionsResponse.json()) as { sessions: AccountSession[] };
  const { activity } = (await activityResponse.json()) as { activity: SecurityActivity[] };
  const { mfa } = (await mfaResponse.json()) as { mfa: MfaStatus };

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
              <span className="panel-eyebrow">Segundo factor</span>
              <h2>Verificación en dos pasos</h2>
            </div>
          </div>
          <MfaSettings initialStatus={mfa} />
        </section>
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
