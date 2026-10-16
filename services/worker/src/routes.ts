import { randomUUID } from "node:crypto";
import {
  type CollectionRoutePlanner,
  orderByNearestNeighbor,
  type RoutePlanningStop,
} from "@cobranzapp/hermes-routes";
import type { Pool, PoolClient } from "pg";

export type RouteGenerationSummary = {
  tenantsChecked: number;
  tenantsGenerated: number;
  routesCreated: number;
  stopsCreated: number;
};

type TenantRow = {
  id: string;
  timezone: string;
  created_by: string;
};

type CandidateRow = {
  borrower_id: string;
  collector_id: string;
  collector_name: string;
  address_kind: "home" | "work";
  latitude: number | string | null;
  longitude: number | string | null;
};

type PlannedGroup = {
  collectorId: string;
  collectorName: string;
  orderedBorrowerIds: string[];
  addressKindByBorrower: Map<string, "home" | "work">;
  planner: "agent" | "fallback";
};

function dateParts(date: Date, timezone: string) {
  const values = new Map(
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return {
    date: `${values.get("year")}-${values.get("month")}-${values.get("day")}`,
    hour: Number(values.get("hour")),
  };
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function routeServiceDate(now: Date, timezone: string) {
  const local = dateParts(now, timezone);
  return local.hour >= 5 ? addDays(local.date, 1) : null;
}

async function claimRun(pool: Pool, tenantId: string, serviceDate: string) {
  const result = await pool.query<{ tenant_id: string }>(
    `INSERT INTO collection_route_generation_runs
       (tenant_id, service_date, status, started_at)
     VALUES ($1, $2, 'processing', now())
     ON CONFLICT (tenant_id, service_date) DO UPDATE
       SET status = 'processing', route_count = 0, stop_count = 0,
           planner = NULL, error_code = NULL, started_at = now(), completed_at = NULL
       WHERE collection_route_generation_runs.status = 'failed'
     RETURNING tenant_id`,
    [tenantId, serviceDate],
  );
  return Boolean(result.rows[0]);
}

async function loadCandidates(pool: Pool, tenantId: string, serviceDate: string) {
  const result = await pool.query<CandidateRow>(
    `SELECT DISTINCT ON (borrower.id)
            borrower.id AS borrower_id,
            borrower.assigned_collector_id AS collector_id,
            collector.display_name AS collector_name,
            CASE
              WHEN home_location.status = 'ready' THEN 'home'
              WHEN work_location.status = 'ready' THEN 'work'
              ELSE 'home'
            END AS address_kind,
            CASE
              WHEN home_location.status = 'ready' THEN home_location.latitude
              WHEN work_location.status = 'ready' THEN work_location.latitude
              ELSE NULL
            END AS latitude,
            CASE
              WHEN home_location.status = 'ready' THEN home_location.longitude
              WHEN work_location.status = 'ready' THEN work_location.longitude
              ELSE NULL
            END AS longitude
       FROM loan_applications application
       JOIN borrowers borrower
         ON borrower.tenant_id = application.tenant_id
        AND borrower.id = application.borrower_id
        AND borrower.status = 'active'
        AND borrower.assigned_collector_id IS NOT NULL
       JOIN borrower_identities identity
         ON identity.tenant_id = borrower.tenant_id
        AND identity.borrower_id = borrower.id
        AND identity.verification_state = 'reviewed'
       JOIN tenant_memberships membership
         ON membership.tenant_id = borrower.tenant_id
        AND membership.user_id = borrower.assigned_collector_id
        AND membership.role = 'collector'
        AND membership.status = 'active'
       JOIN users collector
         ON collector.id = borrower.assigned_collector_id
        AND collector.status = 'active'
       LEFT JOIN borrower_address_locations home_location
         ON home_location.tenant_id = borrower.tenant_id
        AND home_location.borrower_id = borrower.id
        AND home_location.address_kind = 'home'
       LEFT JOIN borrower_address_locations work_location
         ON work_location.tenant_id = borrower.tenant_id
        AND work_location.borrower_id = borrower.id
        AND work_location.address_kind = 'work'
      WHERE application.tenant_id = $1
        AND application.status = 'active'
        AND application.paid_installments < application.requested_term_count
        AND loan_installment_due_date(
              application.created_at::date,
              application.payment_frequency,
              application.paid_installments + 1
            ) <= $2::date
      ORDER BY borrower.id, application.created_at ASC, application.id ASC`,
    [tenantId, serviceDate],
  );
  return result.rows;
}

async function orderGroup(
  candidates: CandidateRow[],
  planner?: CollectionRoutePlanner,
): Promise<PlannedGroup> {
  const first = candidates[0];
  if (!first) throw new Error("ROUTE_CANDIDATES_REQUIRED");
  if (candidates.length > 500) throw new Error("ROUTE_STOP_LIMIT_EXCEEDED");
  const stops: RoutePlanningStop[] = candidates.map((candidate) => ({
    id: candidate.borrower_id,
    latitude: candidate.latitude === null ? null : Number(candidate.latitude),
    longitude: candidate.longitude === null ? null : Number(candidate.longitude),
  }));
  let orderedBorrowerIds: string[];
  let usedPlanner: "agent" | "fallback" = "fallback";
  if (planner) {
    try {
      orderedBorrowerIds = await planner.plan(stops);
      usedPlanner = "agent";
    } catch {
      orderedBorrowerIds = orderByNearestNeighbor(stops);
    }
  } else {
    orderedBorrowerIds = orderByNearestNeighbor(stops);
  }
  return {
    collectorId: first.collector_id,
    collectorName: first.collector_name,
    orderedBorrowerIds,
    addressKindByBorrower: new Map(
      candidates.map((candidate) => [candidate.borrower_id, candidate.address_kind]),
    ),
    planner: usedPlanner,
  };
}

async function persistRoutes(
  client: PoolClient,
  tenant: TenantRow,
  serviceDate: string,
  groups: PlannedGroup[],
) {
  let stopsCreated = 0;
  for (const group of groups) {
    const name = `Cobros ${serviceDate} · ${group.collectorName}`.slice(0, 120);
    const routeId = randomUUID();
    await client.query(
      `INSERT INTO collection_routes
         (tenant_id, id, name, description, status, assigned_collector_id, service_date,
          generation_mode, generated_at, created_by)
       VALUES ($1, $2, $3, NULL, 'active', $4, $5, 'automatic', now(), $6)`,
      [tenant.id, routeId, name, group.collectorId, serviceDate, tenant.created_by],
    );
    for (const [index, borrowerId] of group.orderedBorrowerIds.entries()) {
      await client.query(
        `INSERT INTO collection_route_stops
           (tenant_id, route_id, borrower_id, address_kind, position, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          tenant.id,
          routeId,
          borrowerId,
          group.addressKindByBorrower.get(borrowerId) ?? "home",
          index + 1,
          tenant.created_by,
        ],
      );
      stopsCreated += 1;
    }
    await client.query(
      `INSERT INTO audit_events
         (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
       VALUES ($1, NULL, 'collection_route.generated', 'collection_route', $2, $3, $4::jsonb)`,
      [
        tenant.id,
        routeId,
        `route-generation:${tenant.id}:${serviceDate}:${group.collectorId}:${randomUUID()}`,
        JSON.stringify({
          serviceDate,
          collectorId: group.collectorId,
          planner: group.planner,
          stopCount: group.orderedBorrowerIds.length,
        }),
      ],
    );
  }
  return stopsCreated;
}

async function generateTenant(
  pool: Pool,
  tenant: TenantRow,
  serviceDate: string,
  planner?: CollectionRoutePlanner,
) {
  if (!(await claimRun(pool, tenant.id, serviceDate))) return null;
  try {
    const candidates = await loadCandidates(pool, tenant.id, serviceDate);
    const byCollector = new Map<string, CandidateRow[]>();
    for (const candidate of candidates) {
      const group = byCollector.get(candidate.collector_id) ?? [];
      group.push(candidate);
      byCollector.set(candidate.collector_id, group);
    }
    const groups = await Promise.all(
      [...byCollector.values()].map((group) => orderGroup(group, planner)),
    );
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const stopsCreated = await persistRoutes(client, tenant, serviceDate, groups);
      const plannerName =
        groups.length > 0 && groups.every((group) => group.planner === "agent")
          ? "agent"
          : "fallback";
      await client.query(
        `UPDATE collection_route_generation_runs
            SET status = 'completed', route_count = $3, stop_count = $4,
                planner = $5, completed_at = now(), error_code = NULL
          WHERE tenant_id = $1 AND service_date = $2`,
        [tenant.id, serviceDate, groups.length, stopsCreated, plannerName],
      );
      await client.query("COMMIT");
      return { routesCreated: groups.length, stopsCreated };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    const code = (error instanceof Error ? error.message : "ROUTE_GENERATION_FAILED")
      .replaceAll(/[^A-Z0-9_]+/gi, "_")
      .slice(0, 120);
    await pool.query(
      `UPDATE collection_route_generation_runs
          SET status = 'failed', error_code = $3, completed_at = now()
        WHERE tenant_id = $1 AND service_date = $2`,
      [tenant.id, serviceDate, code],
    );
    throw error;
  }
}

export async function planNextDayRoutes(
  pool: Pool,
  planner: CollectionRoutePlanner | undefined,
  now = new Date(),
): Promise<RouteGenerationSummary> {
  const tenants = await pool.query<TenantRow>(
    `SELECT id, timezone, created_by FROM tenants WHERE status = 'active' ORDER BY id`,
  );
  const summary: RouteGenerationSummary = {
    tenantsChecked: tenants.rows.length,
    tenantsGenerated: 0,
    routesCreated: 0,
    stopsCreated: 0,
  };
  for (const tenant of tenants.rows) {
    const serviceDate = routeServiceDate(now, tenant.timezone);
    if (!serviceDate) continue;
    const generated = await generateTenant(pool, tenant, serviceDate, planner);
    if (!generated) continue;
    summary.tenantsGenerated += 1;
    summary.routesCreated += generated.routesCreated;
    summary.stopsCreated += generated.stopsCreated;
  }
  return summary;
}
