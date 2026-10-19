import type { PaymentReceipt } from "@cobranzapp/contracts";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatCop } from "../../../lib/financial-display";
import { ReceiptActions } from "./ReceiptActions";

export const metadata: Metadata = {
  title: "Comprobante de pago",
  robots: { index: false, follow: false },
};

export default async function ReceiptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const apiUrl = process.env.INTERNAL_API_URL ?? "http://127.0.0.1:3001";
  const response = await fetch(`${apiUrl}/v1/public/receipts/${encodeURIComponent(token)}`, {
    cache: "no-store",
  });
  if (!response.ok) notFound();
  const { receipt } = (await response.json()) as { receipt: PaymentReceipt };
  const paidAt = new Date(receipt.payment.paidAt);
  return (
    <main
      className="receipt-shell"
      style={
        {
          "--public-primary": receipt.company.primaryColor,
          "--public-accent": receipt.company.accentColor,
        } as React.CSSProperties
      }
    >
      <article className="receipt-card">
        <header>
          <div>
            <span>Comprobante de pago</span>
            <h1>{receipt.company.name}</h1>
          </div>
          <strong>{receipt.payment.receiptNumber}</strong>
        </header>
        <section className="receipt-amount">
          <small>Valor recibido</small>
          <strong>{formatCop(receipt.payment.amount)}</strong>
          <span>{receipt.payment.paymentMethod === "cash" ? "Efectivo" : "Transferencia"}</span>
        </section>
        <dl className="receipt-details">
          <div>
            <dt>Cliente</dt>
            <dd>{receipt.borrower.fullName}</dd>
          </div>
          <div>
            <dt>Documento</dt>
            <dd>
              {receipt.borrower.documentType && receipt.borrower.documentLast4
                ? `${receipt.borrower.documentType} · •••• ${receipt.borrower.documentLast4}`
                : "Documento pendiente de registrar"}
            </dd>
          </div>
          <div>
            <dt>Cuota</dt>
            <dd>
              {receipt.payment.installmentNumber} de {receipt.credit.requestedTermCount}
            </dd>
          </div>
          <div>
            <dt>Fecha</dt>
            <dd>
              {new Intl.DateTimeFormat("es-CO", { dateStyle: "full", timeStyle: "short" }).format(
                paidAt,
              )}
            </dd>
          </div>
          <div>
            <dt>Registrado por</dt>
            <dd>{receipt.payment.recordedByName}</dd>
          </div>
          <div className="receipt-balance">
            <dt>Saldo restante</dt>
            <dd>{formatCop(receipt.payment.remainingAmount)}</dd>
          </div>
        </dl>
        <p className="receipt-note">
          Este comprobante confirma el pago registrado. No sustituye una factura electrónica ni un
          documento tributario.
        </p>
        <ReceiptActions
          amount={formatCop(receipt.payment.amount)}
          borrowerName={receipt.borrower.fullName}
          phone={receipt.borrower.whatsappPhone ?? receipt.borrower.phone}
          receiptNumber={receipt.payment.receiptNumber}
          remaining={formatCop(receipt.payment.remainingAmount)}
        />
      </article>
    </main>
  );
}
