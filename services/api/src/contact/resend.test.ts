import { describe, expect, it, vi } from "vitest";
import { ContactDeliveryError, createResendContactMailer } from "./resend.js";

const details = {
  name: "María Pérez",
  phone: "+573000000000",
  plan: "Pro" as const,
  source: "planes",
  requestId: "12109052-962d-41c5-bb57-92dfe39a7c7b",
};

describe("Resend contact delivery", () => {
  it("sends only to the server-configured mailbox with stable idempotency and plain text", async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => new Response(JSON.stringify({ id: "email-id" })));
    const mailer = createResendContactMailer(
      { apiKey: "test-secret", from: "contacto@cobranzaap.tech", to: "info@cobranzaap.tech" },
      transport,
    );
    expect(await mailer.send(details)).toBe("email-id");
    await mailer.send(details);
    expect(transport.mock.calls[0][1]?.body).toEqual(transport.mock.calls[1][1]?.body);
    expect(transport.mock.calls[0][1]?.headers).toEqual(transport.mock.calls[1][1]?.headers);
    const [, request] = transport.mock.calls[0];
    expect(request?.headers).toMatchObject({
      "Idempotency-Key": `cobranzapp-contact/${details.requestId}`,
    });
    expect(JSON.parse(String(request?.body))).toMatchObject({
      to: ["info@cobranzaap.tech"],
      subject: expect.stringContaining("Plan Pro"),
      text: expect.stringContaining(details.phone),
    });
    expect(String(request?.body)).not.toContain("test-secret");
  });

  it.each([403, 429, 500])("sanitizes provider failure %i", async (status) => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("private provider response", { status }));
    await expect(
      createResendContactMailer(
        { apiKey: "secret", from: "sender", to: "recipient" },
        transport,
      ).send(details),
    ).rejects.toThrow("Contact delivery unavailable");
  });

  it("distinguishes reused-key conflicts and network timeouts", async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("conflict", { status: 409 }));
    const mailer = createResendContactMailer(
      { apiKey: "secret", from: "sender", to: "recipient" },
      transport,
    );
    await expect(mailer.send(details)).rejects.toMatchObject({ conflict: true });
    transport.mockRejectedValue(new Error("timeout with sensitive details"));
    await expect(mailer.send(details)).rejects.toEqual(new ContactDeliveryError());
  });
});
