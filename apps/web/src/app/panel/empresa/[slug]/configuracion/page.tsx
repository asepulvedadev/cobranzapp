import type { Metadata } from "next";
import type { TenantMemberProfile } from "../../../../../lib/platform";
import { serverApi } from "../../../../../lib/server-api";
import { ProfileSettingsModal } from "../ProfileSettingsModal";
import { TenantSettingsModal } from "../TenantSettingsModal";
import { loadTenantContext } from "../tenant-context";

export const metadata: Metadata = { title: "Configuración" };

export default async function TenantSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ onboarding?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const { user, overview } = await loadTenantContext(slug);
  let profile: TenantMemberProfile | null = null;
  if (overview.actorRole !== "customer" && overview.actorRole !== "support") {
    const profileResponse = await serverApi(
      `/v1/tenants/${overview.tenant.id}/members/${user.id}/profile`,
    );
    if (profileResponse.ok)
      profile = ((await profileResponse.json()) as { profile: TenantMemberProfile }).profile;
  }
  const canManage = overview.actorRole === "owner" || overview.actorRole === "supervisor";
  return (
    <div className="dashboard-page tenant-subpage">
      <header className="dashboard-header">
        <div>
          <span className="panel-eyebrow">{overview.tenant.displayName}</span>
          <h1>Configuración</h1>
          <p>Datos de la empresa y tu perfil en ventanas independientes.</p>
        </div>
      </header>
      {query.onboarding === "1" ? (
        <div className="onboarding-banner">
          <strong>Empresa creada.</strong>
          <span>Completa los datos de contacto y tu ficha para dejarla lista.</span>
        </div>
      ) : null}
      <div className="dashboard-columns">
        <section className="dashboard-card settings-card">
          <div className="card-heading">
            <div>
              <span className="panel-eyebrow">Empresa</span>
              <h2>Datos operativos</h2>
            </div>
            {overview.actorRole === "owner" ? (
              <TenantSettingsModal settings={overview.settings} tenantId={overview.tenant.id} />
            ) : null}
          </div>
          <dl className="settings-summary">
            <div>
              <dt>Correo</dt>
              <dd>{overview.settings.contactEmail ?? "Sin registrar"}</dd>
            </div>
            <div>
              <dt>Teléfono</dt>
              <dd>{overview.settings.contactPhone ?? "Sin registrar"}</dd>
            </div>
            <div>
              <dt>Dirección</dt>
              <dd>{overview.settings.address ?? "Sin registrar"}</dd>
            </div>
          </dl>
        </section>
        {profile ? (
          <section className="dashboard-card settings-card">
            <div className="card-heading">
              <div>
                <span className="panel-eyebrow">Cuenta operativa</span>
                <h2>Mi perfil</h2>
              </div>
              <ProfileSettingsModal profile={profile} tenantId={overview.tenant.id} />
            </div>
            <p className="operational-note">
              Actualiza tu foto designada, documento, celular, direcciones, contactos y tipo de
              sangre desde una ventana segura.
            </p>
          </section>
        ) : null}
      </div>
      {canManage ? (
        <p className="operational-note">
          La organización se gestiona como una sola empresa. Para administrar personas usa la vista
          Personal.
        </p>
      ) : null}
    </div>
  );
}
