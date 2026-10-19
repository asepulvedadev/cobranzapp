"use client";

import { Bell, CheckCircle, ClockCountdown, WarningCircle } from "@phosphor-icons/react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { fetchWithTimeout } from "../../lib/fetch-with-timeout";
import type {
  BorrowerDirectory,
  CurrentUser,
  LoanApplication,
  TenantOverview,
} from "../../lib/platform";
import { buildCollectionAlerts, type CollectionAlert } from "./collection-alerts";
import { Modal } from "./Modal";
import "./CollectionNotificationCenter.css";

type StaffMembership = CurrentUser["memberships"][number] & {
  role: "owner" | "supervisor" | "collector";
};

const iconBySeverity = {
  critical: WarningCircle,
  warning: ClockCountdown,
  info: CheckCircle,
};

function dateInTimezone(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function CollectionNotificationCenter({ membership }: { membership: StaffMembership }) {
  const [alerts, setAlerts] = useState<CollectionAlert[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const basePath = `/panel/empresa/${membership.tenantSlug}`;

  const loadAlerts = useCallback(async () => {
    const [applicationsResponse, overviewResponse, borrowersResponse] = await Promise.all([
      fetchWithTimeout(`/api/v1/tenants/${membership.tenantId}/loan-applications`, {
        cache: "no-store",
      }),
      fetchWithTimeout(`/api/v1/tenants/${membership.tenantId}/overview`, { cache: "no-store" }),
      fetchWithTimeout(`/api/v1/tenants/${membership.tenantId}/borrowers?page=1&pageSize=1`, {
        cache: "no-store",
      }),
    ]);
    if (!applicationsResponse?.ok || !overviewResponse?.ok) {
      setLoading(false);
      return;
    }
    const applicationsBody = (await applicationsResponse.json()) as {
      applications?: LoanApplication[];
    };
    const overviewBody = (await overviewResponse.json()) as { overview?: TenantOverview };
    const borrowerBody = borrowersResponse?.ok
      ? ((await borrowersResponse.json()) as BorrowerDirectory)
      : null;
    setAlerts(
      buildCollectionAlerts({
        applications: applicationsBody.applications ?? [],
        basePath,
        metrics: {
          ...(overviewBody.overview?.metrics ?? {
            members: 0,
            branches: 0,
            teams: 0,
            pendingInvitations: 0,
            activeEmployeeSeats: 0,
          }),
          pendingIdentities: borrowerBody?.identitySummary.pending ?? 0,
        },
        role: membership.role,
        today: dateInTimezone(overviewBody.overview?.tenant.timezone ?? "America/Bogota"),
      }),
    );
    setLoading(false);
  }, [basePath, membership.role, membership.tenantId]);

  useEffect(() => {
    void loadAlerts();
    const refresh = () => {
      if (document.visibilityState === "visible") void loadAlerts();
    };
    const interval = window.setInterval(refresh, 120_000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("cobranzapp:collection-changed", refresh);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("cobranzapp:collection-changed", refresh);
    };
  }, [loadAlerts]);

  return (
    <>
      <button
        aria-label={`Alertas de cobro${alerts.length ? `, ${alerts.length} pendientes` : ""}`}
        className="notification-trigger"
        onClick={() => {
          setOpen(true);
          void loadAlerts();
        }}
        type="button"
      >
        <Bell aria-hidden="true" size={22} weight={alerts.length ? "fill" : "regular"} />
        <span>Alertas</span>
        {alerts.length ? <b>{alerts.length > 9 ? "9+" : alerts.length}</b> : null}
      </button>
      {open ? (
        <Modal
          className="notification-modal"
          onClose={() => setOpen(false)}
          title="Alertas de cobro"
        >
          <div className="notification-heading">
            <p>Solo aparecen pendientes reales y se eliminan al resolverlos.</p>
            <button disabled={loading} onClick={() => void loadAlerts()} type="button">
              {loading ? "Actualizando…" : "Actualizar"}
            </button>
          </div>
          {loading ? <p className="notification-empty">Revisando la operación…</p> : null}
          {!loading && !alerts.length ? (
            <div className="notification-empty">
              <CheckCircle aria-hidden="true" size={32} weight="fill" />
              <strong>Todo está al día</strong>
              <span>No hay cobros ni revisiones pendientes.</span>
            </div>
          ) : null}
          <div className="notification-list">
            {alerts.map((alert) => {
              const Icon = iconBySeverity[alert.severity];
              return (
                <Link
                  className={`notification-item notification-${alert.severity}`}
                  href={alert.href}
                  key={alert.id}
                  onClick={() => setOpen(false)}
                >
                  <Icon aria-hidden="true" size={24} weight="fill" />
                  <span>
                    <strong>{alert.title}</strong>
                    <small>{alert.detail}</small>
                  </span>
                  <i aria-hidden="true">→</i>
                </Link>
              );
            })}
          </div>
        </Modal>
      ) : null}
    </>
  );
}
