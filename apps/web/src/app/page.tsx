import Image from "next/image";

const modules = [
  "Tenant isolation",
  "Borrower operations",
  "Financial integrity",
  "Field collections",
];

export default function Home() {
  return (
    <main className="shell">
      <section className="hero">
        <div className="brand-row">
          <Image src="/brand.svg" alt="" width="48" height="48" priority />
          <span>cobranzapp</span>
        </div>
        <div className="status">Development foundation online</div>
        <h1>Operational lending, built on auditable foundations.</h1>
        <p>
          The private repository, automated delivery pipeline, API, worker, PostgreSQL, and
          production VPS runtime are ready for product development.
        </p>
        <a className="button" href="/api/v1/status">
          Check API status
        </a>
      </section>
      <section className="grid" aria-label="Foundation modules">
        {modules.map((module, index) => (
          <article className={index === 0 ? "card card-dark" : "card"} key={module}>
            <span>0{index + 1}</span>
            <h2>{module}</h2>
            <p>Planned, gated, and ready to implement as a complete vertical slice.</p>
          </article>
        ))}
      </section>
    </main>
  );
}
