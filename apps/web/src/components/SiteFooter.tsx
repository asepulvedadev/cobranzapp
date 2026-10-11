import Link from "next/link";
import { Brand } from "./Brand";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div>
          <Brand light />
          <p>Control operativo de cartera y cobranza para equipos colombianos.</p>
        </div>
        <div>
          <strong>Producto</strong>
          <Link href="/producto">Funciones</Link>
          <Link href="/#casos">Casos de uso</Link>
          <Link href="/#roles">Perfiles</Link>
          <Link href="/ingresar">Ingresar</Link>
        </div>
        <div>
          <strong>Recursos</strong>
          <Link href="/blog">Blog</Link>
          <Link href="/nosotros">Nosotros</Link>
          <Link href="/contacto">Contacto</Link>
        </div>
        <div>
          <strong>Legal</strong>
          <Link href="/privacidad">Privacidad</Link>
          <Link href="/terminos">Términos</Link>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} cobranzapp</span>
        <span>Cúcuta, Norte de Santander, Colombia</span>
      </div>
    </footer>
  );
}
