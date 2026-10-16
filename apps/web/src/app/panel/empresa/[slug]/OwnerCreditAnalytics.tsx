"use client";

import { useState } from "react";
import { fetchWithTimeout } from "../../../../lib/fetch-with-timeout";
import { formatCop } from "../../../../lib/financial-display";
import type { LoanAnalytics, LoanAnalyticsPreset } from "../../../../lib/platform";
import { Modal } from "../../Modal";

const presetLabels: Record<Exclude<LoanAnalyticsPreset, "custom">, string> = {
  day: "Día",
  week: "Semana",
  month: "Mes",
};

const roleLabels = { supervisor: "Supervisor", collector: "Cobrador" } as const;

function asDate(value: string) {
  return new Date(`${value}T12:00:00Z`);
}

function dateValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function presetRange(preset: Exclude<LoanAnalyticsPreset, "custom">, today: string) {
  const end = asDate(today);
  if (preset === "day") return { from: today, to: today };
  if (preset === "week") {
    const start = new Date(end);
    const weekday = start.getUTCDay() || 7;
    start.setUTCDate(start.getUTCDate() - weekday + 1);
    return { from: dateValue(start), to: today };
  }
  return { from: `${today.slice(0, 7)}-01`, to: today };
}

export function OwnerCreditAnalytics({
  tenantId,
  today,
  initialAnalytics,
}: {
  tenantId: string;
  today: string;
  initialAnalytics: LoanAnalytics;
}) {
  const [analytics, setAnalytics] = useState(initialAnalytics);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [customOpen, setCustomOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(initialAnalytics.period.from);
  const [customTo, setCustomTo] = useState(initialAnalytics.period.to);

  async function load(preset: LoanAnalyticsPreset, from: string, to: string) {
    setLoading(true);
    setMessage("");
    const params = new URLSearchParams({ preset, from, to });
    const response = await fetchWithTimeout(
      `/api/v1/tenants/${tenantId}/credit-analytics?${params.toString()}`,
    );
    if (!response?.ok) {
      setMessage("No fue posible actualizar los indicadores.");
      setLoading(false);
      return;
    }
    const body = (await response.json()) as { analytics: LoanAnalytics };
    setAnalytics(body.analytics);
    setLoading(false);
    setCustomOpen(false);
  }

  return (
    <section
      className="dashboard-card owner-analytics-card"
      aria-labelledby="owner-analytics-title"
    >
      <div className="owner-analytics-heading">
        <div>
          <span className="panel-eyebrow">Dinero y renovaciones</span>
          <h2 id="owner-analytics-title">Estado del negocio</h2>
          <p>
            Del {analytics.period.from} al {analytics.period.to}
          </p>
        </div>
        <fieldset className="analytics-period-control">
          <legend className="analytics-period-legend">Periodo del reporte</legend>
          {(Object.keys(presetLabels) as Array<Exclude<LoanAnalyticsPreset, "custom">>).map(
            (preset) => (
              <button
                aria-pressed={analytics.period.preset === preset}
                disabled={loading}
                key={preset}
                onClick={() => {
                  const range = presetRange(preset, today);
                  void load(preset, range.from, range.to);
                }}
                type="button"
              >
                {presetLabels[preset]}
              </button>
            ),
          )}
          <button
            aria-pressed={analytics.period.preset === "custom"}
            disabled={loading}
            onClick={() => setCustomOpen(true)}
            type="button"
          >
            Fechas
          </button>
        </fieldset>
      </div>

      <div className="metric-grid owner-money-grid" aria-busy={loading}>
        <article>
          <span>Cartera vigente</span>
          <strong>{formatCop(analytics.metrics.activePrincipalOutstanding)}</strong>
          <small>Capital pendiente en {analytics.metrics.activeCreditCount} créditos activos</small>
        </article>
        <article>
          <span>Capital aprobado</span>
          <strong>{formatCop(analytics.metrics.approvedPrincipal)}</strong>
          <small>Créditos activados en el periodo</small>
        </article>
        <article className="metric-accent">
          <span>Recaudado</span>
          <strong>{formatCop(analytics.metrics.collectedAmount)}</strong>
          <small>Pagos registrados en el periodo</small>
        </article>
        <article>
          <span>Renovaciones</span>
          <strong>{analytics.metrics.renewalCount}</strong>
          <small>Solicitudes creadas en el periodo</small>
        </article>
      </div>

      <details className="renewal-team-details">
        <summary>Renovaciones por cobrador y supervisor</summary>
        {analytics.renewalsByMember.length ? (
          <div className="renewal-team-list">
            {analytics.renewalsByMember.map((member) => (
              <div key={member.userId}>
                <span>
                  <strong>{member.displayName}</strong>
                  <small>{roleLabels[member.role]}</small>
                </span>
                <span>
                  <strong>{member.total}</strong>
                  <small>
                    {member.activated} activas · {member.pending} pendientes
                  </small>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="operational-note">El equipo no registró renovaciones en este periodo.</p>
        )}
      </details>
      {message ? <p className="form-feedback error">{message}</p> : null}

      {customOpen ? (
        <Modal onClose={() => setCustomOpen(false)} title="Elegir fechas">
          <form
            className="tenant-form analytics-date-form"
            onSubmit={(event) => {
              event.preventDefault();
              void load("custom", customFrom, customTo);
            }}
          >
            <label>
              Desde
              <input
                max={customTo}
                onChange={(event) => setCustomFrom(event.target.value)}
                required
                type="date"
                value={customFrom}
              />
            </label>
            <label>
              Hasta
              <input
                max={today}
                min={customFrom}
                onChange={(event) => setCustomTo(event.target.value)}
                required
                type="date"
                value={customTo}
              />
            </label>
            <button className="primary-action" disabled={loading} type="submit">
              {loading ? "Actualizando…" : "Aplicar fechas"}
            </button>
          </form>
        </Modal>
      ) : null}
    </section>
  );
}
