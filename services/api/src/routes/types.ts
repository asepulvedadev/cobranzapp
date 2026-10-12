import type { Route, RouteCreateRequest, RouteStopCreateRequest } from "@cobranzapp/contracts";
import type { TenantActor } from "../tenancy/types.js";

export type RouteResult =
  | { status: "created"; route: Route }
  | { status: "duplicate" }
  | { status: "forbidden" };

export type RouteStopResult =
  | { status: "updated"; route: Route }
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "borrower_not_found" }
  | { status: "duplicate_stop" };

export interface RouteService {
  list(actor: TenantActor, tenantId: string): Promise<Route[]>;
  create(
    actor: TenantActor,
    tenantId: string,
    input: RouteCreateRequest & { requestId: string },
  ): Promise<RouteResult>;
  addStop(
    actor: TenantActor,
    tenantId: string,
    routeId: string,
    input: RouteStopCreateRequest & { requestId: string },
  ): Promise<RouteStopResult>;
}
