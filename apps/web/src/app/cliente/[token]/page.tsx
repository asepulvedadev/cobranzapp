import type { BorrowerPortalProfile } from "@cobranzapp/contracts";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatCop, formatPercentage } from "../../../lib/financial-display";

export const metadata: Metadata = {
  title: "Mi crédito",
  robots: { index: false, follow: false },
};

const frequencyLabels = {
  daily: "Diario",
  weekly: "Semanal",
  fortnightly: "Quincenal",
  monthly: "Mensual",
};

export default async function ClientPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const apiUrl = process.env.INTERNAL_API_URL ?? "http://127.0.0.1:3001";
  const response = await fetch(`${apiUrl}/v1/public/client/${encodeURIComponent(token)}`, {
    cache: "no-store",
  });
  if (!response.ok) notFound();
  const body = (await response.json()) as { profile: BorrowerPortalProfile };
  const { profile } = body;
  const totalRemaining = profile.credits.reduce(
    (total, credit) => total + Number(credit.remainingAmount),
    0,
  );

  return (
    <main
      className="public-finance-shell"
      style={
        {
          "--public-primary": profile.company.primaryColor,
          "--public-accent": profile.company.accentColor,
        } as React.CSSProperties
      }
    >
      <header className="public-finance-header">
        <span>{profile.company.name}</span>
        <h1>Hola, {profile.borrower.fullName.split(" ")[0]}</h1>
        <p>
          {profile.borrower.documentType && profile.borrower.documentLast4
            ? `${profile.borrower.documentType} · •••• ${profile.borrower.documentLast4}`
            : "Documento pendiente de registrar"}
        </p>
      </header>

      <section className="public-balance-card">
        <small>Saldo total pendiente</small>
        <strong>{formatCop(totalRemaining.toFixed(2))}</strong>
        <span>Actualizado con los pagos confirmados</span>
      </section>

      <section className="public-finance-section">
        <div className="public-section-heading">
          <h2>Mis créditos</h2>
          <span>{profile.credits.length}</span>
        </div>
        <div className="public-credit-list">
          {profile.credits.map((credit) => (
            <article className="public-credit-card" key={credit.id}>
              <div>
                <strong>{credit.productName}</strong>
                <span className={`public-credit-status is-${credit.status}`}>
                  {credit.status === "paid" ? "Pagado" : "Activo"}
                </span>
              </div>
              <dl>
                <div>
                  <dt>Saldo</dt>
                  <dd>{formatCop(credit.remainingAmount)}</dd>
                </div>
                <div>
                  <dt>Próxima fecha</dt>
                  <dd>
                    {credit.nextDueDate ?? "Completado"}
                    {credit.overdueInstallments > 0 ? (
                      <span className="public-overdue-label">
                        {credit.overdueInstallments} vencida
                        {credit.overdueInstallments === 1 ? "" : "s"}
                      </span>
                    ) : null}
                  </dd>
                </div>
                <div>
                  <dt>Cuotas pagadas</dt>
                  <dd>
                    {credit.paidInstallments} de {credit.requestedTermCount}
                  </dd>
                </div>
                <div>
                  <dt>Frecuencia</dt>
                  <dd>{frequencyLabels[credit.paymentFrequency]}</dd>
                </div>
                <div>
                  <dt>Total acordado</dt>
                  <dd>{formatCop(credit.scheduledTotal)}</dd>
                </div>
                <div>
                  <dt>Interés</dt>
                  <dd>{formatPercentage(credit.nominalRate)}%</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section className="public-finance-section">
        <div className="public-section-heading">
          <h2>Pagos confirmados</h2>
          <span>{profile.payments.length}</span>
        </div>
        {profile.payments.length ? (
          <div className="public-payment-list">
            {profile.payments.map((payment) => (
              <a className="public-payment-row" href={payment.receiptUrl} key={payment.id}>
                <span>
                  <strong>Cuota {payment.installmentNumber}</strong>
                  <small>
                    {new Intl.DateTimeFormat("es-CO", {
                      dateStyle: "medium",
                    }).format(new Date(payment.paidAt))}{" "}
                    · {payment.paymentMethod === "cash" ? "Efectivo" : "Transferencia"}
                  </small>
                </span>
                <strong>{formatCop(payment.amount)}</strong>
              </a>
            ))}
          </div>
        ) : (
          <p className="public-empty-state">Todavía no hay pagos confirmados.</p>
        )}
      </section>

      <footer className="public-finance-footer">
        <strong>{profile.company.name}</strong>
        {profile.company.phone ? (
          <a href={`tel:${profile.company.phone}`}>Contactar empresa</a>
        ) : null}
      </footer>
    </main>
  );
}
