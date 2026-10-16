import type { Borrower } from "@cobranzapp/contracts";
import type { ReactNode } from "react";

function identityStatusLabel(status: Borrower["identity"]["verificationState"]) {
  return status === "reviewed" ? "Verificado" : status === "rejected" ? "Rechazado" : "En revisión";
}

function addressStatusLabel(location: Borrower["addressLocations"]["home"]) {
  return location.status === "ready"
    ? "Ubicación lista"
    : location.status === "failed"
      ? "Falta ubicar"
      : "Sin ubicación";
}

export function CollectorBorrowerCard({
  borrower,
  creditHref,
  whatsappHref,
  homeWazeHref,
  workWazeHref,
  locating,
  onEditAddresses,
  onLocate,
  onUseDeviceLocation,
  documentTools,
}: {
  borrower: Borrower;
  creditHref: string;
  whatsappHref: string | null;
  homeWazeHref: string;
  workWazeHref: string;
  locating: string;
  onEditAddresses: () => void;
  onLocate: (kind: "home" | "work") => void;
  onUseDeviceLocation: (kind: "home" | "work") => void;
  documentTools: ReactNode;
}) {
  const initials = borrower.fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  const phoneHref = `tel:${borrower.phone.replace(/[^\d+]/g, "")}`;

  return (
    <article className="collector-client-card">
      <header className="collector-client-heading">
        <span className="collector-client-avatar" aria-hidden="true">
          {initials || "CL"}
        </span>
        <div>
          <h3>{borrower.fullName}</h3>
          <p>
            {borrower.identity.documentType} · •••• {borrower.identity.documentLast4}
          </p>
        </div>
        <span
          className={`status collector-client-status status-${borrower.identity.verificationState}`}
        >
          {identityStatusLabel(borrower.identity.verificationState)}
        </span>
      </header>

      <div className="collector-client-contact">
        <span>Teléfono</span>
        <strong>{borrower.phone}</strong>
      </div>

      <div className="collector-client-actions">
        <a className="collector-client-action collector-client-action-primary" href={creditHref}>
          Crear crédito
        </a>
        <a className="collector-client-action" href={phoneHref}>
          Llamar
        </a>
        {whatsappHref ? (
          <a
            className="collector-client-action"
            href={whatsappHref}
            rel="noreferrer"
            target="_blank"
          >
            WhatsApp
          </a>
        ) : null}
        <a className="collector-client-action" href={homeWazeHref} rel="noreferrer" target="_blank">
          Ir a casa
        </a>
      </div>

      <details className="collector-client-details">
        <summary>Ver ficha y direcciones</summary>
        <div className="collector-client-details-body">
          <section className="collector-client-address">
            <div>
              <span>Casa</span>
              <small>{addressStatusLabel(borrower.addressLocations.home)}</small>
            </div>
            <strong>{borrower.homeAddress}</strong>
            <div className="collector-client-address-actions">
              <button
                disabled={locating === `${borrower.id}:home`}
                onClick={() => onLocate("home")}
                type="button"
              >
                {locating === `${borrower.id}:home` ? "Ubicando…" : "Ubicar"}
              </button>
              <button onClick={() => onUseDeviceLocation("home")} type="button">
                Usar GPS
              </button>
              <a href={homeWazeHref} rel="noreferrer" target="_blank">
                Waze
              </a>
            </div>
          </section>

          <section className="collector-client-address">
            <div>
              <span>Trabajo</span>
              <small>{addressStatusLabel(borrower.addressLocations.work)}</small>
            </div>
            <strong>{borrower.workAddress}</strong>
            <div className="collector-client-address-actions">
              <button
                disabled={locating === `${borrower.id}:work`}
                onClick={() => onLocate("work")}
                type="button"
              >
                {locating === `${borrower.id}:work` ? "Ubicando…" : "Ubicar"}
              </button>
              <button onClick={() => onUseDeviceLocation("work")} type="button">
                Usar GPS
              </button>
              <a href={workWazeHref} rel="noreferrer" target="_blank">
                Waze
              </a>
            </div>
          </section>

          <button className="collector-client-edit" onClick={onEditAddresses} type="button">
            Corregir direcciones
          </button>

          {borrower.emergencyContacts.length ? (
            <section className="collector-client-emergency">
              <span>Contactos de emergencia</span>
              {borrower.emergencyContacts.map((contact) => (
                <a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`} key={contact.id}>
                  <strong>{contact.fullName}</strong>
                  <small>
                    {contact.relationship} · {contact.phone}
                  </small>
                </a>
              ))}
            </section>
          ) : null}

          <section className="collector-client-documents">
            <span>Documentos</span>
            <small>{borrower.documents.length} archivo(s) privado(s)</small>
            {documentTools}
          </section>
        </div>
      </details>
    </article>
  );
}
