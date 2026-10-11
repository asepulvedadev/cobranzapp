import type { Metadata } from "next";
import Link from "next/link";
import { ScrollEffects } from "../../components/ScrollEffects";
import { SiteFooter } from "../../components/SiteFooter";
import { SiteHeader } from "../../components/SiteHeader";
import { blogPosts } from "../../data/blog";

export const metadata: Metadata = {
  title: "Recursos de cartera y cobranza",
  description:
    "Guías prácticas sobre rutas de cobro, cartera vencida, recaudo y conciliación para equipos colombianos.",
  alternates: { canonical: "/blog" },
};

export default function BlogPage() {
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
            <span>Recursos</span>
          </div>
          <span className="eyebrow">Biblioteca cobranzapp</span>
          <h1>Guías para convertir la cobranza diaria en una operación controlable.</h1>
          <p>
            Contenido original sobre cartera, rutas, recaudo y cierres para propietarios y equipos
            en Colombia.
          </p>
        </section>
        <section className="blog-list section-shell" aria-label="Artículos">
          {blogPosts.map((post, index) => (
            <article key={post.slug} data-reveal>
              <span className="article-index">0{index + 1}</span>
              <div>
                <span className="card-kicker">
                  {post.category} · {post.readingTime}
                </span>
                <h2>
                  <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                </h2>
                <p>{post.summary}</p>
              </div>
              <time dateTime={post.publishedAt}>{post.dateLabel}</time>
            </article>
          ))}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
