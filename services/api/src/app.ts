import type { ServiceStatus } from "@cobranzapp/contracts";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { z } from "zod";
import { LoginRateLimiter } from "./auth/login-rate-limiter.js";
import type { AuthenticatedUser, AuthService } from "./auth/types.js";
import type { PlatformService } from "./platform/types.js";

const sessionCookieName = "cobranzapp_session";
const loginSchema = z.object({
  identifier: z.string().trim().min(3).max(254),
  password: z.string().min(12).max(256),
});
const passwordSchema = z
  .object({
    currentPassword: z.string().min(12).max(256),
    newPassword: z.string().min(12).max(256),
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: "La nueva contraseña debe ser diferente.",
    path: ["newPassword"],
  });
const tenantSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(63),
});

export interface AppDependencies {
  allowedWebOrigins?: string[];
  authService: AuthService;
  checkDatabase: () => Promise<void>;
  isProduction?: boolean;
  platformService: PlatformService;
  version: string;
}

function sendError(
  reply: FastifyReply,
  status: number,
  code: string,
  message: string,
  requestId: string,
) {
  return reply.code(status).send({ error: { code, message, requestId } });
}

function parseCookies(value?: string) {
  const cookies = new Map<string, string>();
  for (const part of value?.split(";") ?? []) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    cookies.set(
      part.slice(0, separator).trim(),
      decodeURIComponent(part.slice(separator + 1).trim()),
    );
  }
  return cookies;
}

function sessionCookie(token: string, secure: boolean) {
  return `${sessionCookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800${secure ? "; Secure" : ""}`;
}

function expiredSessionCookie(secure: boolean) {
  return `${sessionCookieName}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? "; Secure" : ""}`;
}

export function buildApp(dependencies: AppDependencies) {
  const app = Fastify({
    logger: process.env.NODE_ENV !== "test",
    trustProxy: true,
    requestIdHeader: "x-request-id",
  });
  const allowedOrigins = new Set(dependencies.allowedWebOrigins ?? ["http://localhost:3000"]);
  const loginRateLimiter = new LoginRateLimiter();
  const secureCookies = dependencies.isProduction ?? false;

  function requireAllowedOrigin(request: FastifyRequest, reply: FastifyReply) {
    const origin = request.headers.origin;
    if (!origin || !allowedOrigins.has(origin)) {
      sendError(
        reply,
        403,
        "ORIGIN_NOT_ALLOWED",
        "La solicitud no tiene un origen permitido.",
        request.id,
      );
      return false;
    }
    return true;
  }

  async function requireUser(request: FastifyRequest, reply: FastifyReply) {
    const token = parseCookies(request.headers.cookie).get(sessionCookieName);
    if (!token) {
      sendError(reply, 401, "AUTH_REQUIRED", "Debes iniciar sesión.", request.id);
      return null;
    }
    const user = await dependencies.authService.authenticate(token);
    if (!user) {
      reply.header("set-cookie", expiredSessionCookie(secureCookies));
      sendError(reply, 401, "SESSION_INVALID", "La sesión venció o ya no es válida.", request.id);
      return null;
    }
    return { token, user };
  }

  function requireDeveloper(user: AuthenticatedUser, request: FastifyRequest, reply: FastifyReply) {
    if (user.platformRole !== "developer") {
      sendError(
        reply,
        403,
        "DEVELOPER_REQUIRED",
        "No tienes acceso a la consola de plataforma.",
        request.id,
      );
      return false;
    }
    return true;
  }

  app.get(
    "/health",
    async (): Promise<ServiceStatus> => ({
      service: "api",
      status: "ok",
      version: dependencies.version,
      timestamp: new Date().toISOString(),
    }),
  );

  app.get("/ready", async (_request, reply): Promise<ServiceStatus> => {
    try {
      await dependencies.checkDatabase();
      return {
        service: "api",
        status: "ok",
        version: dependencies.version,
        timestamp: new Date().toISOString(),
      };
    } catch (cause) {
      app.log.error({ err: cause }, "Database readiness check failed");
      reply.code(503);
      return {
        service: "api",
        status: "degraded",
        version: dependencies.version,
        timestamp: new Date().toISOString(),
      };
    }
  });

  app.get(
    "/v1/status",
    async (): Promise<ServiceStatus> => ({
      service: "cobranzapp",
      status: "ok",
      version: dependencies.version,
      timestamp: new Date().toISOString(),
    }),
  );

  app.post("/v1/auth/login", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success)
      return sendError(
        reply,
        400,
        "INVALID_LOGIN",
        "Revisa el usuario o correo y la contraseña.",
        request.id,
      );
    const identifier = parsed.data.identifier.toLowerCase();
    const limiterKey = `${request.ip}:${identifier}`;
    if (loginRateLimiter.isBlocked(limiterKey)) {
      return sendError(
        reply,
        429,
        "TOO_MANY_ATTEMPTS",
        "Espera unos minutos antes de volver a intentarlo.",
        request.id,
      );
    }
    const result = await dependencies.authService.login(identifier, parsed.data.password, {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });
    if (!result) {
      loginRateLimiter.registerFailure(limiterKey);
      return sendError(
        reply,
        401,
        "INVALID_CREDENTIALS",
        "El usuario, correo o contraseña no son válidos.",
        request.id,
      );
    }
    loginRateLimiter.clear(limiterKey);
    reply.header("set-cookie", sessionCookie(result.token, secureCookies));
    return reply.send({ user: result.user });
  });

  app.get("/v1/auth/me", async (request, reply) => {
    const session = await requireUser(request, reply);
    if (!session) return;
    return { user: session.user };
  });

  app.post("/v1/auth/logout", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const token = parseCookies(request.headers.cookie).get(sessionCookieName);
    if (token) await dependencies.authService.logout(token);
    reply.header("set-cookie", expiredSessionCookie(secureCookies));
    return reply.code(204).send();
  });

  app.post("/v1/auth/change-password", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session) return;
    const parsed = passwordSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(
        reply,
        400,
        "INVALID_PASSWORD",
        parsed.error.issues[0]?.message ?? "Revisa las contraseñas.",
        request.id,
      );
    }
    const changed = await dependencies.authService.changePassword(
      session.user.id,
      parsed.data.currentPassword,
      parsed.data.newPassword,
    );
    if (!changed)
      return sendError(
        reply,
        400,
        "CURRENT_PASSWORD_INVALID",
        "La contraseña actual no es válida.",
        request.id,
      );
    reply.header("set-cookie", expiredSessionCookie(secureCookies));
    return reply.send({ message: "Contraseña actualizada. Inicia sesión nuevamente." });
  });

  app.get("/v1/platform/overview", async (request, reply) => {
    const session = await requireUser(request, reply);
    if (!session || !requireDeveloper(session.user, request, reply)) return;
    return dependencies.platformService.overview(session.user.id);
  });

  app.post("/v1/platform/tenants", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session || !requireDeveloper(session.user, request, reply)) return;
    const parsed = tenantSchema.safeParse(request.body);
    if (!parsed.success)
      return sendError(
        reply,
        400,
        "INVALID_TENANT",
        "Revisa el nombre y el identificador de la empresa.",
        request.id,
      );
    const tenant = await dependencies.platformService.createTenant(session.user.id, {
      ...parsed.data,
      requestId: request.id,
    });
    return reply.code(201).send({ tenant });
  });

  app.setErrorHandler((cause, request, reply) => {
    request.log.error({ err: cause }, "Unhandled request error");
    if ((cause as { code?: string }).code === "23505") {
      return sendError(
        reply,
        409,
        "RESOURCE_EXISTS",
        "Ya existe un registro con esos datos.",
        request.id,
      );
    }
    return sendError(
      reply,
      500,
      "INTERNAL_ERROR",
      "No pudimos completar la solicitud.",
      request.id,
    );
  });

  return app;
}
