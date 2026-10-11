import Link from "next/link";
import { Brand } from "./Brand";

const links = [
  { href: "/producto", label: "Producto" },
  { href: "/#como-funciona", label: "Cómo funciona" },
  { href: "/#casos", label: "Casos de uso" },
  { href: "/#roles", label: "Perfiles" },
  { href: "/blog", label: "Recursos" },
];

export function SiteHeader() {
  return (
    <header className="site-header">
      <nav className="nav-shell" aria-label="Navegación principal">
        <Brand />
        <div className="nav-links">
          {links.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </div>
        <div className="nav-actions">
          <Link className="nav-login" href="/ingresar">
            Ingresar
          </Link>
          <a
            className="button button-small"
            href="mailto:info@cobranzaap.tech?subject=Demostración%20de%20cobranzapp"
          >
            Solicitar demostración
          </a>
        </div>
        <details className="mobile-menu">
          <summary aria-label="Abrir menú">
            <span />
            <span />
          </summary>
          <div className="mobile-menu-panel">
            {links.map((link) => (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            ))}
            <Link href="/ingresar">Ingresar al sistema</Link>
            <a href="mailto:info@cobranzaap.tech?subject=Demostración%20de%20cobranzapp">
              Solicitar demostración
            </a>
          </div>
        </details>
      </nav>
    </header>
  );
}
