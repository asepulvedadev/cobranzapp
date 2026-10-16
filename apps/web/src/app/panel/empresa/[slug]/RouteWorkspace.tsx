"use client";

import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import type { Route, TenantOverview } from "../../../../lib/platform";
import { useSensitiveFetch } from "../../ReauthenticationProvider";
import { CollectionRouteBoard } from "./CollectionRouteBoard";

export function RouteWorkspace({
  actorRole,
  settings,
  tenantId,
  tenantName,
}: {
  actorRole: TenantOverview["actorRole"];
  settings: TenantOverview["settings"];
  tenantId: string;
  tenantName: string;
}) {
  const sensitiveFetch = useSensitiveFetch();
  const sensitiveFetchRef = useRef(sensitiveFetch);
  sensitiveFetchRef.current = sensitiveFetch;
  const [routes, setRoutes] = useState<Route[] | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setMessage("");
    const request = sensitiveFetchRef.current;
    const routesResponse = await request(`/api/v1/tenants/${tenantId}/routes`);
    if (!routesResponse?.ok) {
      setMessage("No fue posible cargar las visitas. Intenta nuevamente.");
      return;
    }
    const routesBody = (await routesResponse.json()) as { routes: Route[] };
    setRoutes(
      routesBody.routes.filter(
        (route) =>
          route.generationMode === "automatic" &&
          route.status === "active" &&
          route.stops.length > 1,
      ),
    );
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div
      className="dashboard-page tenant-subpage route-workspace"
      style={
        {
          "--tenant-brand-primary": settings.primaryColor,
          "--tenant-brand-accent": settings.accentColor,
        } as CSSProperties
      }
    >
      <header className="dashboard-header">
        <div>
          <span className="panel-eyebrow">{tenantName}</span>
          <h1>Visitas para cobrar</h1>
        </div>
      </header>
      {routes ? (
        <CollectionRouteBoard
          canReorder={
            actorRole === "owner" || actorRole === "supervisor" || actorRole === "collector"
          }
          onChanged={() => void load()}
          routes={routes}
          tenantId={tenantId}
        />
      ) : (
        <section className="dashboard-card">
          <h2>{message ? "No se pudieron cargar las visitas" : "Cargando visitas…"}</h2>
          {message ? <p className="tenant-form-message form-message-error">{message}</p> : null}
          {message ? (
            <button onClick={() => void load()} type="button">
              Reintentar
            </button>
          ) : null}
        </section>
      )}
    </div>
  );
}
