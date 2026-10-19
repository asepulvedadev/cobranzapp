import { randomUUID } from "node:crypto";
import type { Pool } from "pg";

type DueSubscription = {
  id: string;
  billing_cycle: "monthly" | "yearly";
  current_period_end: string;
  auto_renew: boolean;
  consumed_tenant_id: string | null;
};

export type SubscriptionReconciliationSummary = {
  renewed: number;
  expired: number;
  tenantsSuspended: number;
};

export function subscriptionServiceDate(now: Date) {
  const parts = new Map(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Bogota",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.get("year")}-${parts.get("month")}-${parts.get("day")}`;
}

function daysInUtcMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

export function addBillingPeriod(date: string, cycle: "monthly" | "yearly") {
  const current = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(current.getTime())) throw new Error("INVALID_SUBSCRIPTION_PERIOD");
  const day = current.getUTCDate();
  if (cycle === "yearly") {
    const year = current.getUTCFullYear() + 1;
    const month = current.getUTCMonth();
    current.setUTCFullYear(year, month, Math.min(day, daysInUtcMonth(year, month)));
  } else {
    const monthIndex = current.getUTCMonth() + 1;
    const year = current.getUTCFullYear() + Math.floor(monthIndex / 12);
    const month = monthIndex % 12;
    current.setUTCFullYear(year, month, Math.min(day, daysInUtcMonth(year, month)));
  }
  return current.toISOString().slice(0, 10);
}

export function nextCurrentPeriod(
  currentEnd: string,
  cycle: "monthly" | "yearly",
  serviceDate: string,
) {
  let start = currentEnd;
  let end = addBillingPeriod(start, cycle);
  let cycles = 1;
  while (end <= serviceDate) {
    start = end;
    end = addBillingPeriod(start, cycle);
    cycles += 1;
  }
  return { start, end, cycles };
}

export async function reconcileSubscriptions(
  pool: Pool,
  now = new Date(),
): Promise<SubscriptionReconciliationSummary> {
  const serviceDate = subscriptionServiceDate(now);
  const client = await pool.connect();
  const summary = { renewed: 0, expired: 0, tenantsSuspended: 0 };
  try {
    await client.query("BEGIN");
    const due = await client.query<DueSubscription>(
      `SELECT id, billing_cycle, current_period_end::text, auto_renew, consumed_tenant_id
         FROM user_memberships
        WHERE status = 'active' AND current_period_end <= $1::date
        ORDER BY current_period_end, id
        FOR UPDATE`,
      [serviceDate],
    );
    for (const subscription of due.rows) {
      if (subscription.auto_renew) {
        const period = nextCurrentPeriod(
          subscription.current_period_end,
          subscription.billing_cycle,
          serviceDate,
        );
        await client.query(
          `UPDATE user_memberships
              SET current_period_start = $2, current_period_end = $3, updated_at = now()
            WHERE id = $1`,
          [subscription.id, period.start, period.end],
        );
        await client.query(
          `INSERT INTO audit_events
             (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
           VALUES ($1, NULL, 'subscription.renewed', 'subscription', $2, $3, $4::jsonb)`,
          [
            subscription.consumed_tenant_id,
            subscription.id,
            `subscription-renewal:${subscription.id}:${period.end}:${randomUUID()}`,
            JSON.stringify({
              billingCycle: subscription.billing_cycle,
              currentPeriodStart: period.start,
              currentPeriodEnd: period.end,
              cyclesAdvanced: period.cycles,
            }),
          ],
        );
        summary.renewed += 1;
        continue;
      }

      await client.query(
        `UPDATE user_memberships
            SET status = 'expired', deactivated_at = now(), updated_at = now()
          WHERE id = $1`,
        [subscription.id],
      );
      if (subscription.consumed_tenant_id) {
        const suspended = await client.query(
          `UPDATE tenants SET status = 'suspended', updated_at = now()
            WHERE id = $1 AND status = 'active'`,
          [subscription.consumed_tenant_id],
        );
        summary.tenantsSuspended += suspended.rowCount ?? 0;
      }
      await client.query(
        `INSERT INTO audit_events
           (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
         VALUES ($1, NULL, 'subscription.expired', 'subscription', $2, $3,
                 jsonb_build_object('currentPeriodEnd', $4::text))`,
        [
          subscription.consumed_tenant_id,
          subscription.id,
          `subscription-expiry:${subscription.id}:${randomUUID()}`,
          subscription.current_period_end,
        ],
      );
      summary.expired += 1;
    }
    await client.query("COMMIT");
    return summary;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
