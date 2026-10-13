"use client";

import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import type { BorrowerDirectory, Route, TenantOverview } from "../../../../lib/platform";
import { useSensitiveFetch } from "../../ReauthenticationProvider";
import { CollectionRouteBoard } from "./CollectionRouteBoard";

export function RouteWorkspace({
  actorRole,
  collectors,
  settings,
  tenantId,
  tenantName,
}: {
  actorRole: TenantOverview["actorRole"];
  collectors: TenantOverview["members"];
  settings: TenantOverview["settings"];
  tenantId: string;
  tenantName: string;
}) {
  const sensitiveFetch = useSensitiveFetch();
  const sensitiveFetchRef = useRef(sensitiveFetch);
  sensitiveFetchRef.current = sensitiveFetch;
  const [routes, setRoutes] = useState<Route[] | null>(null);
  const [borrowers, setBorrowers] = useState<BorrowerDirectory | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setMessage("");
    const request = sensitiveFetchRef.current;
    const [routesResponse, borrowersResponse] = await Promise.all([
      request(`/api/v1/tenants/${tenantId}/routes`),
      request(`/api/v1/tenants/${tenantId}/borrowers?page=1&pageSize=100`),
    ]);
    if (!routesResponse?.ok || !borrowersResponse?.ok) {
      setMessage(
        "No fue posible cargar las rutas. Confirma tu contraseña cuando aparezca la ventana de seguridad y vuelve a intentarlo.",
      );
      return;
    }
    const routesBody = (await routesResponse.json()) as { routes: Route[] };
    const borrowersBody = (await borrowersResponse.json()) as BorrowerDirectory;
    setRoutes(routesBody.routes);
    setBorrowers(borrowersBody);
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
          <h1>Rutas de cobranza</h1>
          <p>Organiza las visitas por dirección y abre la navegación en Waze.</p>
        </div>
      </header>
      {routes && borrowers ? (
        <CollectionRouteBoard
          borrowers={borrowers.borrowers}
          canManage={actorRole === "owner" || actorRole === "supervisor"}
          collectors={collectors.filter((member) => member.role === "collector")}
          onChanged={() => void load()}
          routes={routes}
          tenantId={tenantId}
        />
      ) : (
        <section className="dashboard-card">
          <h2>{message ? "No se pudieron cargar las rutas" : "Cargando rutas…"}</h2>
          <p className="operational-note">
            {message ?? "Estamos consultando clientes y rutas asignadas."}
          </p>
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
