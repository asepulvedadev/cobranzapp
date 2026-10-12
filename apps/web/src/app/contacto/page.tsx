import type { Metadata } from "next";
import Link from "next/link";
import { ContactForm } from "../../components/ContactForm";
import { SiteFooter } from "../../components/SiteFooter";
import { SiteHeader } from "../../components/SiteHeader";

export const metadata: Metadata = {
  title: "Contacto",
  description:
    "Conversa con el equipo de cobranzapp sobre tu operación de cartera y cobranza en Colombia.",
  alternates: { canonical: "/contacto" },
};

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; source?: string }>;
}) {
  const query = await searchParams;
  const plan = query.plan === "Pro" || query.plan === "Ultra" ? query.plan : undefined;
  const sources = [
    "contacto",
    "demo",
    "planes",
    "producto",
    "nosotros",
    "blog",
    "soporte",
    "inicio",
  ];
  const source = query.source && sources.includes(query.source) ? query.source : "contacto";
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
            <span className="eyebrow">Hablemos, sin vueltas</span>
            <h1>Te llamamos. Así de simple.</h1>
            <p className="contact-intro">
              Déjanos tu nombre y teléfono. Nuestro equipo se comunica contigo.
            </p>
          </div>
          <div className="contact-card">
            <span>Contacto rápido</span>
            <h2>
              Solo dos datos.
              <br />
              El resto lo conversamos.
            </h2>
            <ContactForm plan={plan} source={source} />
            <small>Cúcuta, Norte de Santander, Colombia</small>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
