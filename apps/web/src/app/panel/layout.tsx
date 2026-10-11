import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Brand } from "../../components/Brand";
import type { CurrentUser } from "../../lib/platform";
import { serverApi } from "../../lib/server-api";
import { LogoutButton } from "./LogoutButton";
import "./panel.css";

export const metadata: Metadata = {
  title: { default: "Panel", template: "%s | Panel cobranzapp" },
  robots: { index: false, follow: false },
};

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const response = await serverApi("/v1/auth/me");
  if (response.status === 401) redirect("/ingresar");
  if (!response.ok) throw new Error("No fue posible validar la sesión");
  const { user } = (await response.json()) as { user: CurrentUser };
  const primaryMembership = user.memberships[0];
  if (user.platformRole !== "developer" && !primaryMembership) {
    redirect("/ingresar?error=perfil-no-habilitado");
  }
  const dashboardHref =
    user.platformRole === "developer"
      ? "/panel/desarrollador"
      : `/panel/empresa/${primaryMembership?.tenantSlug}`;

  return (
    <div className="panel-shell">
      <aside className="panel-sidebar">
        <Brand light />
        <div className="panel-context">
          <span>{user.platformRole === "developer" ? "Plataforma" : "Empresa"}</span>
          <strong>
            {user.platformRole === "developer" ? "Administración" : primaryMembership?.tenantName}
          </strong>
        </div>
        <nav aria-label="Navegación del panel" className="panel-nav">
          <Link href={dashboardHref}>
            <span aria-hidden="true">▦</span> Vista general
          </Link>
          {user.platformRole === "developer" ? (
            <>
              <Link href="/panel/desarrollador#empresas">
                <span aria-hidden="true">◇</span> Empresas
              </Link>
              <Link href="/panel/desarrollador#actividad">
                <span aria-hidden="true">↗</span> Actividad
              </Link>
            </>
          ) : (
            <>
              <Link href={`${dashboardHref}#equipo`}>
                <span aria-hidden="true">◇</span> Equipo
              </Link>
              <Link href={`${dashboardHref}#configuracion`}>
                <span aria-hidden="true">↗</span> Configuración
              </Link>
            </>
          )}
          <Link href="/panel/seguridad">
            <span aria-hidden="true">●</span> Seguridad
          </Link>
        </nav>
        <div className="panel-sidebar-footer">
          <div className="panel-profile">
            <span>{user.displayName.slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>{user.displayName}</strong>
              <small>@{user.username}</small>
            </div>
          </div>
          <LogoutButton />
        </div>
      </aside>
      <main className="panel-main" id="contenido">
        {user.mustChangePassword ? (
          <div className="security-banner" role="status">
            <div>
              <strong>Protege tu cuenta</strong>
              <span>Cambia la contraseña inicial antes de continuar con datos reales.</span>
            </div>
            <Link href="/panel/seguridad">Cambiar contraseña</Link>
          </div>
        ) : null}
        {children}
      </main>
    </div>
  );
}
