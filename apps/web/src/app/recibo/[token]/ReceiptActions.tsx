"use client";

function whatsappNumber(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 10 ? `57${digits}` : digits;
}

export function ReceiptActions({
  phone,
  borrowerName,
  receiptNumber,
  amount,
  remaining,
}: {
  phone: string;
  borrowerName: string;
  receiptNumber: string;
  amount: string;
  remaining: string;
}) {
  function share() {
    const message = `Hola ${borrowerName}, compartimos tu comprobante ${receiptNumber}. Pago recibido: ${amount}. Saldo restante: ${remaining}. ${window.location.href}`;
    window.open(
      `https://wa.me/${whatsappNumber(phone)}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }
  return (
    <div className="receipt-actions">
      <button onClick={share} type="button">
        Enviar por WhatsApp
      </button>
      <button onClick={() => window.print()} type="button">
        Imprimir o guardar PDF
      </button>
    </div>
  );
}
