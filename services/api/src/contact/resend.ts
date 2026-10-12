export interface ContactDetails {
  name: string;
  phone: string;
  plan?: "Pro" | "Ultra";
  source: string;
  requestId: string;
}

export interface ContactMailer {
  send(details: ContactDetails): Promise<string>;
}

export class ContactDeliveryError extends Error {
  constructor(public readonly conflict = false) {
    super("Contact delivery unavailable");
  }
}

export function createResendContactMailer(
  config: { apiKey: string; from: string; to: string },
  transport: typeof fetch = fetch,
): ContactMailer {
  return {
    async send(details) {
      try {
        // Stable content lets Resend deduplicate an uncertain delivery on retry.
        const response = await transport("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
            "User-Agent": "cobranzapp-api/1.0",
            "Idempotency-Key": `cobranzapp-contact/${details.requestId}`,
          },
          signal: AbortSignal.timeout(8_000),
          body: JSON.stringify({
            from: config.from,
            to: [config.to],
            subject: `Nueva solicitud de contacto${details.plan ? ` · Plan ${details.plan}` : ""} · cobranzapp`,
            text: [
              "Nueva solicitud de contacto de cobranzapp",
              "",
              `Nombre: ${details.name}`,
              `Teléfono: ${details.phone}`,
              `Plan: ${details.plan ?? "Sin seleccionar"}`,
              `Origen: ${details.source}`,
              `Referencia: ${details.requestId}`,
              "",
              "La persona solicita que el equipo se comunique con ella por teléfono.",
            ].join("\n"),
            tags: [{ name: "category", value: "contact" }],
          }),
        });
        if (!response.ok) throw new ContactDeliveryError(response.status === 409);
        const result = (await response.json()) as { id?: unknown };
        if (typeof result.id !== "string" || !result.id) throw new ContactDeliveryError();
        return result.id;
      } catch (error) {
        if (error instanceof ContactDeliveryError) throw error;
        // Never expose provider responses, request content or credentials in errors.
        throw new ContactDeliveryError();
      }
    },
  };
}
