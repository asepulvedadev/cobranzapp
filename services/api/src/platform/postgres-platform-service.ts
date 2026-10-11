import type { Pool, PoolClient } from "pg";
import type {
  PlatformOverview,
  PlatformService,
  TenantDirectory,
  TenantStatus,
  TenantStatusUpdateResult,
} from "./types.js";

async function setPlatformContext(client: Pick<PoolClient, "query">, actorUserId: string) {
  await client.query("SELECT set_config('app.user_id', $1, true)", [actorUserId]);
  await client.query("SELECT set_config('app.platform_role', 'developer', true)");
}

type TenantRow = {
  id: string;
  slug: string;
  display_name: string;
  status: PlatformOverview["tenants"][number]["status"];
  members: string;
  active_owner: boolean;
  active_branch: boolean;
  contact_email: boolean;
  created_at: Date;
};

function mapTenant(tenant: TenantRow): PlatformOverview["tenants"][number] {
  return {
    id: tenant.id,
    slug: tenant.slug,
    displayName: tenant.display_name,
    status: tenant.status,
    members: Number(tenant.members),
    readiness: {
      activeOwner: tenant.active_owner,
      activeBranch: tenant.active_branch,
      contactEmail: tenant.contact_email,
    },
    createdAt: tenant.created_at.toISOString(),
  };
}

export function createPostgresPlatformService(pool: Pool): PlatformService {
  return {
    async systemStatus() {
      const result = await pool.query<{ schema_version: string | null; checked_at: Date }>(
        `SELECT max(name) AS schema_version, now() AS checked_at
           FROM schema_migrations`,
      );
      const status = result.rows[0];
      if (!status) throw new Error("Database status query did not return a record");
      return {
        schemaVersion: status.schema_version,
        checkedAt: status.checked_at.toISOString(),
      };
    },

    async overview(actorUserId) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await setPlatformContext(client, actorUserId);
        const metricsResult = await client.query<{
          tenants: string;
          active_tenants: string;
          users: string;
          active_memberships: string;
        }>(
          `SELECT
              (SELECT count(*) FROM tenants) AS tenants,
              (SELECT count(*) FROM tenants WHERE status = 'active') AS active_tenants,
              (SELECT count(*) FROM users WHERE status = 'active') AS users,
              (SELECT count(*) FROM tenant_memberships WHERE status = 'active') AS active_memberships`,
        );
        const tenantsResult = await client.query<TenantRow>(
          `SELECT tenant.id, tenant.slug, tenant.display_name, tenant.status,
                    count(membership.user_id) FILTER (WHERE membership.status = 'active') AS members,
                    EXISTS (
                      SELECT 1 FROM tenant_memberships owner_membership
                       WHERE owner_membership.tenant_id = tenant.id
                         AND owner_membership.role = 'owner'
                         AND owner_membership.status = 'active'
                    ) AS active_owner,
                    EXISTS (
                      SELECT 1 FROM branches branch
                       WHERE branch.tenant_id = tenant.id AND branch.status = 'active'
                    ) AS active_branch,
                    EXISTS (
                      SELECT 1 FROM tenant_settings settings
                       WHERE settings.tenant_id = tenant.id AND settings.contact_email IS NOT NULL
                    ) AS contact_email,
                    tenant.created_at
               FROM tenants tenant
               LEFT JOIN tenant_memberships membership ON membership.tenant_id = tenant.id
              GROUP BY tenant.id
              ORDER BY tenant.created_at DESC
          LIMIT 100`,
        );
        const activityResult = await client.query<{
          id: string;
          action: string;
          actor_display_name: string | null;
          actor_username: string | null;
          tenant_id: string | null;
          tenant_name: string | null;
          happened_at: Date;
        }>(
          `SELECT event.id, event.action,
                  actor.display_name AS actor_display_name,
                  actor.username AS actor_username,
                  tenant.id AS tenant_id,
                  tenant.display_name AS tenant_name,
                  event.happened_at
             FROM audit_events event
             LEFT JOIN users actor ON actor.id = event.actor_user_id
             LEFT JOIN tenants tenant ON tenant.id = event.tenant_id
            ORDER BY event.happened_at DESC, event.id DESC
            LIMIT 12`,
        );
        await client.query("COMMIT");
        const metrics = metricsResult.rows[0];
        return {
          metrics: {
            tenants: Number(metrics?.tenants ?? 0),
            activeTenants: Number(metrics?.active_tenants ?? 0),
            users: Number(metrics?.users ?? 0),
            activeMemberships: Number(metrics?.active_memberships ?? 0),
          },
          tenants: tenantsResult.rows.map(mapTenant),
          activity: activityResult.rows.map((event) => ({
            id: event.id,
            action: event.action,
            actorDisplayName: event.actor_display_name,
            actorUsername: event.actor_username,
            tenantId: event.tenant_id,
            tenantName: event.tenant_name,
            happenedAt: event.happened_at.toISOString(),
          })),
        };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async listTenants(actorUserId, query) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await setPlatformContext(client, actorUserId);
        const filter = `($1::text IS NULL OR tenant.display_name ILIKE '%' || $1 || '%'
                         OR tenant.slug::text ILIKE '%' || $1 || '%')
                        AND ($2::text IS NULL OR tenant.status = $2)`;
        const countResult = await client.query<{ total: string }>(
          `SELECT count(*) AS total
               FROM tenants tenant
              WHERE ${filter}`,
          [query.search, query.status],
        );
        const total = Number(countResult.rows[0]?.total ?? 0);
        const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
        const page = Math.min(query.page, totalPages);
        const offset = (page - 1) * query.pageSize;
        const tenantsResult = await client.query<TenantRow>(
          `SELECT tenant.id, tenant.slug, tenant.display_name, tenant.status,
                    count(membership.user_id) FILTER (WHERE membership.status = 'active') AS members,
                    EXISTS (
                      SELECT 1 FROM tenant_memberships owner_membership
                       WHERE owner_membership.tenant_id = tenant.id
                         AND owner_membership.role = 'owner'
                         AND owner_membership.status = 'active'
                    ) AS active_owner,
                    EXISTS (
                      SELECT 1 FROM branches branch
                       WHERE branch.tenant_id = tenant.id AND branch.status = 'active'
                    ) AS active_branch,
                    EXISTS (
                      SELECT 1 FROM tenant_settings settings
                       WHERE settings.tenant_id = tenant.id AND settings.contact_email IS NOT NULL
                    ) AS contact_email,
                    tenant.created_at
               FROM tenants tenant
               LEFT JOIN tenant_memberships membership ON membership.tenant_id = tenant.id
              WHERE ${filter}
              GROUP BY tenant.id
              ORDER BY tenant.created_at DESC, tenant.id DESC
              LIMIT $3 OFFSET $4`,
          [query.search, query.status, query.pageSize, offset],
        );
        await client.query("COMMIT");
        return {
          tenants: tenantsResult.rows.map(mapTenant),
          pagination: {
            page,
            pageSize: query.pageSize,
            total,
            totalPages,
          },
        } satisfies TenantDirectory;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async createTenant(actorUserId, input) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await setPlatformContext(client, actorUserId);
        const result = await client.query<{
          id: string;
          slug: string;
          display_name: string;
          status: PlatformOverview["tenants"][number]["status"];
          created_at: Date;
        }>(
          `INSERT INTO tenants (slug, display_name, created_by)
           VALUES ($1, $2, $3)
           RETURNING id, slug, display_name, status, created_at`,
          [input.slug, input.displayName, actorUserId],
        );
        const tenant = result.rows[0];
        if (!tenant) throw new Error("Tenant insert did not return a record");
        await client.query(
          `INSERT INTO tenant_settings (tenant_id, updated_by)
           VALUES ($1, $2)`,
          [tenant.id, actorUserId],
        );
        await client.query(
          `INSERT INTO tenant_setting_versions (
             tenant_id, version, primary_color, accent_color, contact_email,
             contact_phone, address, changed_by, changed_at
           )
           SELECT tenant_id, version, primary_color, accent_color, contact_email,
                  contact_phone, address, updated_by, updated_at
             FROM tenant_settings
            WHERE tenant_id = $1`,
          [tenant.id],
        );
        await client.query(
          `INSERT INTO audit_events (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
           VALUES ($1, $2, 'tenant.created', 'tenant', $1, $3, jsonb_build_object('slug', $4::text))`,
          [tenant.id, actorUserId, input.requestId, tenant.slug],
        );
        await client.query("COMMIT");
        return {
          id: tenant.id,
          slug: tenant.slug,
          displayName: tenant.display_name,
          status: tenant.status,
          members: 0,
          readiness: { activeOwner: false, activeBranch: false, contactEmail: false },
          createdAt: tenant.created_at.toISOString(),
        };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async updateTenantStatus(actorUserId, tenantId, targetStatus, requestId) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await setPlatformContext(client, actorUserId);
        const current = await client.query<{
          id: string;
          status: TenantStatus;
        }>("SELECT id, status FROM tenants WHERE id = $1 FOR UPDATE", [tenantId]);
        const currentTenant = current.rows[0];
        if (!currentTenant) {
          await client.query("ROLLBACK");
          return { status: "not_found" } satisfies TenantStatusUpdateResult;
        }

        const allowedTransitions: Record<TenantStatus, TenantStatus[]> = {
          draft: ["active", "archived"],
          active: ["suspended"],
          suspended: ["active", "archived"],
          archived: [],
        };
        if (!allowedTransitions[currentTenant.status].includes(targetStatus)) {
          await client.query("ROLLBACK");
          return { status: "invalid_transition" } satisfies TenantStatusUpdateResult;
        }

        if (targetStatus === "active") {
          const readiness = await client.query<{
            active_owner: boolean;
            active_branch: boolean;
            contact_email: boolean;
          }>(
            `SELECT
              EXISTS (
                SELECT 1 FROM tenant_memberships
                 WHERE tenant_id = $1 AND role = 'owner' AND status = 'active'
              ) AS active_owner,
              EXISTS (
                SELECT 1 FROM branches
                 WHERE tenant_id = $1 AND status = 'active'
              ) AS active_branch,
              EXISTS (
                SELECT 1 FROM tenant_settings
                 WHERE tenant_id = $1 AND contact_email IS NOT NULL
              ) AS contact_email`,
            [tenantId],
          );
          const state = readiness.rows[0];
          const missing: Array<"active_owner" | "active_branch" | "contact_email"> = [];
          if (!state?.active_owner) missing.push("active_owner");
          if (!state?.active_branch) missing.push("active_branch");
          if (!state?.contact_email) missing.push("contact_email");
          if (missing.length > 0) {
            await client.query("ROLLBACK");
            return { status: "not_ready", missing } satisfies TenantStatusUpdateResult;
          }
        }

        const updated = await client.query<{
          id: string;
          slug: string;
          display_name: string;
          status: TenantStatus;
          created_at: Date;
        }>(
          `UPDATE tenants
              SET status = $2, updated_at = now()
            WHERE id = $1
          RETURNING id, slug, display_name, status, created_at`,
          [tenantId, targetStatus],
        );
        const tenant = updated.rows[0];
        if (!tenant) throw new Error("Tenant status update did not return a record");
        const memberCount = await client.query<{ count: string }>(
          `SELECT count(*) AS count
             FROM tenant_memberships
            WHERE tenant_id = $1 AND status = 'active'`,
          [tenantId],
        );
        const readiness = await client.query<{
          active_owner: boolean;
          active_branch: boolean;
          contact_email: boolean;
        }>(
          `SELECT
             EXISTS (
               SELECT 1 FROM tenant_memberships
                WHERE tenant_id = $1 AND role = 'owner' AND status = 'active'
             ) AS active_owner,
             EXISTS (
               SELECT 1 FROM branches
                WHERE tenant_id = $1 AND status = 'active'
             ) AS active_branch,
             EXISTS (
               SELECT 1 FROM tenant_settings
                WHERE tenant_id = $1 AND contact_email IS NOT NULL
             ) AS contact_email`,
          [tenantId],
        );
        await client.query(
          `INSERT INTO audit_events
             (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
           VALUES ($1, $2, 'tenant.status_changed', 'tenant', $1, $3,
                   jsonb_build_object('from', $4::text, 'to', $5::text))`,
          [tenantId, actorUserId, requestId, currentTenant.status, targetStatus],
        );
        await client.query("COMMIT");
        return {
          status: "updated",
          tenant: {
            id: tenant.id,
            slug: tenant.slug,
            displayName: tenant.display_name,
            status: tenant.status,
            members: Number(memberCount.rows[0]?.count ?? 0),
            readiness: {
              activeOwner: readiness.rows[0]?.active_owner ?? false,
              activeBranch: readiness.rows[0]?.active_branch ?? false,
              contactEmail: readiness.rows[0]?.contact_email ?? false,
            },
            createdAt: tenant.created_at.toISOString(),
          },
        } satisfies TenantStatusUpdateResult;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
