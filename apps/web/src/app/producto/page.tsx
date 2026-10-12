import type { Metadata } from "next";
import Link from "next/link";
import { ScrollEffects } from "../../components/ScrollEffects";
import { SiteFooter } from "../../components/SiteFooter";
import { SiteHeader } from "../../components/SiteHeader";

export const metadata: Metadata = {
  title: "Producto para controlar cartera y cobranza",
  description:
    "Conoce los módulos, perfiles y flujo operativo que estamos construyendo en cobranzapp para empresas colombianas.",
  alternates: { canonical: "/producto" },
};

const modules = [
  {
    number: "01",
    title: "Cartera y obligaciones",
    text: "Una ficha común para relacionar clientes, créditos, cuotas, vencimientos, abonos y novedades sin duplicar la historia.",
    detail: "Base operativa",
  },
  {
    number: "02",
    title: "Planeación de rutas",
    text: "Jornadas organizadas por responsable, zona y prioridad para que el trabajo de campo empiece con un alcance claro.",
    detail: "Preparación diaria",
  },
  {
    number: "03",
    title: "Gestión de cobro",
    text: "Registro de visitas, contactos, compromisos, pagos y resultados contra la obligación correspondiente.",
    detail: "Trabajo en campo",
  },
  {
    number: "04",
    title: "Comprobantes",
    text: "Evidencia digital asociada al pago y disponible para consulta, sin depender de fotos o mensajes aislados.",
    detail: "Trazabilidad",
  },
  {
    number: "05",
    title: "Supervisión",
    text: "Vista de avances, casos detenidos y excepciones que requieren revisión dentro de cada equipo o ruta.",
    detail: "Control operativo",
  },
  {
    number: "06",
    title: "Cierre y conciliación",
    text: "Comparación entre pagos registrados, medios de pago, entregas y diferencias antes de cerrar la jornada.",
    detail: "Control diario",
  },
  {
    number: "07",
    title: "Reportes",
    text: "Lecturas de cartera, recaudo y mora con fecha de corte, filtros y contexto suficiente para tomar decisiones.",
    detail: "Seguimiento",
  },
  {
    number: "08",
    title: "Consulta del cliente",
    text: "Un espacio separado para revisar obligaciones y comprobantes propios, sin exponer la operación interna de la empresa.",
    detail: "Autoservicio",
  },
];

const flow = [
  ["Preparar", "El propietario o supervisor revisa cartera y organiza la jornada."],
  ["Asignar", "Cada caso queda relacionado con un responsable y un alcance."],
  ["Gestionar", "El cobrador registra el resultado donde ocurrió la operación."],
  ["Revisar", "Las novedades y diferencias llegan al perfil que puede resolverlas."],
  ["Cerrar", "La jornada conserva una explicación común del recaudo y los pendientes."],
];

const permissions = [
  {
    action: "Configurar la empresa y el equipo",
    owner: true,
    supervisor: false,
    collector: false,
    customer: false,
  },
  {
    action: "Consultar toda la cartera",
    owner: true,
    supervisor: "Asignada",
    collector: false,
    customer: false,
  },
  {
    action: "Organizar y revisar rutas",
    owner: true,
    supervisor: true,
    collector: false,
    customer: false,
  },
  {
    action: "Registrar gestiones y cobros",
    owner: true,
    supervisor: true,
    collector: "Propios",
    customer: false,
  },
  {
    action: "Revisar cierres y diferencias",
    owner: true,
    supervisor: true,
    collector: "Propios",
    customer: false,
  },
  {
    action: "Consultar obligaciones y comprobantes",
    owner: false,
    supervisor: false,
    collector: false,
    customer: "Propios",
  },
];

function Permission({ value }: { value: boolean | string }) {
  if (value === false) return <span className="permission-no">—</span>;
  if (value === true)
    return (
      <span className="permission-yes" role="img" aria-label="Incluido">
        ✓
      </span>
    );
  return <span className="permission-scope">{value}</span>;
}

export default function ProductPage() {
  const productSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "cobranzapp",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    inLanguage: "es-CO",
    description:
      "Plataforma en desarrollo para organizar cartera, rutas, recaudo y cierres de empresas colombianas.",
  };

  return (
    <>
      <ScrollEffects />
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>
      <SiteHeader />
      <main className="page-main product-page" id="contenido">
        <section className="product-hero section-shell" data-reveal>
          <div className="breadcrumb">
            <Link href="/">Inicio</Link>
            <span>/</span>
            <span>Producto</span>
          </div>
          <span className="eyebrow">Una operación conectada</span>
          <h1>El sistema que estamos construyendo para explicar cada peso y cada gestión.</h1>
          <div className="product-hero-bottom">
            <p>
              cobranzapp conecta la información que prepara la jornada, acompaña el cobro y permite
              revisar el cierre. Cada empresa opera en un espacio independiente y cada perfil entra
              solo a lo que necesita.
            </p>
            <a className="button" href="/contacto?source=producto">
              Solicitar una demostración
            </a>
          </div>
          <p className="product-status">
            Producto en desarrollo · El alcance final se está validando con operaciones colombianas.
          </p>
        </section>

        <section className="product-map section-shell" aria-labelledby="modules-title">
          <div className="section-heading row" data-reveal>
            <div>
              <span className="eyebrow">Mapa del producto</span>
              <h2 id="modules-title">Ocho módulos, una misma historia operativa.</h2>
            </div>
            <p>
              La arquitectura evita convertir cada función en una isla: cartera, ruta, recaudo y
              cierre comparten responsables y trazabilidad.
            </p>
          </div>
          <div className="module-grid">
            {modules.map((module) => (
              <article key={module.number} data-reveal>
                <div>
                  <span>{module.number}</span>
                  <small>{module.detail}</small>
                </div>
                <h3>{module.title}</h3>
                <p>{module.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="operation-flow">
          <div className="section-shell">
            <div className="section-heading narrow" data-reveal>
              <span className="eyebrow">Flujo operativo</span>
              <h2>La información avanza. El contexto no se pierde.</h2>
              <p>
                Cada etapa entrega información útil a la siguiente, en lugar de obligar al equipo a
                reconstruir el día al final.
              </p>
            </div>
            <ol className="operation-flow-list">
              {flow.map(([title, text], index) => (
                <li key={title} data-reveal>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="permissions-section section-shell" aria-labelledby="permissions-title">
          <div className="section-heading" data-reveal>
            <span className="eyebrow">Permisos por responsabilidad</span>
            <h2 id="permissions-title">Cada perfil trabaja dentro de un límite visible.</h2>
          </div>
          <div className="permissions-table-wrap" data-reveal>
            <table className="permissions-table">
              <thead>
                <tr>
                  <th scope="col">Acción</th>
                  <th scope="col">Propietario</th>
                  <th scope="col">Supervisor</th>
                  <th scope="col">Cobrador</th>
                  <th scope="col">Cliente</th>
                </tr>
              </thead>
              <tbody>
                {permissions.map((row) => (
                  <tr key={row.action}>
                    <th scope="row">{row.action}</th>
                    <td>
                      <Permission value={row.owner} />
                    </td>
                    <td>
                      <Permission value={row.supervisor} />
                    </td>
                    <td>
                      <Permission value={row.collector} />
                    </td>
                    <td>
                      <Permission value={row.customer} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="permissions-note">
            Esta matriz expresa el alcance funcional previsto. Los permisos específicos podrán
            ajustarse durante la validación del producto.
          </p>
        </section>

        <section className="product-principles section-shell">
          <article data-reveal>
            <span className="eyebrow">Separación</span>
            <h2>La vitrina pública no es el sistema privado.</h2>
            <p>
              El contenido comercial explica el producto. Los datos operativos viven en un acceso
              independiente, protegido y asociado a la empresa correspondiente.
            </p>
          </article>
          <article data-reveal>
            <span className="eyebrow">Modelo comercial</span>
            <h2>El propietario es quien contrata cobranzapp.</h2>
            <p>
              Supervisores, cobradores y clientes finales son usuarios vinculados a esa operación;
              no se presentan como compradores separados del servicio.
            </p>
          </article>
        </section>

        <section className="final-cta section-shell" data-reveal>
          <span className="eyebrow">Validación del producto</span>
          <h2>Una buena demostración empieza con tu operación real.</h2>
          <p>
            Cuéntanos cómo administras hoy la cartera, las rutas y el recaudo. Así podremos validar
            el alcance antes de ofrecer una promesa comercial.
          </p>
          <a className="button button-light" href="/contacto?source=producto">
            Hablar con el equipo
          </a>
        </section>
      </main>
      <SiteFooter />
      <script type="application/ld+json">{JSON.stringify(productSchema)}</script>
    </>
  );
}
