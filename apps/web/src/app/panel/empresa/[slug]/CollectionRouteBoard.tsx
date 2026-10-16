"use client";

import { useState } from "react";
import type { Route } from "../../../../lib/platform";
import { useSensitiveFetch } from "../../ReauthenticationProvider";

function wazeUrl(address: string, latitude: number | null, longitude: number | null) {
  if (latitude !== null && longitude !== null) {
    return `https://www.waze.com/ul?ll=${latitude}%2C${longitude}&navigate=yes&utm_source=cobranzapp`;
  }
  return `https://www.waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes&utm_source=cobranzapp`;
}

async function errorMessage(response: Response | null, fallback: string) {
  const body = (await response?.json().catch(() => ({}))) as {
    error?: { message?: string };
  };
  return body.error?.message ?? fallback;
}

export function CollectionRouteBoard({
  canReorder,
  onChanged,
  routes,
  tenantId,
}: {
  canReorder: boolean;
  onChanged: () => void;
  routes: Route[];
  tenantId: string;
}) {
  const sensitiveFetch = useSensitiveFetch();
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  async function reorderStops(route: Route, index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= route.stops.length) return;
    const stopIds = route.stops.map((stop) => stop.id);
    [stopIds[index], stopIds[target]] = [stopIds[target], stopIds[index]];
    setIsBusy(true);
    setMessage("");
    setIsError(false);
    const response = await sensitiveFetch(
      `/api/v1/tenants/${tenantId}/routes/${route.id}/stops/order`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stopIds }),
      },
    ).catch(() => null);
    if (!response?.ok) {
      setMessage(await errorMessage(response, "No fue posible ordenar las visitas."));
      setIsError(true);
      setIsBusy(false);
      return;
    }
    setMessage("Orden de visitas actualizado.");
    setIsBusy(false);
    onChanged();
  }

  async function updateStopVisit(
    route: Route,
    stopId: string,
    status: "pending" | "visited" | "not_home",
  ) {
    setIsBusy(true);
    setMessage("");
    setIsError(false);
    const response = await sensitiveFetch(
      `/api/v1/tenants/${tenantId}/routes/${route.id}/stops/${stopId}/visit`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      },
    ).catch(() => null);
    if (!response?.ok) {
      setMessage(await errorMessage(response, "No fue posible actualizar la visita."));
      setIsError(true);
      setIsBusy(false);
      return;
    }
    setMessage(status === "visited" ? "Visita realizada." : "Estado actualizado.");
    setIsBusy(false);
    onChanged();
  }

  return (
    <section className="dashboard-card route-board-card" id="rutas">
      <div className="card-heading">
        <div>
          <span className="panel-eyebrow">Agenda automática</span>
          <h2>Visitas para cobrar</h2>
        </div>
        <span>{routes.length} ruta(s)</span>
      </div>
      {routes.length ? (
        <div className="route-board-list">
          {routes.map((route) => (
            <article className="route-board-item" key={route.id}>
              <div className="route-board-item-heading">
                <div>
                  <strong>
                    {route.serviceDate ? `Cobros del ${route.serviceDate}` : route.name}
                  </strong>
                  <small>{route.stops.length} visitas</small>
                  {route.assignedCollectorName ? (
                    <small>Cobrador: {route.assignedCollectorName}</small>
                  ) : null}
                </div>
                <span className="status status-active">Lista</span>
              </div>
              <ol className="route-stop-list">
                {route.stops.map((stop, index) => (
                  <li key={stop.id}>
                    <span>{stop.position}</span>
                    <div>
                      <strong>{stop.borrowerName}</strong>
                      <small>
                        {stop.addressKind === "home" ? "Casa" : "Trabajo"} · {stop.address}
                      </small>
                      <a
                        className="route-stop-navigation"
                        href={wazeUrl(stop.address, stop.latitude, stop.longitude)}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Abrir en Waze
                      </a>
                      <span className={`route-visit-status route-visit-${stop.visitStatus}`}>
                        {stop.visitStatus === "visited"
                          ? "Visita realizada"
                          : stop.visitStatus === "not_home"
                            ? "No estaba"
                            : "Pendiente"}
                      </span>
                      <div className="route-stop-visit-actions">
                        <button
                          className="button-link"
                          disabled={isBusy}
                          onClick={() =>
                            void updateStopVisit(
                              route,
                              stop.id,
                              stop.visitStatus === "visited" ? "pending" : "visited",
                            )
                          }
                          type="button"
                        >
                          {stop.visitStatus === "visited" ? "Deshacer visita" : "Marcar visita"}
                        </button>
                        <button
                          className="button-link"
                          disabled={isBusy}
                          onClick={() =>
                            void updateStopVisit(
                              route,
                              stop.id,
                              stop.visitStatus === "not_home" ? "pending" : "not_home",
                            )
                          }
                          type="button"
                        >
                          {stop.visitStatus === "not_home" ? "Reabrir" : "No estaba"}
                        </button>
                      </div>
                      {canReorder ? (
                        <div className="route-stop-order-actions">
                          <button
                            aria-label={`Subir ${stop.borrowerName}`}
                            disabled={isBusy || index === 0}
                            onClick={() => void reorderStops(route, index, -1)}
                            type="button"
                          >
                            ↑
                          </button>
                          <button
                            aria-label={`Bajar ${stop.borrowerName}`}
                            disabled={isBusy || index === route.stops.length - 1}
                            onClick={() => void reorderStops(route, index, 1)}
                            type="button"
                          >
                            ↓
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <span aria-hidden="true">✓</span>
          <h3>No hay una ruta por hacer</h3>
          <p>
            Se creará automáticamente cuando un cobrador tenga dos o más clientes con pago para el
            mismo día.
          </p>
        </div>
      )}
      {message ? (
        <p className={`tenant-form-message${isError ? " form-message-error" : ""}`} role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
