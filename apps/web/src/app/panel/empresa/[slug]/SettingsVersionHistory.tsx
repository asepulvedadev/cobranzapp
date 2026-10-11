import type { TenantOverview } from "../../../../lib/platform";

const dateFormatter = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Bogota",
});

export function SettingsVersionHistory({
  versions,
}: {
  versions: TenantOverview["settingsHistory"];
}) {
  if (!versions.length) return null;

  return (
    <section aria-labelledby="settings-history-title" className="settings-history">
      <div className="settings-history-heading">
        <div>
          <h3 id="settings-history-title">Historial de configuración</h3>
          <p>Cada guardado conserva quién hizo el cambio y los valores publicados.</p>
        </div>
        <span>{versions.length} versiones</span>
      </div>
      <ol>
        {versions.map((version, index) => (
          <li key={version.version}>
            <div className="settings-version-heading">
              <strong>Versión {version.version}</strong>
              {index === 0 ? <span>Actual</span> : null}
            </div>
            <div className="settings-version-colors">
              <span>
                <i aria-hidden="true" style={{ backgroundColor: version.primaryColor }} />
                {version.primaryColor}
              </span>
              <span>
                <i aria-hidden="true" style={{ backgroundColor: version.accentColor }} />
                {version.accentColor}
              </span>
            </div>
            <p>{version.contactEmail ?? "Sin correo operativo"}</p>
            <footer>
              <span>{version.changedByDisplayName}</span>
              <time dateTime={version.changedAt}>
                {dateFormatter.format(new Date(version.changedAt))}
              </time>
            </footer>
          </li>
        ))}
      </ol>
    </section>
  );
}
