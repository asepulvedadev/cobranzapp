import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { AccountSession } from "../../../lib/platform";
import { serverApi } from "../../../lib/server-api";
import { PasswordForm } from "./PasswordForm";
import { SessionManager } from "./SessionManager";

export const metadata: Metadata = { title: "Seguridad" };

export default async function SecurityPage() {
  const response = await serverApi("/v1/auth/sessions");
  if (response.status === 401) redirect("/ingresar");
  if (!response.ok) throw new Error("No fue posible cargar las sesiones activas");
  const { sessions } = (await response.json()) as { sessions: AccountSession[] };

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
      </div>
    </div>
  );
}
