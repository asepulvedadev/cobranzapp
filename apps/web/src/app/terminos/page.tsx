import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "../../components/SiteFooter";
import { SiteHeader } from "../../components/SiteHeader";

export const metadata: Metadata = {
  title: "Términos de uso",
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <>
      <SiteHeader />
      <main className="page-main" id="contenido">
        <header className="page-hero section-shell">
          <div className="breadcrumb">
            <Link href="/">Inicio</Link>
            <span>/</span>
            <span>Términos</span>
          </div>
          <span className="eyebrow">Información legal preliminar</span>
          <h1>Términos de uso</h1>
          <p>Última actualización: 11 de octubre de 2026.</p>
        </header>
        <article className="legal-shell section-shell">
          <section>
            <h2>Alcance</h2>
            <p>
              Este sitio presenta un producto de software en desarrollo. La información publicada no
              constituye una oferta financiera, asesoría jurídica ni aprobación de crédito.
            </p>
          </section>
          <section>
            <h2>Naturaleza del servicio</h2>
            <p>
              cobranzapp no presta dinero, no recibe pagos de obligaciones y no actúa como entidad
              financiera. La plataforma se diseña para ayudar a terceros a organizar operaciones de
              cartera y cobranza.
            </p>
          </section>
          <section>
            <h2>Disponibilidad</h2>
            <p>
              Las funciones descritas representan el alcance previsto y pueden cambiar durante la
              validación. El acceso privado todavía no está disponible para uso productivo.
            </p>
          </section>
          <section>
            <h2>Contacto</h2>
            <p>
              Las consultas sobre estos términos pueden enviarse a{" "}
              <a href="mailto:info@cobranzaap.tech">info@cobranzaap.tech</a>.
            </p>
          </section>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
