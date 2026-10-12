import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "../../components/Brand";
import { LoginForm } from "./LoginForm";
import "./login.css";

export const metadata: Metadata = {
  title: "Ingresar",
  description: "Acceso seguro a la plataforma cobranzapp.",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <main className="login-page" id="contenido">
      <section className="login-stage" aria-labelledby="login-heading">
        <div className="login-form-shell">
          <div className="login-mobile-brand">
            <Brand />
          </div>
          <div className="login-heading">
            <span>Acceso</span>
            <h1 id="login-heading">Ingresa a cobranzapp</h1>
            <p>Usa tu nombre de usuario o correo electrónico.</p>
          </div>
          <LoginForm />
          <div className="login-support">
            <p>¿Tienes problemas para ingresar?</p>
            <a href="/contacto?source=soporte">info@cobranzaap.tech</a>
          </div>
          <Link className="login-back" href="/">
            ← Volver al sitio público
          </Link>
        </div>
        <div className="login-context">
          <Brand light />
          <div>
            <span className="login-kicker">Plataforma privada</span>
            <h2>Control operativo, sin perder el contexto.</h2>
            <p>
              Ingresa a tu espacio de trabajo con el usuario o correo asignado. Cada empresa
              conserva sus datos y permisos por separado.
            </p>
          </div>
          <div className="login-assurance">
            <span aria-hidden="true">✓</span>
            <p>
              Sesión protegida y trazabilidad de acceso.
              <small>Nunca compartas tu contraseña.</small>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
