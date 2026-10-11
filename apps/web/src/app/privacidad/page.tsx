import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "../../components/SiteFooter";
import { SiteHeader } from "../../components/SiteHeader";

export const metadata: Metadata = {
  title: "Política de privacidad",
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className="page-main" id="contenido">
        <header className="page-hero section-shell">
          <div className="breadcrumb">
            <Link href="/">Inicio</Link>
            <span>/</span>
            <span>Privacidad</span>
          </div>
          <span className="eyebrow">Información legal preliminar</span>
          <h1>Política de privacidad</h1>
          <p>Última actualización: 11 de octubre de 2026.</p>
        </header>
        <article className="legal-shell section-shell">
          <section>
            <h2>Estado de esta política</h2>
            <p>
              cobranzapp se encuentra en desarrollo. Esta política describe el tratamiento del sitio
              público y deberá ampliarse antes de habilitar el sistema operativo.
            </p>
          </section>
          <section>
            <h2>Datos de contacto</h2>
            <p>
              Cuando escribes a <a href="mailto:info@cobranzaap.tech">info@cobranzaap.tech</a>,
              usamos la información que envías para responder tu solicitud y dar seguimiento a la
              conversación.
            </p>
          </section>
          <section>
            <h2>Datos del sitio</h2>
            <p>
              Actualmente el sitio público no incluye formularios, cuentas ni analítica de terceros.
              Los registros técnicos indispensables del servidor pueden conservar dirección IP,
              fecha, recurso solicitado y resultado para seguridad y diagnóstico.
            </p>
          </section>
          <section>
            <h2>Derechos y solicitudes</h2>
            <p>
              Puedes solicitar consulta, corrección o eliminación de la información que hayas
              enviado al correo de contacto. Antes del lanzamiento se publicará la identificación
              completa del responsable y los procedimientos exigidos por la normativa colombiana
              aplicable.
            </p>
          </section>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
