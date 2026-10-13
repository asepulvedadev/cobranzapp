import type {
  Route,
  RouteAssignmentUpdateRequest,
  RouteCreateRequest,
  RouteStatusUpdateRequest,
  RouteStopCreateRequest,
  RouteStopReorderRequest,
  RouteStopVisitRequest,
} from "@cobranzapp/contracts";
import type { Pool, PoolClient } from "pg";
import type { TenantActor } from "../tenancy/types.js";
import type {
  RouteAssignmentResult,
  RouteResult,
  RouteService,
  RouteStopReorderResult,
  RouteStopResult,
  RouteStopVisitResult,
} from "./types.js";

type RouteRow = {
  id: string;
  name: string;
  description: string | null;
  status: Route["status"];
  branch_id: string | null;
  branch_name: string | null;
  assigned_collector_id: string | null;
  assigned_collector_name: string | null;
  created_at: Date;
  updated_at: Date;
};

type StopRow = {
  id: string;
  borrower_id: string;
  borrower_name: string;
  address_kind: Route["stops"][number]["addressKind"];
  address: string;
  position: number;
  latitude: number | string | null;
  longitude: number | string | null;
  visit_status: Route["stops"][number]["visitStatus"];
  visited_at: Date | null;
  visit_notes: string | null;
};

function canManage(actor: TenantActor) {
  return actor.tenantRole === "owner" || actor.tenantRole === "supervisor";
}

function canRead(actor: TenantActor) {
  return canManage(actor) || actor.tenantRole === "collector";
}

async function setActorContext(client: PoolClient, actor: TenantActor, tenantId: string) {
  await client.query("SELECT set_config('app.user_id', $1, true)", [actor.userId]);
  await client.query("SELECT set_config('app.platform_role', $1, true)", [
    actor.platformRole ?? "",
  ]);
  await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
  await client.query("SELECT set_config('app.tenant_role', $1, true)", [actor.tenantRole ?? ""]);
}

function isUniqueViolation(error: unknown) {
  return error && typeof error === "object" && "code" in error && error.code === "23505";
}

async function loadRoute(client: Pick<PoolClient, "query">, tenantId: string, routeId: string) {
  const routeResult = await client.query<RouteRow>(
    `SELECT route.id, route.name, route.description, route.status,
            route.branch_id, branch.display_name AS branch_name,
            route.assigned_collector_id,
            assigned_user.display_name AS assigned_collector_name,
            route.created_at, route.updated_at
       FROM collection_routes route
       LEFT JOIN branches branch
         ON branch.tenant_id = route.tenant_id AND branch.id = route.branch_id
       LEFT JOIN users assigned_user
         ON assigned_user.id = route.assigned_collector_id
      WHERE route.tenant_id = $1 AND route.id = $2`,
    [tenantId, routeId],
  );
  const row = routeResult.rows[0];
  if (!row) return null;
  const stops = await client.query<StopRow>(
    `SELECT stop.id, stop.borrower_id, borrower.full_name AS borrower_name,
            stop.address_kind,
            CASE stop.address_kind WHEN 'home' THEN borrower.home_address ELSE borrower.work_address END AS address,
            stop.position, location.latitude, location.longitude,
            stop.visit_status, stop.visited_at, stop.visit_notes
       FROM collection_route_stops stop
       JOIN borrowers borrower
         ON borrower.tenant_id = stop.tenant_id AND borrower.id = stop.borrower_id
       LEFT JOIN borrower_address_locations location
         ON location.tenant_id = stop.tenant_id
        AND location.borrower_id = stop.borrower_id
        AND location.address_kind = stop.address_kind
      WHERE stop.tenant_id = $1 AND stop.route_id = $2
      ORDER BY stop.position ASC, stop.id ASC`,
    [tenantId, routeId],
  );
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    branchId: row.branch_id,
    branchName: row.branch_name,
    assignedCollectorId: row.assigned_collector_id,
    assignedCollectorName: row.assigned_collector_name,
    stops: stops.rows.map((stop) => ({
      id: stop.id,
      borrowerId: stop.borrower_id,
      borrowerName: stop.borrower_name,
      addressKind: stop.address_kind,
      address: stop.address,
      position: stop.position,
      latitude: stop.latitude === null ? null : Number(stop.latitude),
      longitude: stop.longitude === null ? null : Number(stop.longitude),
      visitStatus: stop.visit_status,
      visitedAt: stop.visited_at?.toISOString() ?? null,
      visitNotes: stop.visit_notes,
    })),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  } satisfies Route;
}

export function createPostgresRouteService(pool: Pool): RouteService {
  async function withTransaction<T>(
    actor: TenantActor,
    tenantId: string,
    work: (client: PoolClient) => Promise<T>,
  ) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await setActorContext(client, actor, tenantId);
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  return {
    async list(actor, tenantId) {
      if (!canRead(actor)) return [];
      return withTransaction(actor, tenantId, async (client) => {
        const result = await client.query<{ id: string }>(
          `SELECT id FROM collection_routes WHERE tenant_id = $1 ORDER BY updated_at DESC, id DESC`,
          [tenantId],
        );
        const routes: Route[] = [];
        for (const row of result.rows) {
          const route = await loadRoute(client, tenantId, row.id);
          if (route) routes.push(route);
        }
        return routes;
      });
    },

    async create(
      actor,
      tenantId,
      input: RouteCreateRequest & { requestId: string },
    ): Promise<RouteResult> {
      if (!canManage(actor)) return { status: "forbidden" };
      return withTransaction(actor, tenantId, async (client) => {
        try {
          const result = await client.query<{ id: string }>(
            `INSERT INTO collection_routes (tenant_id, name, description, branch_id, created_by)
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [tenantId, input.name, input.description, input.branchId, actor.userId],
          );
          const routeId = result.rows[0]?.id;
          if (!routeId) throw new Error("COLLECTION_ROUTE_NOT_CREATED");
          await client.query(
            `INSERT INTO audit_events (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
             VALUES ($1, $2, 'collection_route.created', 'collection_route', $3, $4, jsonb_build_object('status', 'draft'))`,
            [tenantId, actor.userId, routeId, input.requestId],
          );
          const route = await loadRoute(client, tenantId, routeId);
          if (!route) throw new Error("COLLECTION_ROUTE_NOT_CREATED");
          return { status: "created", route };
        } catch (error) {
          if (isUniqueViolation(error)) return { status: "duplicate" };
          throw error;
        }
      });
    },

    async addStop(
      actor,
      tenantId,
      routeId,
      input: RouteStopCreateRequest & { requestId: string },
    ): Promise<RouteStopResult> {
      if (!canManage(actor)) return { status: "forbidden" };
      return withTransaction(actor, tenantId, async (client) => {
        const route = await client.query<{ id: string }>(
          `SELECT id FROM collection_routes WHERE tenant_id = $1 AND id = $2`,
          [tenantId, routeId],
        );
        if (!route.rows[0]) return { status: "not_found" };
        const borrower = await client.query<{ id: string }>(
          `SELECT id FROM borrowers WHERE tenant_id = $1 AND id = $2 AND status = 'active'`,
          [tenantId, input.borrowerId],
        );
        if (!borrower.rows[0]) return { status: "borrower_not_found" };
        try {
          await client.query(
            `INSERT INTO collection_route_stops
               (tenant_id, route_id, borrower_id, address_kind, position, created_by)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [tenantId, routeId, input.borrowerId, input.addressKind, input.position, actor.userId],
          );
        } catch (error) {
          if (isUniqueViolation(error)) return { status: "duplicate_stop" };
          throw error;
        }
        await client.query(
          `UPDATE collection_routes SET updated_at = now() WHERE tenant_id = $1 AND id = $2`,
          [tenantId, routeId],
        );
        await client.query(
          `INSERT INTO audit_events (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
           VALUES ($1, $2, 'collection_route.stop_added', 'collection_route', $3, $4,
                   jsonb_build_object('borrowerId', $5, 'addressKind', $6, 'position', $7))`,
          [
            tenantId,
            actor.userId,
            routeId,
            input.requestId,
            input.borrowerId,
            input.addressKind,
            input.position,
          ],
        );
        const updated = await loadRoute(client, tenantId, routeId);
        if (!updated) return { status: "not_found" };
        return { status: "updated", route: updated };
      });
    },

    async reorderStops(
      actor,
      tenantId,
      routeId,
      input: RouteStopReorderRequest & { requestId: string },
    ): Promise<RouteStopReorderResult> {
      if (!canManage(actor)) return { status: "forbidden" };
      return withTransaction(actor, tenantId, async (client) => {
        const route = await client.query<{ id: string }>(
          `SELECT id FROM collection_routes WHERE tenant_id = $1 AND id = $2 FOR UPDATE`,
          [tenantId, routeId],
        );
        if (!route.rows[0]) return { status: "not_found" };
        const current = await client.query<{ id: string }>(
          `SELECT id FROM collection_route_stops
            WHERE tenant_id = $1 AND route_id = $2
            ORDER BY position ASC, id ASC
            FOR UPDATE`,
          [tenantId, routeId],
        );
        const currentIds = current.rows.map((row) => row.id);
        if (
          input.stopIds.length !== currentIds.length ||
          new Set(input.stopIds).size !== input.stopIds.length ||
          input.stopIds.some((id) => !currentIds.includes(id))
        ) {
          return { status: "invalid_order" };
        }
        await client.query(
          `UPDATE collection_route_stops
              SET position = position + 10000, updated_at = now()
            WHERE tenant_id = $1 AND route_id = $2`,
          [tenantId, routeId],
        );
        for (const [index, stopId] of input.stopIds.entries()) {
          await client.query(
            `UPDATE collection_route_stops
                SET position = $4, updated_at = now()
              WHERE tenant_id = $1 AND route_id = $2 AND id = $3`,
            [tenantId, routeId, stopId, index + 1],
          );
        }
        await client.query(
          `UPDATE collection_routes SET updated_at = now() WHERE tenant_id = $1 AND id = $2`,
          [tenantId, routeId],
        );
        await client.query(
          `INSERT INTO audit_events
             (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
           VALUES ($1, $2, 'collection_route.stops_reordered', 'collection_route', $3, $4, $5::jsonb)`,
          [
            tenantId,
            actor.userId,
            routeId,
            input.requestId,
            JSON.stringify({ stopIds: input.stopIds }),
          ],
        );
        const updated = await loadRoute(client, tenantId, routeId);
        return updated ? { status: "updated", route: updated } : { status: "not_found" };
      });
    },

    async updateStopVisit(
      actor,
      tenantId,
      routeId,
      stopId,
      input: RouteStopVisitRequest & { requestId: string },
    ): Promise<RouteStopVisitResult> {
      if (!canRead(actor)) return { status: "forbidden" };
      return withTransaction(actor, tenantId, async (client) => {
        const routeResult = await client.query<{
          id: string;
          assigned_collector_id: string | null;
        }>(
          `SELECT id, assigned_collector_id
             FROM collection_routes
            WHERE tenant_id = $1 AND id = $2
            FOR UPDATE`,
          [tenantId, routeId],
        );
        const route = routeResult.rows[0];
        if (!route) return { status: "not_found" };
        if (actor.tenantRole === "collector" && route.assigned_collector_id !== actor.userId) {
          return { status: "forbidden" };
        }
        const stop = await client.query<{ id: string }>(
          `SELECT id
             FROM collection_route_stops
            WHERE tenant_id = $1 AND route_id = $2 AND id = $3
            FOR UPDATE`,
          [tenantId, routeId, stopId],
        );
        if (!stop.rows[0]) return { status: "not_found" };
        const notes = input.notes?.trim() || null;
        await client.query(
          `UPDATE collection_route_stops
              SET visit_status = $4,
                  visited_at = CASE WHEN $4 = 'pending' THEN NULL ELSE now() END,
                  visited_by = CASE WHEN $4 = 'pending' THEN NULL ELSE $5 END,
                  visit_notes = $6,
                  updated_at = now()
            WHERE tenant_id = $1 AND route_id = $2 AND id = $3`,
          [tenantId, routeId, stopId, input.status, actor.userId, notes],
        );
        await client.query(
          `UPDATE collection_routes SET updated_at = now() WHERE tenant_id = $1 AND id = $2`,
          [tenantId, routeId],
        );
        await client.query(
          `INSERT INTO audit_events
             (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
           VALUES ($1, $2, 'collection_route.stop_visit_updated', 'collection_route_stop', $3, $4, $5::jsonb)`,
          [
            tenantId,
            actor.userId,
            stopId,
            input.requestId,
            JSON.stringify({ routeId, status: input.status, hasNotes: Boolean(notes) }),
          ],
        );
        const updated = await loadRoute(client, tenantId, routeId);
        return updated ? { status: "updated", route: updated } : { status: "not_found" };
      });
    },

    async updateStatus(
      actor,
      tenantId,
      routeId,
      input: RouteStatusUpdateRequest & { requestId: string },
    ) {
      if (!canManage(actor)) return { status: "forbidden" };
      return withTransaction(actor, tenantId, async (client) => {
        const currentResult = await client.query<{
          id: string;
          status: Route["status"];
        }>(
          `SELECT id, status
             FROM collection_routes
            WHERE tenant_id = $1 AND id = $2
            FOR UPDATE`,
          [tenantId, routeId],
        );
        const current = currentResult.rows[0];
        if (!current) return { status: "not_found" };

        if (input.status === "active" && current.status === "draft") {
          const countResult = await client.query<{ count: string }>(
            `SELECT count(*) AS count
               FROM collection_route_stops
              WHERE tenant_id = $1 AND route_id = $2`,
            [tenantId, routeId],
          );
          if (Number(countResult.rows[0]?.count ?? 0) === 0) {
            return { status: "invalid_transition", reason: "empty_route" };
          }
        }

        const transitionAllowed =
          current.status === input.status ||
          (current.status === "draft" && input.status === "active") ||
          (current.status === "active" && input.status === "archived");
        if (!transitionAllowed) {
          return { status: "invalid_transition", reason: "invalid_transition" };
        }
        if (current.status !== input.status) {
          await client.query(
            `UPDATE collection_routes
                SET status = $3, updated_at = now()
              WHERE tenant_id = $1 AND id = $2`,
            [tenantId, routeId, input.status],
          );
          await client.query(
            `INSERT INTO audit_events (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
             VALUES ($1, $2, 'collection_route.status_changed', 'collection_route', $3, $4,
                     jsonb_build_object('from', $5::text, 'to', $6::text))`,
            [tenantId, actor.userId, routeId, input.requestId, current.status, input.status],
          );
        }
        const route = await loadRoute(client, tenantId, routeId);
        if (!route) return { status: "not_found" };
        return { status: "updated", route };
      });
    },

    async assignCollector(
      actor,
      tenantId,
      routeId,
      input: RouteAssignmentUpdateRequest & { requestId: string },
    ): Promise<RouteAssignmentResult> {
      if (!canManage(actor)) return { status: "forbidden" };
      return withTransaction(actor, tenantId, async (client) => {
        const routeResult = await client.query<{ id: string }>(
          `SELECT id
             FROM collection_routes
            WHERE tenant_id = $1 AND id = $2
            FOR UPDATE`,
          [tenantId, routeId],
        );
        if (!routeResult.rows[0]) return { status: "not_found" };

        if (input.collectorId) {
          const membershipResult = await client.query<{
            role: string;
            status: string;
          }>(
            `SELECT role, status
               FROM tenant_memberships
              WHERE tenant_id = $1 AND user_id = $2`,
            [tenantId, input.collectorId],
          );
          const membership = membershipResult.rows[0];
          if (membership?.role !== "collector") {
            return { status: "collector_not_found" };
          }
          if (membership.status !== "active") {
            return { status: "collector_inactive" };
          }
        }

        await client.query(
          `UPDATE collection_routes
              SET assigned_collector_id = $3, updated_at = now()
            WHERE tenant_id = $1 AND id = $2`,
          [tenantId, routeId, input.collectorId],
        );
        await client.query(
          `INSERT INTO audit_events (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
           VALUES ($1, $2, 'collection_route.assignment_changed', 'collection_route', $3, $4,
                   jsonb_build_object('collectorId', $5::text))`,
          [tenantId, actor.userId, routeId, input.requestId, input.collectorId],
        );
        const route = await loadRoute(client, tenantId, routeId);
        if (!route) return { status: "not_found" };
        return { status: "updated", route };
      });
    },
  };
}
