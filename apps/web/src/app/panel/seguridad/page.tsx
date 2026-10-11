import type { Metadata } from "next";
import { PasswordForm } from "./PasswordForm";

export const metadata: Metadata = { title: "Seguridad" };

export default function SecurityPage() {
  return (
    <div className="dashboard-page narrow-page">
      <header className="dashboard-header">
        <div>
          <span className="panel-eyebrow">Cuenta</span>
          <h1>Seguridad</h1>
          <p>Actualiza tu contraseña. Las sesiones abiertas se cerrarán automáticamente.</p>
        </div>
      </header>
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
  );
}
