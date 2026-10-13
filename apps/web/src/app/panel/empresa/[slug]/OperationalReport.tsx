import type { LoanApplication } from "../../../../lib/platform";

const frequencyLabels: Record<LoanApplication["paymentFrequency"], string> = {
  daily: "Diaria",
  weekly: "Semanal",
  fortnightly: "Quincenal",
  monthly: "Mensual",
};

const statusLabels: Record<LoanApplication["status"], string> = {
  draft: "Borrador",
  submitted: "Enviada",
  under_review: "En revisión",
  approved: "Aprobada",
  active: "Activa",
  paid: "Pagada",
  rejected: "Rechazada",
  cancelled: "Cancelada",
};

export function OperationalReport({ applications }: { applications: LoanApplication[] }) {
  const active = applications.filter((application) => application.status === "active");
  const inReview = applications.filter((application) =>
    ["submitted", "under_review"].includes(application.status),
  );
  const overdue = active.filter((application) => (application.overdueInstallments ?? 0) > 0);
  const overdueInstallments = overdue.reduce(
    (total, application) => total + (application.overdueInstallments ?? 0),
    0,
  );
  const frequencyCounts = active.reduce<Record<string, number>>((counts, application) => {
    counts[application.paymentFrequency] = (counts[application.paymentFrequency] ?? 0) + 1;
    return counts;
  }, {});

  return (
    <>
      <section aria-label="Indicadores operativos" className="metric-grid tenant-metrics">
        <article>
          <span>Créditos activos</span>
          <strong>{active.length}</strong>
          <small>Operaciones en seguimiento</small>
        </article>
        <article>
          <span>Cuotas vencidas</span>
          <strong>{overdueInstallments}</strong>
          <small>Proyección operativa, no saldo contable</small>
        </article>
        <article>
          <span>Clientes con atraso</span>
          <strong>{overdue.length}</strong>
          <small>Requieren gestión del equipo</small>
        </article>
        <article className="metric-accent">
          <span>Solicitudes en revisión</span>
          <strong>{inReview.length}</strong>
          <small>Sin aprobación financiera automática</small>
        </article>
      </section>

      <section className="dashboard-card activity-card" aria-labelledby="operational-report-title">
        <div className="card-heading">
          <div>
            <span className="panel-eyebrow">Seguimiento operativo</span>
            <h2 id="operational-report-title">Estado de la cartera</h2>
          </div>
          <span>{applications.length} registros</span>
        </div>
        <div className="control-list">
          {Object.entries(frequencyCounts).map(([frequency, count]) => (
            <div key={frequency}>
              <i className="control-ok" />
              <span>
                <strong>{frequencyLabels[frequency as LoanApplication["paymentFrequency"]]}</strong>
                <small>{count} crédito(s) activo(s)</small>
              </span>
            </div>
          ))}
          {!Object.keys(frequencyCounts).length ? (
            <p className="operational-note">Todavía no hay créditos activos para analizar.</p>
          ) : null}
        </div>
      </section>

      <section className="dashboard-card tenant-card" aria-labelledby="overdue-report-title">
        <div className="card-heading">
          <div>
            <span className="panel-eyebrow">Prioridad de cobro</span>
            <h2 id="overdue-report-title">Créditos con cuotas vencidas</h2>
          </div>
          <span>{overdue.length} prioritarios</span>
        </div>
        {overdue.length ? (
          <div className="tenant-table-wrap">
            <table className="tenant-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Frecuencia</th>
                  <th>Cuotas</th>
                  <th>Próxima cuota</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {overdue
                  .sort(
                    (left, right) =>
                      (right.overdueInstallments ?? 0) - (left.overdueInstallments ?? 0),
                  )
                  .slice(0, 20)
                  .map((application) => (
                    <tr key={application.id}>
                      <td data-label="Cliente">
                        <strong>{application.borrowerName}</strong>
                      </td>
                      <td data-label="Frecuencia">
                        {frequencyLabels[application.paymentFrequency]}
                      </td>
                      <td data-label="Cuotas">{application.overdueInstallments ?? 0} vencida(s)</td>
                      <td data-label="Próxima cuota">{application.nextDueDate ?? "Sin fecha"}</td>
                      <td data-label="Estado">
                        <span className={`status status-${application.status}`}>
                          {statusLabels[application.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <span aria-hidden="true">✓</span>
            <h3>No hay cuotas vencidas</h3>
            <p>La proyección operativa no detecta atrasos en los créditos activos.</p>
          </div>
        )}
      </section>
    </>
  );
}
