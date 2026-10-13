import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import { Brand } from "../../components/Brand";
import type { CurrentUser } from "../../lib/platform";
import { serverApi } from "../../lib/server-api";
import { LogoutButton } from "./LogoutButton";
import { PanelNavigation } from "./PanelNavigation";
import { ReauthenticationProvider } from "./ReauthenticationProvider";
import { PasswordForm } from "./seguridad/PasswordForm";
import { TenantBrandRuntime } from "./TenantBrandRuntime";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
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
  const canSwitchCompanies = primaryMembership?.role === "owner" && user.memberships.length > 1;
  const brandResponse = primaryMembership
    ? await serverApi(`/v1/tenants/${primaryMembership.tenantId}/overview`)
    : null;
  const brandOverview = brandResponse?.ok
    ? ((await brandResponse.json()) as {
        settings?: { primaryColor?: string; accentColor?: string; logoObjectKey?: string | null };
      })
    : null;
  const brandPrimary = brandOverview?.settings?.primaryColor ?? "#fbbf24";
  const brandAccent = brandOverview?.settings?.accentColor ?? "#151817";
  const brandLogo = brandOverview?.settings?.logoObjectKey
    ? `/api/v1/tenants/${primaryMembership?.tenantId}/brand-logo`
    : null;
  if (user.mustChangePassword) {
    return (
      <ReauthenticationProvider username={user.username}>
        <div className="panel-shell initial-password-shell">
          <main className="panel-main" id="contenido">
            <div className="dashboard-page narrow-page">
              <header className="dashboard-header">
                <div>
                  <span className="panel-eyebrow">Primer ingreso</span>
                  <h1>Protege tu cuenta</h1>
                  <p>Actualiza la contraseña inicial antes de acceder a datos operativos.</p>
                </div>
              </header>
              <section className="dashboard-card security-card">
                <div className="card-heading">
                  <div>
                    <span className="panel-eyebrow">Credenciales</span>
                    <h2>Cambiar contraseña inicial</h2>
                  </div>
                </div>
                <PasswordForm />
              </section>
            </div>
          </main>
        </div>
      </ReauthenticationProvider>
    );
  }
  const dashboardHref =
    user.platformRole === "developer"
      ? "/panel/desarrollador"
      : primaryMembership
        ? `/panel/empresa/${primaryMembership.tenantSlug}`
        : "/panel/onboarding";

  return (
    <ReauthenticationProvider username={user.username}>
      <div
        className="panel-shell"
        style={
          {
            "--tenant-brand-primary": brandPrimary,
            "--tenant-brand-accent": brandAccent,
          } as CSSProperties
        }
      >
        <aside className="panel-sidebar">
          <Brand href={dashboardHref} light />
          <div className="panel-context">
            <span>{user.platformRole === "developer" ? "Plataforma" : "Empresa"}</span>
            {user.platformRole === "developer" ? (
              <strong>Administración</strong>
            ) : primaryMembership ? (
              <TenantBrandRuntime
                initialBrand={{
                  primaryColor: brandPrimary,
                  accentColor: brandAccent,
                  logoObjectKey: brandOverview?.settings?.logoObjectKey ?? null,
                }}
                initialLogo={brandLogo}
                memberships={user.memberships}
              />
            ) : (
              <strong>Crear empresa</strong>
            )}
          </div>
          <PanelNavigation
            dashboardHref={dashboardHref}
            isDeveloper={user.platformRole === "developer"}
            memberships={user.memberships}
          />
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
          {user.platformRole !== "developer" && canSwitchCompanies ? (
            <WorkspaceSwitcher
              className="workspace-switcher-mobile"
              memberships={user.memberships}
            />
          ) : null}
          {children}
        </main>
      </div>
    </ReauthenticationProvider>
  );
}
