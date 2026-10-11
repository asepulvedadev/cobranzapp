import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { ScrollEffects } from "../components/ScrollEffects";
import { ScrollWorldExperience } from "../components/ScrollWorldExperience";
import { SiteFooter } from "../components/SiteFooter";
import { SiteHeader } from "../components/SiteHeader";
import { blogPosts } from "../data/blog";

export const metadata: Metadata = {
  title: "Control de cartera y cobranza en Colombia | cobranzapp",
  description:
    "Organiza cartera, rutas, recaudo y cierres diarios con trazabilidad para propietarios y equipos de cobranza en Colombia.",
};

const features = [
  {
    number: "01",
    title: "Cartera que sí puedes explicar",
    text: "Consulta obligaciones, cuotas, abonos y novedades desde un historial común, sin reconstruir cada caso desde conversaciones sueltas.",
    tone: "dark",
  },
  {
    number: "02",
    title: "Rutas con responsables claros",
    text: "Asigna jornadas por cobrador, organiza puntos de gestión y deja visibles los casos que necesitan apoyo del supervisor.",
    tone: "cream",
  },
  {
    number: "03",
    title: "Recaudo con trazabilidad",
    text: "Registra el cobro, conserva su estado y genera un comprobante digital sin perder quién hizo cada movimiento.",
    tone: "mint",
  },
  {
    number: "04",
    title: "Cierres sin adivinar",
    text: "Compara pagos, efectivo, transferencias y novedades antes de dar por terminada la operación del día.",
    tone: "yellow",
  },
  {
    number: "05",
    title: "Permisos según el trabajo",
    text: "Cada perfil ve lo que necesita. El propietario conserva el control y el equipo opera dentro de su alcance asignado.",
    tone: "cream",
  },
  {
    number: "06",
    title: "Reportes con contexto",
    text: "Lee cartera, recaudo, mora y diferencias con fecha de corte, responsables y filtros útiles para decidir.",
    tone: "dark",
  },
];

const roles = [
  {
    name: "Propietario",
    label: "Cliente de cobranzapp",
    text: "Administra su empresa, configura el equipo y revisa cartera, caja y decisiones sensibles.",
  },
  {
    name: "Supervisor",
    label: "Control operativo",
    text: "Acompaña rutas, revisa excepciones y valida cierres dentro de los equipos asignados.",
  },
  {
    name: "Cobrador",
    label: "Trabajo en campo",
    text: "Consulta su jornada, registra gestiones y entrega comprobantes de los cobros realizados.",
  },
  {
    name: "Cliente",
    label: "Consulta personal",
    text: "Revisa sus obligaciones, comprobantes y canales autorizados sin acceder a la operación interna.",
  },
];

const useCases = [
  {
    number: "01",
    title: "Propietario con cartera propia",
    text: "Centraliza clientes, obligaciones y recaudo para dejar de reconstruir saldos desde varios archivos.",
    signal: "Control directo",
  },
  {
    number: "02",
    title: "Comercio que vende a crédito",
    text: "Relaciona cada plan de pago con el cliente, sus abonos y los comprobantes que respaldan la operación.",
    signal: "Ventas en cuotas",
  },
  {
    number: "03",
    title: "Empresa con equipo en campo",
    text: "Organiza rutas, delimita permisos y revisa lo que hizo cada cobrador sin depender de reportes por chat.",
    signal: "Supervisión",
  },
  {
    number: "04",
    title: "Operación con varias zonas",
    text: "Separa equipos y alcances por sucursal, zona o ruta mientras el propietario conserva una lectura común.",
    signal: "Crecimiento ordenado",
  },
];

const comparisonRows = [
  ["Historial común por cliente", "Previsto", "Manual", "Depende del archivo"],
  ["Responsable visible por gestión", "Previsto", "No", "Configuración adicional"],
  ["Permisos según el perfil", "Previsto", "No", "Limitado"],
  ["Comprobante relacionado con el pago", "Previsto", "Manual", "Manual"],
  ["Cierre y diferencias de la jornada", "Previsto", "Suma manual", "Fórmulas"],
  ["Consulta personal del cliente", "Previsto", "No", "No"],
];

const faqs = [
  {
    question: "¿cobranzapp presta dinero?",
    answer:
      "No. cobranzapp es una plataforma tecnológica para administrar cartera y cobranza de créditos otorgados por terceros.",
  },
  {
    question: "¿Para quién está pensada la plataforma?",
    answer:
      "Para propietarios de operaciones de crédito y sus equipos de supervisión y cobro. Cada empresa trabaja en un espacio independiente.",
  },
  {
    question: "¿Quién contrata el servicio?",
    answer:
      "El propietario de cada empresa es el cliente de cobranzapp. Supervisores, cobradores y clientes finales acceden como perfiles operativos vinculados a esa empresa.",
  },
  {
    question: "¿Ya está disponible?",
    answer:
      "La plataforma está en desarrollo. Estamos recibiendo solicitudes de demostración para validar los flujos con operaciones reales en Colombia.",
  },
  {
    question: "¿Pueden trabajar varias personas en la misma empresa?",
    answer:
      "Sí. El producto está diseñado para que propietario, supervisores y cobradores colaboren dentro del mismo espacio con permisos y alcances diferentes.",
  },
  {
    question: "¿Cómo manejan la información entre empresas?",
    answer:
      "La arquitectura está diseñada para separar los datos por empresa y aplicar permisos por perfil, equipo, ruta y operación.",
  },
];

function WordReveal({ children }: { children: string }) {
  const occurrences = new Map<string, number>();
  const words = children.split(" ").map((word, position) => {
    const occurrence = (occurrences.get(word) ?? 0) + 1;
    occurrences.set(word, occurrence);
    return { id: `${word}-${occurrence}`, position, word };
  });

  return (
    <p className="tagline" data-word-reveal>
      {words.map(({ id, position, word }) => (
        <span key={id} style={{ "--word-index": position } as CSSProperties}>
          {word}{" "}
        </span>
      ))}
    </p>
  );
}

export default function Home() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };

  return (
    <>
      <ScrollEffects />
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>
      <SiteHeader />
      <main id="contenido">
        <ScrollWorldExperience />

        <section className="trust-strip" aria-label="Enfoque del producto" data-reveal>
          <p>Una sola línea operativa</p>
          <div>
            <span>01</span> Cartera
          </div>
          <div>
            <span>02</span> Rutas
          </div>
          <div>
            <span>03</span> Recaudo
          </div>
          <div>
            <span>04</span> Conciliación
          </div>
        </section>

        <section className="problem-section section-shell" id="problema">
          <div className="section-heading" data-reveal>
            <span className="eyebrow">Cuando la información se dispersa</span>
            <h2>El problema no es cobrar. Es poder explicar lo que pasó después.</h2>
          </div>
          <div className="problem-grid">
            <article className="paper-card" data-reveal>
              <span className="card-kicker">Antes</span>
              <h3>Cuadernos, hojas y mensajes que no cuentan la misma historia.</h3>
              <ul>
                <li>Un saldo distinto en cada archivo</li>
                <li>Novedades sin responsable</li>
                <li>Cierres reconstruidos al final del día</li>
              </ul>
            </article>
            <article className="control-card" data-reveal>
              <span className="card-kicker">Con cobranzapp</span>
              <h3>Una operación donde cada movimiento conserva su contexto.</h3>
              <div className="control-row">
                <span>Abono registrado</span>
                <strong>08:42</strong>
              </div>
              <div className="control-row">
                <span>Comprobante generado</span>
                <strong>08:43</strong>
              </div>
              <div className="control-row">
                <span>Cierre por revisar</span>
                <strong>Hoy</strong>
              </div>
            </article>
          </div>
        </section>

        <section className="tagline-section section-shell">
          <WordReveal>
            Cada cobro deja de ser un dato suelto y se convierte en una operación que puedes seguir,
            revisar y explicar.
          </WordReveal>
        </section>

        <section className="features-section section-shell" id="funciones">
          <div className="section-heading narrow" data-reveal>
            <span className="eyebrow">Lo que estamos construyendo</span>
            <h2>Herramientas para operar, no solo para mirar cifras.</h2>
            <p>
              El alcance se está validando con propietarios de operaciones de crédito en Colombia.
            </p>
          </div>
          <div className="features-grid">
            {features.map((feature) => (
              <article className={`feature-card ${feature.tone}`} key={feature.number} data-reveal>
                <span>{feature.number}</span>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="use-cases-section section-shell" id="casos">
          <div className="section-heading row" data-reveal>
            <div>
              <span className="eyebrow">Casos de uso</span>
              <h2>La misma trazabilidad, aplicada a operaciones diferentes.</h2>
            </div>
            <Link className="text-link" href="/producto">
              Explorar el producto <span aria-hidden="true">→</span>
            </Link>
          </div>
          <div className="use-cases-grid">
            {useCases.map((item) => (
              <article key={item.number} data-reveal>
                <div>
                  <span>{item.number}</span>
                  <small>{item.signal}</small>
                </div>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
          <p className="scope-note" data-reveal>
            cobranzapp es una herramienta operativa. Cada propietario sigue siendo responsable de
            sus productos de crédito, contratos, autorizaciones y prácticas de cobranza.
          </p>
        </section>

        <section className="comparison-section">
          <div className="section-shell">
            <div className="section-heading row" data-reveal>
              <div>
                <span className="eyebrow">Comparación operativa</span>
                <h2>El cuaderno es simple. La hoja calcula. Ninguno coordina todo el trabajo.</h2>
              </div>
              <p>
                Esta comparación describe el alcance previsto de cobranzapp; no anuncia funciones
                como disponibles antes de terminar su validación.
              </p>
            </div>
            <div className="comparison-table-wrap" data-reveal>
              <table className="comparison-table">
                <thead>
                  <tr>
                    <th scope="col">Necesidad diaria</th>
                    <th scope="col">cobranzapp</th>
                    <th scope="col">Cuaderno</th>
                    <th scope="col">Hoja de cálculo</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map(([need, product, notebook, sheet]) => (
                    <tr key={need}>
                      <th scope="row">{need}</th>
                      <td>
                        <span>{product}</span>
                      </td>
                      <td>{notebook}</td>
                      <td>{sheet}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="roles-section" id="roles">
          <div className="section-shell roles-layout">
            <div className="roles-copy" data-reveal>
              <span className="eyebrow">Cuatro perfiles, una empresa</span>
              <h2>El propietario contrata. Cada persona entra a su espacio de trabajo.</h2>
              <p>
                La plataforma pública y el sistema privado permanecen separados. Dentro del sistema,
                los permisos dependen del perfil y del alcance asignado.
              </p>
              <Link className="text-link light" href="/ingresar">
                Conocer el acceso privado <span aria-hidden="true">→</span>
              </Link>
            </div>
            <div className="roles-list">
              {roles.map((role, index) => (
                <article key={role.name} data-reveal>
                  <span>0{index + 1}</span>
                  <div>
                    <small>{role.label}</small>
                    <h3>{role.name}</h3>
                    <p>{role.text}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="blog-preview section-shell" id="recursos">
          <div className="section-heading row" data-reveal>
            <div>
              <span className="eyebrow">Recursos para operar mejor</span>
              <h2>Decisiones prácticas para la cartera diaria.</h2>
            </div>
            <Link className="text-link" href="/blog">
              Ver todos los artículos <span aria-hidden="true">→</span>
            </Link>
          </div>
          <div className="article-grid">
            {blogPosts.slice(0, 3).map((post, index) => (
              <article key={post.slug} data-reveal>
                <div className={`article-visual visual-${index + 1}`} aria-hidden="true">
                  <span>0{index + 1}</span>
                </div>
                <div className="article-body">
                  <span className="card-kicker">
                    {post.category} · {post.readingTime}
                  </span>
                  <h3>
                    <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                  </h3>
                  <p>{post.summary}</p>
                  <time dateTime={post.publishedAt}>{post.dateLabel}</time>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="faq-section section-shell">
          <div className="section-heading narrow" data-reveal>
            <span className="eyebrow">Preguntas frecuentes</span>
            <h2>Lo esencial antes de conversar.</h2>
          </div>
          <div className="faq-list">
            {faqs.map((item) => (
              <details key={item.question} data-reveal>
                <summary>
                  {item.question}
                  <span aria-hidden="true">+</span>
                </summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="final-cta section-shell" data-reveal>
          <span className="eyebrow">Construyamos la operación correcta</span>
          <h2>Cuéntanos cómo cobras hoy y qué necesitas controlar mañana.</h2>
          <p>Estamos validando cobranzapp con propietarios y equipos de cobranza en Colombia.</p>
          <a
            className="button button-light"
            href="mailto:info@cobranzaap.tech?subject=Quiero%20participar%20en%20la%20validación%20de%20cobranzapp"
          >
            Hablar con el equipo
          </a>
          <a className="email-link" href="mailto:info@cobranzaap.tech">
            info@cobranzaap.tech
          </a>
        </section>
      </main>
      <SiteFooter />
      <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
    </>
  );
}
