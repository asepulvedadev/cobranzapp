import type {
  Route,
  RouteAssignmentUpdateRequest,
  RouteCreateRequest,
  RouteStatusUpdateRequest,
  RouteStopCreateRequest,
  RouteStopReorderRequest,
} from "@cobranzapp/contracts";
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

export type RouteStopReorderResult =
  | { status: "updated"; route: Route }
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "invalid_order" };

export type RouteStatusUpdateResult =
  | { status: "updated"; route: Route }
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "invalid_transition"; reason: "empty_route" | "invalid_transition" };

export type RouteAssignmentResult =
  | { status: "updated"; route: Route }
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "collector_not_found" }
  | { status: "collector_inactive" };

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
  reorderStops(
    actor: TenantActor,
    tenantId: string,
    routeId: string,
    input: RouteStopReorderRequest & { requestId: string },
  ): Promise<RouteStopReorderResult>;
  updateStatus(
    actor: TenantActor,
    tenantId: string,
    routeId: string,
    input: RouteStatusUpdateRequest & { requestId: string },
  ): Promise<RouteStatusUpdateResult>;
  assignCollector(
    actor: TenantActor,
    tenantId: string,
    routeId: string,
    input: RouteAssignmentUpdateRequest & { requestId: string },
  ): Promise<RouteAssignmentResult>;
}
