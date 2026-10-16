"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import type { Borrower, Route, TenantOverview } from "../../../../lib/platform";
import { useSensitiveFetch } from "../../ReauthenticationProvider";

const statusLabels: Record<Route["status"], string> = {
  draft: "Borrador",
  active: "Activa",
  archived: "Archivada",
};

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
  borrowers,
  canManage,
  canReorder,
  collectors,
  onChanged,
  routes,
  tenantId,
}: {
  borrowers: Borrower[];
  canManage: boolean;
  canReorder: boolean;
  collectors: TenantOverview["members"];
  onChanged?: () => void;
  routes: Route[];
  tenantId: string;
}) {
  const router = useRouter();
  const sensitiveFetch = useSensitiveFetch();
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [assignmentBusyRouteId, setAssignmentBusyRouteId] = useState<string | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState(routes[0]?.id ?? "");

  function refreshData() {
    if (onChanged) onChanged();
    else router.refresh();
  }

  async function createRoute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsBusy(true);
    setMessage("");
    setIsError(false);
    const form = new FormData(event.currentTarget);
    const response = await sensitiveFetch(`/api/v1/tenants/${tenantId}/routes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: String(form.get("name") ?? "").trim(),
        description: String(form.get("description") ?? "").trim() || null,
        branchId: String(form.get("branchId") ?? "") || null,
      }),
    }).catch(() => null);
    if (!response?.ok) {
      setMessage(await errorMessage(response, "No fue posible crear la ruta."));
      setIsError(true);
      setIsBusy(false);
      return;
    }
    const body = (await response.json()) as { route: Route };
    setSelectedRouteId(body.route.id);
    event.currentTarget.reset();
    setMessage("Ruta creada como borrador. Agrega sus paradas antes de activarla.");
    setIsBusy(false);
    refreshData();
  }

  async function addStop(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const route = routes.find((item) => item.id === selectedRouteId);
    if (!route) {
      setMessage("Selecciona una ruta antes de agregar un cliente.");
      setIsError(true);
      return;
    }
    setIsBusy(true);
    setMessage("");
    setIsError(false);
    const form = new FormData(event.currentTarget);
    const response = await sensitiveFetch(`/api/v1/tenants/${tenantId}/routes/${route.id}/stops`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        borrowerId: String(form.get("borrowerId") ?? ""),
        addressKind: String(form.get("addressKind") ?? "home"),
        position: route.stops.length + 1,
      }),
    }).catch(() => null);
    if (!response?.ok) {
      setMessage(await errorMessage(response, "No fue posible agregar la parada."));
      setIsError(true);
      setIsBusy(false);
      return;
    }
    event.currentTarget.reset();
    setMessage("Cliente agregado a la ruta.");
    setIsBusy(false);
    refreshData();
  }

  async function updateStatus(route: Route, status: "active" | "archived") {
    setIsBusy(true);
    setMessage("");
    setIsError(false);
    const response = await sensitiveFetch(`/api/v1/tenants/${tenantId}/routes/${route.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    }).catch(() => null);
    if (!response?.ok) {
      setMessage(
        await errorMessage(
          response,
          status === "active"
            ? "No fue posible activar la ruta."
            : "No fue posible archivar la ruta.",
        ),
      );
      setIsError(true);
      setIsBusy(false);
      return;
    }
    setMessage(status === "active" ? "Ruta activada." : "Ruta archivada.");
    setIsBusy(false);
    refreshData();
  }

  async function assignCollector(event: FormEvent<HTMLFormElement>, route: Route) {
    event.preventDefault();
    setAssignmentBusyRouteId(route.id);
    setMessage("");
    setIsError(false);
    const form = new FormData(event.currentTarget);
    const collectorId = String(form.get("collectorId") ?? "").trim() || null;
    const response = await sensitiveFetch(
      `/api/v1/tenants/${tenantId}/routes/${route.id}/assignment`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ collectorId }),
      },
    ).catch(() => null);
    if (!response?.ok) {
      setMessage(await errorMessage(response, "No fue posible asignar el cobrador."));
      setIsError(true);
      setAssignmentBusyRouteId(null);
      return;
    }
    setMessage(collectorId ? "Cobrador asignado a la ruta." : "Asignación retirada.");
    setAssignmentBusyRouteId(null);
    refreshData();
  }

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
      setMessage(await errorMessage(response, "No fue posible ordenar las paradas."));
      setIsError(true);
      setIsBusy(false);
      return;
    }
    setMessage("Orden de paradas actualizado.");
    setIsBusy(false);
    refreshData();
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
    refreshData();
  }

  async function optimizeRoute(route: Route) {
    setIsBusy(true);
    setMessage("");
    setIsError(false);
    const response = await sensitiveFetch(
      `/api/v1/tenants/${tenantId}/routes/${route.id}/stops/optimize`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      },
    ).catch(() => null);
    if (!response?.ok) {
      setMessage(
        await errorMessage(response, "Ubica todas las direcciones antes de optimizar la ruta."),
      );
      setIsError(true);
      setIsBusy(false);
      return;
    }
    setMessage("Ruta ordenada por cercanía.");
    setIsBusy(false);
    refreshData();
  }

  return (
    <section className="dashboard-card route-board-card" id="rutas">
      <div className="card-heading">
        <div>
          <span className="panel-eyebrow">Planeación operativa</span>
          <h2>Rutas de cobranza</h2>
        </div>
        <span>{routes.length} configuradas</span>
      </div>
      {routes.length ? (
        <div className="route-board-list">
          {routes.map((route) => (
            <article className="route-board-item" key={route.id}>
              <div className="route-board-item-heading">
                <div>
                  <strong>{route.name}</strong>
                  <small>{route.stops.length} parada(s)</small>
                  {route.serviceDate ? <small>Fecha: {route.serviceDate}</small> : null}
                  <small>
                    {route.assignedCollectorName
                      ? `Cobrador: ${route.assignedCollectorName}`
                      : "Sin cobrador asignado"}
                  </small>
                </div>
                <span className={`status status-${route.status}`}>
                  {statusLabels[route.status]}
                </span>
              </div>
              {route.description ? <p>{route.description}</p> : null}
              {route.stops.length ? (
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
                          Navegar en Waze
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
                          {stop.visitStatus !== "not_home" ? (
                            <button
                              className="button-link"
                              disabled={isBusy}
                              onClick={() => void updateStopVisit(route, stop.id, "not_home")}
                              type="button"
                            >
                              No estaba
                            </button>
                          ) : (
                            <button
                              className="button-link"
                              disabled={isBusy}
                              onClick={() => void updateStopVisit(route, stop.id, "pending")}
                              type="button"
                            >
                              Reabrir
                            </button>
                          )}
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
              ) : (
                <p className="structure-empty">Aún no hay clientes en esta ruta.</p>
              )}
              {canManage ? (
                <div className="route-board-actions">
                  <form
                    className="route-assignment-form"
                    onSubmit={(event) => assignCollector(event, route)}
                  >
                    <label htmlFor={`route-collector-${route.id}`}>Cobrador</label>
                    <select
                      defaultValue={route.assignedCollectorId ?? ""}
                      id={`route-collector-${route.id}`}
                      name="collectorId"
                    >
                      <option value="">Sin asignar</option>
                      {collectors.map((collector) => (
                        <option key={collector.userId} value={collector.userId}>
                          {collector.displayName}
                        </option>
                      ))}
                    </select>
                    <button
                      className="button-link"
                      disabled={assignmentBusyRouteId === route.id}
                      type="submit"
                    >
                      {assignmentBusyRouteId === route.id ? "Guardando…" : "Guardar"}
                    </button>
                  </form>
                  {route.status === "draft" ? (
                    <button
                      className="button-link"
                      disabled={isBusy || route.stops.length === 0}
                      onClick={() => void updateStatus(route, "active")}
                      title={
                        route.stops.length === 0
                          ? "Agrega al menos una parada para activar la ruta."
                          : undefined
                      }
                      type="button"
                    >
                      Activar ruta
                    </button>
                  ) : null}
                  {route.stops.length > 1 ? (
                    <button
                      className="button-link"
                      disabled={isBusy}
                      onClick={() => void optimizeRoute(route)}
                      type="button"
                    >
                      Optimizar por cercanía
                    </button>
                  ) : null}
                  {route.status === "active" ? (
                    <button
                      className="button-link"
                      disabled={isBusy}
                      onClick={() => void updateStatus(route, "archived")}
                      type="button"
                    >
                      Archivar ruta
                    </button>
                  ) : null}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <span aria-hidden="true">◇</span>
          <h3>Aún no hay rutas</h3>
          <p>Crea un borrador y agrega clientes activos desde el directorio disponible.</p>
        </div>
      )}

      {canManage ? (
        <div className="route-board-forms">
          <form className="tenant-form compact-form" onSubmit={createRoute}>
            <h3>Nueva ruta</h3>
            <label htmlFor="route-name">Nombre</label>
            <input id="route-name" maxLength={120} name="name" placeholder="Ruta Centro" required />
            <label htmlFor="route-description">Descripción</label>
            <input
              id="route-description"
              maxLength={240}
              name="description"
              placeholder="Zona y horario"
            />
            <button disabled={isBusy} type="submit">
              {isBusy ? "Guardando…" : "Crear borrador"}
            </button>
          </form>

          <form className="tenant-form compact-form" onSubmit={addStop}>
            <h3>Agregar parada</h3>
            <label htmlFor="route-select">Ruta</label>
            <select
              id="route-select"
              name="routeId"
              onChange={(event) => setSelectedRouteId(event.target.value)}
              value={selectedRouteId}
            >
              <option value="">Selecciona una ruta</option>
              {routes
                .filter((route) => route.status !== "archived")
                .map((route) => (
                  <option key={route.id} value={route.id}>
                    {route.name}
                  </option>
                ))}
            </select>
            <label htmlFor="route-borrower">Cliente activo</label>
            <select id="route-borrower" name="borrowerId" required>
              <option value="">Selecciona un cliente</option>
              {borrowers
                .filter((borrower) => borrower.status === "active")
                .map((borrower) => (
                  <option key={borrower.id} value={borrower.id}>
                    {borrower.fullName}
                  </option>
                ))}
            </select>
            <label htmlFor="route-address-kind">Dirección de visita</label>
            <select defaultValue="home" id="route-address-kind" name="addressKind">
              <option value="home">Casa</option>
              <option value="work">Trabajo</option>
            </select>
            <button disabled={isBusy || !routes.length || !borrowers.length} type="submit">
              {isBusy ? "Guardando…" : "Agregar parada"}
            </button>
          </form>
        </div>
      ) : null}
      {message ? (
        <p className={`tenant-form-message${isError ? " form-message-error" : ""}`} role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
