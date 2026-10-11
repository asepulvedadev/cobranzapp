import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "../../components/Brand";
import { SiteFooter } from "../../components/SiteFooter";

export const metadata: Metadata = {
  title: "Ingreso al sistema",
  description:
    "Acceso privado de cobranzapp para propietarios, supervisores, cobradores y clientes.",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <>
      <main className="page-main section-shell" id="contenido">
        <div className="breadcrumb page-hero">
          <Link href="/">Inicio</Link>
          <span>/</span>
          <span>Ingresar</span>
        </div>
        <section className="login-panel">
          <div className="login-copy">
            <Brand light />
            <span className="eyebrow">Sistema privado</span>
            <h1>La operación vive aquí. La landing permanece aparte.</h1>
            <p>
              El acceso todavía no está habilitado. Estamos preparando la autenticación y los
              permisos antes de abrir datos operativos.
            </p>
            <a
              className="button"
              href="mailto:info@cobranzaap.tech?subject=Acceso%20anticipado%20a%20cobranzapp"
            >
              Solicitar acceso anticipado
            </a>
          </div>
          <div className="login-preview">
            <div className="access-card">
              <span>Acceso por perfil</span>
              <h2>Un espacio distinto para cada responsabilidad.</h2>
              <ul>
                <li>Propietario</li>
                <li>Supervisor</li>
                <li>Cobrador</li>
                <li>Cliente</li>
              </ul>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
