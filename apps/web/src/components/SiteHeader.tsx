import { SignInIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Brand } from "./Brand";

const links = [
  { href: "/producto", label: "Producto" },
  { href: "/#planes", label: "Planes" },
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
          <Link className="nav-login" href="/ingresar" aria-label="Ingresar" title="Ingresar">
            <SignInIcon size={24} weight="bold" aria-hidden="true" focusable="false" />
          </Link>
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
          </div>
        </details>
      </nav>
    </header>
  );
}
