import type { Pool, PoolClient } from "pg";
import type { TenantActor } from "../tenancy/types.js";
import type {
  SupportAccessMutationResult,
  SupportAccessRecord,
  SupportAccessRequestResult,
  SupportAccessService,
  SupportAccessStatus,
} from "./types.js";

type SupportAccessRow = {
  id: string;
  tenant_id: string;
  tenant_name: string;
  requested_by_display_name: string;
  purpose: string;
  requested_duration_minutes: number;
  status: "pending" | "approved" | "denied" | "revoked";
  created_at: Date;
  reviewed_by_display_name: string | null;
  reviewed_at: Date | null;
  approved_until: Date | null;
};

async function setPlatformContext(client: PoolClient, actorUserId: string) {
  await client.query("SELECT set_config('app.user_id', $1, true)", [actorUserId]);
  await client.query("SELECT set_config('app.platform_role', 'developer', true)");
}

async function setTenantContext(client: PoolClient, actor: TenantActor, tenantId: string) {
  await client.query("SELECT set_config('app.user_id', $1, true)", [actor.userId]);
  await client.query("SELECT set_config('app.platform_role', $1, true)", [
    actor.platformRole ?? "",
  ]);
  await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
  await client.query("SELECT set_config('app.tenant_role', $1, true)", [actor.tenantRole ?? ""]);
}

function statusFromRow(row: SupportAccessRow): SupportAccessStatus {
  if (row.status !== "approved") return row.status;
  return row.approved_until && row.approved_until > new Date() ? "active" : "expired";
}

function toRecord(row: SupportAccessRow): SupportAccessRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    tenantName: row.tenant_name,
    requestedByDisplayName: row.requested_by_display_name,
    purpose: row.purpose,
    requestedDurationMinutes: row.requested_duration_minutes,
    status: statusFromRow(row),
    requestedAt: row.created_at.toISOString(),
    reviewedByDisplayName: row.reviewed_by_display_name,
    reviewedAt: row.reviewed_at?.toISOString() ?? null,
    expiresAt: row.approved_until?.toISOString() ?? null,
  };
}

const selectAccess = `SELECT access.id, access.tenant_id, tenant.display_name AS tenant_name,
  requester.display_name AS requested_by_display_name, access.purpose,
  access.requested_duration_minutes, access.status, access.created_at,
  reviewer.display_name AS reviewed_by_display_name, access.reviewed_at, access.approved_until
FROM tenant_support_access_requests access
JOIN tenants tenant ON tenant.id = access.tenant_id
JOIN users requester ON requester.id = access.requested_by
LEFT JOIN users reviewer ON reviewer.id = access.reviewed_by`;

async function loadAccess(client: PoolClient, accessId: string) {
  const result = await client.query<SupportAccessRow>(`${selectAccess} WHERE access.id = $1`, [
    accessId,
  ]);
  return result.rows[0] ? toRecord(result.rows[0]) : null;
}

export function createPostgresSupportAccessService(pool: Pool): SupportAccessService {
  return {
    async requestAccess(actorUserId, tenantId, input) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await setPlatformContext(client, actorUserId);
        const tenant = await client.query<{ id: string }>(
          "SELECT id FROM tenants WHERE id = $1 FOR UPDATE",
          [tenantId],
        );
        if (!tenant.rows[0]) {
          await client.query("ROLLBACK");
          return { status: "tenant_not_found" } satisfies SupportAccessRequestResult;
        }
        const existing = await client.query<SupportAccessRow>(
          `${selectAccess}
           WHERE access.tenant_id = $1 AND access.requested_by = $2
             AND (access.status = 'pending'
               OR (access.status = 'approved' AND access.approved_until > now()))
           ORDER BY access.created_at DESC LIMIT 1`,
          [tenantId, actorUserId],
        );
        if (existing.rows[0]) {
          await client.query("COMMIT");
          return {
            status: "exists",
            access: toRecord(existing.rows[0]),
          } satisfies SupportAccessRequestResult;
        }
        const created = await client.query<SupportAccessRow>(
          `WITH inserted AS (
             INSERT INTO tenant_support_access_requests (
               tenant_id, requested_by, purpose, requested_duration_minutes
             ) VALUES ($1, $2, $3, $4)
             RETURNING *
           )
           SELECT inserted.id, inserted.tenant_id, tenant.display_name AS tenant_name,
             requester.display_name AS requested_by_display_name, inserted.purpose,
             inserted.requested_duration_minutes, inserted.status, inserted.created_at,
             NULL::text AS reviewed_by_display_name, inserted.reviewed_at, inserted.approved_until
           FROM inserted
           JOIN tenants tenant ON tenant.id = inserted.tenant_id
           JOIN users requester ON requester.id = inserted.requested_by`,
          [tenantId, actorUserId, input.purpose, input.durationMinutes],
        );
        const row = created.rows[0];
        if (!row) throw new Error("Support access insert did not return a record");
        await client.query(
          `INSERT INTO audit_events
             (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
           VALUES ($1, $2, 'support_access.requested', 'support_access', $3, $4,
             jsonb_build_object('durationMinutes', $5::integer))`,
          [tenantId, actorUserId, row.id, input.requestId, input.durationMinutes],
        );
        await client.query("COMMIT");
        return { status: "created", access: toRecord(row) } satisfies SupportAccessRequestResult;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async listForDeveloper(actorUserId) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await setPlatformContext(client, actorUserId);
        const result = await client.query<SupportAccessRow>(
          `${selectAccess}
           WHERE access.requested_by = $1
           ORDER BY access.created_at DESC LIMIT 100`,
          [actorUserId],
        );
        await client.query("COMMIT");
        return result.rows.map(toRecord);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async listForTenant(actor, tenantId) {
      if (actor.tenantRole !== "owner") return [];
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await setTenantContext(client, actor, tenantId);
        const result = await client.query<SupportAccessRow>(
          `${selectAccess}
           WHERE access.tenant_id = $1
           ORDER BY access.created_at DESC LIMIT 100`,
          [tenantId],
        );
        await client.query("COMMIT");
        return result.rows.map(toRecord);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async reviewAccess(actor, tenantId, accessId, action, requestId) {
      if (actor.tenantRole !== "owner") return { status: "not_found" };
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await setTenantContext(client, actor, tenantId);
        const current = await client.query<SupportAccessRow>(
          `${selectAccess}
           WHERE access.id = $1 AND access.tenant_id = $2
           FOR UPDATE OF access`,
          [accessId, tenantId],
        );
        const row = current.rows[0];
        if (!row) {
          await client.query("ROLLBACK");
          return { status: "not_found" } satisfies SupportAccessMutationResult;
        }
        const mayReviewPending = row.status === "pending" && action !== "revoke";
        const mayRevokeActive =
          row.status === "approved" &&
          row.approved_until !== null &&
          row.approved_until > new Date() &&
          action === "revoke";
        if (!mayReviewPending && !mayRevokeActive) {
          await client.query("ROLLBACK");
          return { status: "invalid_transition" } satisfies SupportAccessMutationResult;
        }
        const nextStatus =
          action === "approve" ? "approved" : action === "deny" ? "denied" : "revoked";
        await client.query(
          `UPDATE tenant_support_access_requests
              SET status = $3,
                  reviewed_by = $4,
                  reviewed_at = now(),
                  approved_until = CASE
                    WHEN $3 = 'approved'
                    THEN now() + make_interval(mins => requested_duration_minutes)
                    ELSE approved_until
                  END,
                  updated_at = now()
            WHERE id = $1 AND tenant_id = $2`,
          [accessId, tenantId, nextStatus, actor.userId],
        );
        const updated = await loadAccess(client, accessId);
        if (!updated) throw new Error("Updated support access is unavailable");
        await client.query(
          `INSERT INTO audit_events
             (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
           VALUES ($1, $2, $3, 'support_access', $4, $5, '{}'::jsonb)`,
          [
            tenantId,
            actor.userId,
            `support_access.${action === "approve" ? "approved" : action === "deny" ? "denied" : "revoked"}`,
            accessId,
            requestId,
          ],
        );
        await client.query("COMMIT");
        return { status: "updated", access: updated } satisfies SupportAccessMutationResult;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async cancelAccess(actorUserId, accessId, requestId) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await setPlatformContext(client, actorUserId);
        const current = await client.query<SupportAccessRow>(
          `${selectAccess}
           WHERE access.id = $1 AND access.requested_by = $2
           FOR UPDATE OF access`,
          [accessId, actorUserId],
        );
        const row = current.rows[0];
        if (!row) {
          await client.query("ROLLBACK");
          return { status: "not_found" } satisfies SupportAccessMutationResult;
        }
        if (row.status !== "pending" && statusFromRow(row) !== "active") {
          await client.query("ROLLBACK");
          return { status: "invalid_transition" } satisfies SupportAccessMutationResult;
        }
        await client.query(
          `UPDATE tenant_support_access_requests
              SET status = 'revoked', reviewed_by = $2, reviewed_at = now(), updated_at = now()
            WHERE id = $1`,
          [accessId, actorUserId],
        );
        const updated = await loadAccess(client, accessId);
        if (!updated) throw new Error("Cancelled support access is unavailable");
        await client.query(
          `INSERT INTO audit_events
             (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
           VALUES ($1, $2, 'support_access.cancelled', 'support_access', $3, $4, '{}'::jsonb)`,
          [row.tenant_id, actorUserId, accessId, requestId],
        );
        await client.query("COMMIT");
        return { status: "updated", access: updated } satisfies SupportAccessMutationResult;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async findActiveAccess(actorUserId, tenantId) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await setPlatformContext(client, actorUserId);
        const result = await client.query<SupportAccessRow>(
          `${selectAccess}
           WHERE access.tenant_id = $1 AND access.requested_by = $2
             AND access.status = 'approved' AND access.approved_until > now()
           ORDER BY access.approved_until DESC LIMIT 1`,
          [tenantId, actorUserId],
        );
        await client.query("COMMIT");
        return result.rows[0] ? toRecord(result.rows[0]) : null;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
