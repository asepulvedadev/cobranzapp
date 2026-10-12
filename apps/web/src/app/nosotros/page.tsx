import type { Metadata } from "next";
import Link from "next/link";
import { ScrollEffects } from "../../components/ScrollEffects";
import { SiteFooter } from "../../components/SiteFooter";
import { SiteHeader } from "../../components/SiteHeader";

export const metadata: Metadata = {
  title: "Sobre cobranzapp",
  description:
    "Conoce el enfoque con el que estamos construyendo cobranzapp desde Cúcuta para operaciones colombianas de cartera y cobranza.",
  alternates: { canonical: "/nosotros" },
};

const principles = [
  {
    number: "01",
    title: "Explicar antes que impresionar",
    text: "Un reporte vale cuando permite reconstruir el saldo, el pago y la persona responsable sin esconder los detalles importantes.",
  },
  {
    number: "02",
    title: "Permisos antes que accesos abiertos",
    text: "Cada perfil debe entrar solo a la información necesaria para su responsabilidad, dentro de la empresa que le corresponde.",
  },
  {
    number: "03",
    title: "Validar antes que prometer",
    text: "No publicamos cifras, testimonios ni capacidades como hechos mientras el producto y la operación todavía están en validación.",
  },
];

export default function AboutPage() {
  return (
    <>
      <ScrollEffects />
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>
      <SiteHeader />
      <main className="page-main" id="contenido">
        <section className="page-hero section-shell" data-reveal>
          <div className="breadcrumb">
            <Link href="/">Inicio</Link>
            <span>/</span>
            <span>Nosotros</span>
          </div>
          <span className="eyebrow">Desde Cúcuta, Colombia</span>
          <h1>
            Estamos construyendo control operativo para negocios que necesitan cuentas claras.
          </h1>
          <p>
            cobranzapp nace como una plataforma independiente para conectar cartera, rutas, recaudo
            y cierres sin convertirse en prestamista, entidad financiera o custodio del dinero de
            sus usuarios.
          </p>
        </section>

        <section className="about-statement section-shell" data-reveal>
          <p>
            Nuestro trabajo no consiste en digitalizar un cuaderno y conservar los mismos vacíos.
            Consiste en diseñar una operación donde cada dato tenga contexto, cada acción tenga un
            responsable y cada empresa conserve sus propios límites.
          </p>
        </section>

        <section className="about-principles section-shell" aria-label="Principios del producto">
          {principles.map((principle) => (
            <article key={principle.number} data-reveal>
              <span>{principle.number}</span>
              <h2>{principle.title}</h2>
              <p>{principle.text}</p>
            </article>
          ))}
        </section>

        <section className="about-boundary section-shell" data-reveal>
          <div>
            <span className="eyebrow">Nuestro límite</span>
            <h2>El software organiza. El propietario responde por su operación.</h2>
          </div>
          <p>
            Cada propietario define y administra sus productos de crédito conforme a las reglas que
            le correspondan. cobranzapp no entrega capital, no aprueba créditos por cuenta propia y
            no recibe pagos de los clientes finales.
          </p>
        </section>

        <section className="final-cta section-shell" data-reveal>
          <span className="eyebrow">Construcción con contexto</span>
          <h2>
            Queremos entender cómo funciona una jornada real antes de cerrarla en una pantalla.
          </h2>
          <a className="button button-light" href="/contacto?source=nosotros">
            Conversar con el equipo
          </a>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
