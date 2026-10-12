import type { CSSProperties } from "react";
import type { TenantOverview } from "../../../../lib/platform";

const tenantStatusLabels = {
  draft: "Configuración",
  active: "Activa",
  suspended: "Suspendida",
  archived: "Archivada",
};

export function CustomerWorkspace({ overview }: { overview: TenantOverview }) {
  const brandStyle = {
    "--tenant-brand-primary": overview.settings.primaryColor,
    "--tenant-brand-accent": overview.settings.accentColor,
  } as CSSProperties;

  return (
    <div className="dashboard-page tenant-dashboard" style={brandStyle}>
      <div className="tenant-brand-band" aria-hidden="true" />
      <header className="dashboard-header">
        <div>
          <span className="panel-eyebrow">Acceso personal</span>
          <h1>{overview.tenant.displayName}</h1>
          <p>Sesión como cliente. Solo podrás consultar información vinculada a tu cuenta.</p>
        </div>
        <span className={`status status-${overview.tenant.status}`}>
          {tenantStatusLabels[overview.tenant.status]}
        </span>
      </header>

      <section className="dashboard-card customer-boundary-card">
        <div className="customer-boundary-copy">
          <span className="panel-eyebrow">Privacidad por diseño</span>
          <h2>Tu acceso está separado de la operación interna.</h2>
          <p>
            No puedes consultar personal, sedes, equipos, rutas ni información de otros clientes. La
            consulta de obligaciones y comprobantes se habilitará cuando el módulo financiero
            termine su revisión legal y contable.
          </p>
        </div>
        <dl className="customer-contact-list">
          <div>
            <dt>Correo de la empresa</dt>
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

      <section className="dashboard-card customer-boundary-status">
        <div>
          <i className="control-ok" />
          <span>
            <strong>Cuenta aislada</strong>
            <small>El acceso pertenece únicamente a esta empresa.</small>
          </span>
        </div>
        <div>
          <i className="control-ok" />
          <span>
            <strong>Organización protegida</strong>
            <small>La estructura interna no se entrega a cuentas de clientes.</small>
          </span>
        </div>
        <div>
          <i className="control-pending" />
          <span>
            <strong>Obligaciones y comprobantes</strong>
            <small>Pendientes de las reglas financieras y legales aprobadas.</small>
          </span>
        </div>
      </section>
    </div>
  );
}
