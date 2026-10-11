import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "../../components/SiteFooter";
import { SiteHeader } from "../../components/SiteHeader";

export const metadata: Metadata = {
  title: "Contacto",
  description:
    "Conversa con el equipo de cobranzapp sobre tu operación de cartera y cobranza en Colombia.",
  alternates: { canonical: "/contacto" },
};

export default function ContactPage() {
  return (
    <>
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>
      <SiteHeader />
      <main className="page-main" id="contenido">
        <section className="contact-layout section-shell">
          <div>
            <div className="breadcrumb">
              <Link href="/">Inicio</Link>
              <span>/</span>
              <span>Contacto</span>
            </div>
            <span className="eyebrow">Hablemos de la operación</span>
            <h1>Cuéntanos qué necesitas controlar, no qué pantalla quieres comprar.</h1>
          </div>
          <div className="contact-card">
            <span>Correo de contacto</span>
            <a href="mailto:info@cobranzaap.tech">info@cobranzaap.tech</a>
            <p>
              Para preparar una conversación útil, incluye el tamaño aproximado de tu cartera, los
              perfiles de tu equipo y cómo realizas hoy el cierre diario.
            </p>
            <a
              className="button"
              href="mailto:info@cobranzaap.tech?subject=Demostración%20de%20cobranzapp&body=Empresa:%0AOperación%20actual:%0ANúmero%20de%20personas:%0APrincipal%20problema:%0A"
            >
              Preparar mi solicitud
            </a>
            <small>Cúcuta, Norte de Santander, Colombia</small>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
