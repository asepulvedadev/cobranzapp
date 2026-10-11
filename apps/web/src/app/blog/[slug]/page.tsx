import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "../../../components/SiteFooter";
import { SiteHeader } from "../../../components/SiteHeader";
import { blogPosts, getBlogPost } from "../../../data/blog";

type PageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.summary,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.summary,
      publishedTime: post.publishedAt,
    },
  };
}

export default async function BlogArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  return (
    <>
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>
      <SiteHeader />
      <main className="page-main" id="contenido">
        <header className="page-hero section-shell">
          <div className="breadcrumb">
            <Link href="/">Inicio</Link>
            <span>/</span>
            <Link href="/blog">Recursos</Link>
            <span>/</span>
            <span>{post.category}</span>
          </div>
          <span className="eyebrow">
            {post.category} · {post.readingTime}
          </span>
          <h1>{post.title}</h1>
          <p>{post.summary}</p>
        </header>
        <div className="article-shell section-shell">
          <aside className="article-aside">
            <span>Publicado</span>
            <strong>
              <time dateTime={post.publishedAt}>{post.dateLabel}</time>
            </strong>
            <span>Lectura</span>
            <strong>{post.readingTime}</strong>
            <Link className="text-link" href="/blog">
              Volver a recursos <span aria-hidden="true">→</span>
            </Link>
          </aside>
          <article className="article-content">
            <p>{post.intro}</p>
            {post.sections.map((section) => (
              <section key={section.title}>
                <h2>{section.title}</h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {section.bullets ? (
                  <ul>
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
            <aside className="article-cta">
              <h2>Una operación clara empieza por entender el trabajo real.</h2>
              <p>
                Si administras una cartera en Colombia, cuéntanos cómo organizas hoy tus rutas y
                cierres.
              </p>
              <a
                className="button"
                href="mailto:info@cobranzaap.tech?subject=Quiero%20conversar%20sobre%20cobranzapp"
              >
                Conversar con cobranzapp
              </a>
            </aside>
          </article>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
