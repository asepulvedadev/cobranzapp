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

async function errorMessage(response: Response | null, fallback: string) {
  const body = (await response?.json().catch(() => ({}))) as {
    error?: { message?: string };
  };
  return body.error?.message ?? fallback;
}

export function CollectionRouteBoard({
  branches,
  borrowers,
  canManage,
  routes,
  tenantId,
}: {
  branches: TenantOverview["branches"];
  borrowers: Borrower[];
  canManage: boolean;
  routes: Route[];
  tenantId: string;
}) {
  const router = useRouter();
  const sensitiveFetch = useSensitiveFetch();
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [selectedRouteId, setSelectedRouteId] = useState(routes[0]?.id ?? "");

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
    router.refresh();
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
    router.refresh();
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
      <p className="operational-note">
        Organiza visitas por empresa y dirección. Esta versión solo planifica: no registra pagos,
        efectivo, geolocalización ni operación sin conexión.
      </p>

      {routes.length ? (
        <div className="route-board-list">
          {routes.map((route) => (
            <article className="route-board-item" key={route.id}>
              <div className="route-board-item-heading">
                <div>
                  <strong>{route.name}</strong>
                  <small>
                    {route.branchName ?? "Sin sede"} · {route.stops.length} parada(s)
                  </small>
                </div>
                <span className={`status status-${route.status}`}>
                  {statusLabels[route.status]}
                </span>
              </div>
              {route.description ? <p>{route.description}</p> : null}
              {route.stops.length ? (
                <ol className="route-stop-list">
                  {route.stops.map((stop) => (
                    <li key={stop.id}>
                      <span>{stop.position}</span>
                      <div>
                        <strong>{stop.borrowerName}</strong>
                        <small>
                          {stop.addressKind === "home" ? "Casa" : "Trabajo"} · {stop.address}
                        </small>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="structure-empty">Aún no hay clientes en esta ruta.</p>
              )}
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
            <label htmlFor="route-branch">Sede</label>
            <select defaultValue="" id="route-branch" name="branchId">
              <option value="">Sin sede asignada</option>
              {branches
                .filter((branch) => branch.status === "active")
                .map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.displayName}
                  </option>
                ))}
            </select>
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
