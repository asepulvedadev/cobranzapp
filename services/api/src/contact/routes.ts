import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ContactDeliveryError, type ContactMailer } from "./resend.js";

const contactSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2)
      .max(100)
      .refine((value) =>
        [...value].every(
          (character) =>
            character.charCodeAt(0) >= 32 &&
            character.charCodeAt(0) !== 127 &&
            character !== "<" &&
            character !== ">",
        ),
      ),
    phone: z
      .string()
      .trim()
      .max(30)
      .regex(/^\+?[0-9 ()-]+$/)
      .transform((value) => value.replace(/[ ()-]/g, ""))
      .refine((value) => /^\+?[0-9]{7,15}$/.test(value)),
    plan: z.enum(["Pro", "Ultra"]).optional(),
    source: z
      .enum(["contacto", "demo", "planes", "producto", "nosotros", "blog", "soporte", "inicio"])
      .default("contacto"),
    requestId: z.uuid(),
    website: z.literal("").default(""),
  })
  .strict();

class ContactRateLimiter {
  private readonly windows = new Map<string, { count: number; until: number }>();

  take(key: string, maximum: number, windowMs: number, now = Date.now()) {
    for (const [stored, window] of this.windows) {
      if (window.until <= now) this.windows.delete(stored);
    }
    const window = this.windows.get(key);
    if (window) {
      if (window.count >= maximum) return false;
      window.count += 1;
      return true;
    }
    if (this.windows.size >= 10_000) return false;
    this.windows.set(key, { count: 1, until: now + windowMs });
    return true;
  }
}

export function registerContactRoutes(
  app: FastifyInstance,
  options: { allowedOrigins: string[]; mailer?: ContactMailer },
) {
  const origins = new Set(options.allowedOrigins);
  const limiter = new ContactRateLimiter();
  app.register(async (contactApp) => {
    contactApp.setErrorHandler((_error, request, reply) => {
      const tooLarge = (_error as { code?: string }).code === "FST_ERR_CTP_BODY_TOO_LARGE";
      reply.code(tooLarge ? 413 : 400).send({
        error: {
          code: tooLarge ? "CONTACT_TOO_LARGE" : "INVALID_CONTACT",
          message: "Revisa tu nombre y teléfono e intenta de nuevo.",
          requestId: request.id,
        },
      });
    });
    contactApp.post("/v1/contact", { bodyLimit: 2_048 }, async (request, reply) => {
      reply.header("cache-control", "no-store");
      const fail = (status: number, code: string, message: string) =>
        reply.code(status).send({ error: { code, message, requestId: request.id } });
      if (!request.headers.origin || !origins.has(request.headers.origin)) {
        return fail(403, "ORIGIN_NOT_ALLOWED", "La solicitud no tiene un origen permitido.");
      }
      if (!limiter.take(`ip:${request.ips?.[1] ?? request.ip}`, 5, 15 * 60_000)) {
        reply.header("retry-after", "900");
        return fail(429, "CONTACT_RATE_LIMITED", "Espera unos minutos antes de volver a intentar.");
      }
      const parsed = contactSchema.safeParse(request.body);
      if (!parsed.success) {
        return fail(400, "INVALID_CONTACT", "Revisa tu nombre y teléfono e intenta de nuevo.");
      }
      if (!options.mailer) {
        return fail(
          503,
          "CONTACT_UNAVAILABLE",
          "El contacto no está disponible. Intenta más tarde.",
        );
      }
      if (!limiter.take("global", 30, 15 * 60_000) || !limiter.take("burst", 2, 1_000)) {
        reply.header("retry-after", "60");
        return fail(429, "CONTACT_RATE_LIMITED", "Espera un momento antes de volver a intentar.");
      }
      try {
        const id = await options.mailer.send(parsed.data);
        return reply.code(202).send({ accepted: true, id });
      } catch (error) {
        if (error instanceof ContactDeliveryError && error.conflict) {
          return fail(409, "CONTACT_CONFLICT", "Actualiza los datos y vuelve a intentar.");
        }
        request.log.warn({ requestId: request.id }, "Contact email was not accepted");
        return fail(
          503,
          "CONTACT_UNAVAILABLE",
          "No pudimos enviar tu solicitud. Conservamos tus datos en el formulario para que reintentes.",
        );
      }
    });
  });
}
