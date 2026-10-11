import Image from "next/image";

const modules = [
  "Aislamiento entre empresas",
  "Gestión de clientes",
  "Integridad financiera",
  "Cobranza en campo",
];

export default function Home() {
  return (
    <main className="shell">
      <section className="hero">
        <div className="brand-row">
          <Image src="/brand.svg" alt="" width="48" height="48" priority />
          <span>cobranzapp</span>
        </div>
        <div className="status">Base de desarrollo activa</div>
        <h1>Operación de crédito sobre bases auditables.</h1>
        <p>
          El repositorio privado, el despliegue automático, la API, el procesador de tareas,
          PostgreSQL y el entorno del VPS están preparados para iniciar el desarrollo del producto.
        </p>
        <a className="button" href="/api/v1/status">
          Consultar estado de la API
        </a>
      </section>
      <section className="grid" aria-label="Módulos base">
        {modules.map((module, index) => (
          <article className={index === 0 ? "card card-dark" : "card"} key={module}>
            <span>0{index + 1}</span>
            <h2>{module}</h2>
            <p>Planificado y preparado para implementarse como un flujo vertical completo.</p>
          </article>
        ))}
      </section>
    </main>
  );
}
