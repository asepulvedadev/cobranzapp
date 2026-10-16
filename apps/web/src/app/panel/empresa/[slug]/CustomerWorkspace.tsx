import Link from "next/link";
import type { CSSProperties } from "react";
import type { TenantOverview } from "../../../../lib/platform";

export function CustomerWorkspace({ overview }: { overview: TenantOverview }) {
  const brandStyle = {
    "--tenant-brand-primary": overview.settings.primaryColor,
    "--tenant-brand-accent": overview.settings.accentColor,
  } as CSSProperties;

  return (
    <div className="dashboard-page tenant-dashboard role-dashboard" style={brandStyle}>
      <div className="tenant-brand-band" aria-hidden="true" />
      <header className="dashboard-header role-dashboard-header">
        <div>
          <span className="panel-eyebrow">{overview.tenant.displayName} · Cliente</span>
          <h1>Mi cuenta</h1>
          <p>Consulta únicamente tu información y los canales de atención de la empresa.</p>
        </div>
      </header>

      <section className="dashboard-card customer-simple-card">
        <div className="card-heading">
          <div>
            <span className="panel-eyebrow">Información personal</span>
            <h2>Tu acceso está protegido</h2>
          </div>
        </div>
        <p>
          La información de otros clientes, rutas y personal nunca se muestra en este perfil. Tus
          obligaciones y comprobantes aparecerán aquí cuando el módulo financiero esté habilitado.
        </p>
        <Link className="primary-action" href="/panel/perfil">
          Revisar mis datos
        </Link>
      </section>

      <section className="dashboard-card customer-contact-card">
        <div className="card-heading">
          <div>
            <span className="panel-eyebrow">Ayuda</span>
            <h2>Contactar a la empresa</h2>
          </div>
        </div>
        <dl className="customer-contact-list">
          <div>
            <dt>Teléfono</dt>
            <dd>{overview.settings.contactPhone ?? "No registrado"}</dd>
          </div>
          <div>
            <dt>Correo</dt>
            <dd>{overview.settings.contactEmail ?? "No registrado"}</dd>
          </div>
          <div>
            <dt>Dirección</dt>
            <dd>{overview.settings.address ?? "No registrada"}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
