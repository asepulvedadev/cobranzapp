import type { Pool } from "pg";

export type ClaimedOutboxEvent = {
  id: string;
  tenantId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  attempts: number;
  maxAttempts: number;
};

type OutboxRow = {
  id: string;
  tenant_id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  attempts: number;
  max_attempts: number;
};

function toClaimedEvent(row: OutboxRow): ClaimedOutboxEvent {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    eventType: row.event_type,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
  };
}

export function safeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown worker failure";
  return message.replaceAll(/[\r\n\t]+/g, " ").slice(0, 500);
}

export async function claimNextOutboxEvent(
  pool: Pool,
  workerId: string,
  leaseSeconds: number,
): Promise<ClaimedOutboxEvent | null> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE outbox_events
          SET status = 'dead',
              lease_owner = NULL,
              lease_expires_at = NULL,
              last_error = COALESCE(last_error, 'Worker lease expired after final attempt')
        WHERE status = 'processing'
          AND lease_expires_at <= now()
          AND attempts >= max_attempts`,
    );
    const result = await client.query<OutboxRow>(
      `WITH candidate AS (
         SELECT id
           FROM outbox_events
          WHERE (
              status = 'pending'
              AND available_at <= now()
              AND attempts < max_attempts
            ) OR (
              status = 'processing'
              AND lease_expires_at <= now()
              AND attempts < max_attempts
            )
          ORDER BY available_at, created_at, id
          FOR UPDATE SKIP LOCKED
          LIMIT 1
       )
       UPDATE outbox_events event
          SET status = 'processing',
              attempts = event.attempts + 1,
              lease_owner = $1,
              lease_expires_at = now() + make_interval(secs => $2),
              last_error = NULL
         FROM candidate
        WHERE event.id = candidate.id
       RETURNING event.id, event.tenant_id, event.event_type, event.aggregate_type,
                 event.aggregate_id, event.attempts, event.max_attempts`,
      [workerId, leaseSeconds],
    );
    await client.query("COMMIT");
    return result.rows[0] ? toClaimedEvent(result.rows[0]) : null;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function processClaimedOutboxEvent(
  pool: Pool,
  event: ClaimedOutboxEvent,
  workerId: string,
): Promise<"expired" | "skipped" | "lost_lease"> {
  if (event.eventType !== "support_access.expire") {
    throw new Error(`Unsupported outbox event type: ${event.eventType}`);
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query<OutboxRow>(
      `SELECT id, tenant_id, event_type, aggregate_type, aggregate_id, attempts, max_attempts
         FROM outbox_events
        WHERE id = $1
          AND status = 'processing'
          AND lease_owner = $2
          AND lease_expires_at > now()
        FOR UPDATE`,
      [event.id, workerId],
    );
    const current = locked.rows[0];
    if (!current) {
      await client.query("ROLLBACK");
      return "lost_lease";
    }
    if (current.event_type !== "support_access.expire") {
      throw new Error(`Unsupported outbox event type: ${current.event_type}`);
    }
    const expired = await client.query(
      `UPDATE tenant_support_access_requests
          SET status = 'expired', updated_at = now()
        WHERE id = $1
          AND tenant_id = $2
          AND status = 'approved'
          AND approved_until <= now()`,
      [current.aggregate_id, current.tenant_id],
    );
    if (expired.rowCount) {
      await client.query(
        `INSERT INTO audit_events
           (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
         VALUES ($1, NULL, 'support_access.expired', 'support_access', $2, $3,
                 jsonb_build_object('outboxEventId', $4::text))`,
        [current.tenant_id, current.aggregate_id, `outbox:${current.id}`, current.id],
      );
    }
    await client.query(
      `UPDATE outbox_events
          SET status = 'processed', processed_at = now(), lease_owner = NULL, lease_expires_at = NULL
        WHERE id = $1`,
      [current.id],
    );
    await client.query("COMMIT");
    return expired.rowCount ? "expired" : "skipped";
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function recordOutboxFailure(
  pool: Pool,
  event: ClaimedOutboxEvent,
  workerId: string,
  error: unknown,
) {
  const result = await pool.query<{ status: "pending" | "dead" }>(
    `UPDATE outbox_events
        SET status = CASE WHEN attempts >= max_attempts THEN 'dead' ELSE 'pending' END,
            available_at = CASE
              WHEN attempts >= max_attempts THEN available_at
              ELSE now() + LEAST(interval '15 minutes', make_interval(secs => power(2, attempts)::integer))
            END,
            lease_owner = NULL,
            lease_expires_at = NULL,
            last_error = $3
      WHERE id = $1
        AND status = 'processing'
        AND lease_owner = $2
    RETURNING status`,
    [event.id, workerId, safeErrorMessage(error)],
  );
  return result.rows[0]?.status ?? null;
}
