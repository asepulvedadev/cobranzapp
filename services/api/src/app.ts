import type { ServiceStatus } from "@cobranzapp/contracts";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { z } from "zod";
import { LoginRateLimiter } from "./auth/login-rate-limiter.js";
import type { AuthenticatedUser, AuthService } from "./auth/types.js";
import type { PlatformService } from "./platform/types.js";
import type { TenancyService } from "./tenancy/types.js";

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
const tenantIdParamsSchema = z.object({ tenantId: z.uuid() });
const tenantMemberParamsSchema = z.object({ tenantId: z.uuid(), userId: z.uuid() });
const sessionIdParamsSchema = z.object({ sessionId: z.uuid() });
const tenantStatusSchema = z.object({ status: z.enum(["active", "suspended", "archived"]) });
const invitationTokenParamsSchema = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{40,60}$/) });
const invitationSchema = z.object({
  email: z.email().transform((value) => value.toLowerCase()),
  role: z.enum(["owner", "supervisor", "collector", "customer"]),
});
const invitationAcceptanceSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,40}$/),
  displayName: z.string().trim().min(2).max(100),
  password: z.string().min(12).max(256),
});
const nullableText = (maxLength: number) =>
  z.union([z.string().trim().min(1).max(maxLength), z.literal("").transform(() => null), z.null()]);
const tenantSettingsSchema = z.object({
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  contactEmail: z.union([
    z.email().transform((value) => value.toLowerCase()),
    z.literal("").transform(() => null),
    z.null(),
  ]),
  contactPhone: nullableText(30),
  address: nullableText(240),
  version: z.number().int().positive(),
});
const branchSchema = z.object({
  code: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(40),
  displayName: z.string().trim().min(2).max(100),
});
const teamSchema = z.object({
  branchId: z.uuid().nullable(),
  displayName: z.string().trim().min(2).max(100),
});
const memberUpdateSchema = z.object({
  role: z.enum(["supervisor", "collector", "customer"]),
  status: z.enum(["active", "suspended", "revoked"]),
});

export interface AppDependencies {
  allowedWebOrigins?: string[];
  authService: AuthService;
  checkDatabase: () => Promise<void>;
  isProduction?: boolean;
  platformService: PlatformService;
  sessionTtlHours?: number;
  tenancyService: TenancyService;
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

function sessionCookie(token: string, secure: boolean, maxAgeSeconds: number) {
  return `${sessionCookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSeconds}${secure ? "; Secure" : ""}`;
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
  const sessionMaxAgeSeconds = (dependencies.sessionTtlHours ?? 8) * 60 * 60;

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

  async function optionalUser(request: FastifyRequest) {
    const token = parseCookies(request.headers.cookie).get(sessionCookieName);
    return token ? dependencies.authService.authenticate(token) : null;
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
    reply.header("set-cookie", sessionCookie(result.token, secureCookies, sessionMaxAgeSeconds));
    return reply.send({ user: result.user });
  });

  app.get("/v1/auth/me", async (request, reply) => {
    const session = await requireUser(request, reply);
    if (!session) return;
    return { user: session.user };
  });

  app.get("/v1/auth/sessions", async (request, reply) => {
    const session = await requireUser(request, reply);
    if (!session) return;
    return {
      sessions: await dependencies.authService.listSessions(session.user.id, session.token),
    };
  });

  app.delete("/v1/auth/sessions/:sessionId", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session) return;
    const params = sessionIdParamsSchema.safeParse(request.params);
    if (!params.success) {
      return sendError(reply, 404, "SESSION_NOT_FOUND", "La sesión no existe.", request.id);
    }
    const result = await dependencies.authService.revokeSession(
      session.user.id,
      params.data.sessionId,
      session.token,
    );
    if (result === "current") {
      return sendError(
        reply,
        409,
        "CURRENT_SESSION",
        "Usa Cerrar sesión para terminar esta sesión.",
        request.id,
      );
    }
    if (result === "not_found") {
      return sendError(reply, 404, "SESSION_NOT_FOUND", "La sesión no existe.", request.id);
    }
    return reply.code(204).send();
  });

  app.post("/v1/auth/sessions/revoke-others", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session) return;
    const revoked = await dependencies.authService.revokeOtherSessions(
      session.user.id,
      session.token,
    );
    return reply.send({ revoked });
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

  app.patch("/v1/platform/tenants/:tenantId/status", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session || !requireDeveloper(session.user, request, reply)) return;
    const params = tenantIdParamsSchema.safeParse(request.params);
    const body = tenantStatusSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return sendError(
        reply,
        400,
        "INVALID_TENANT_STATUS",
        "El estado solicitado no es válido.",
        request.id,
      );
    }
    const result = await dependencies.platformService.updateTenantStatus(
      session.user.id,
      params.data.tenantId,
      body.data.status,
      request.id,
    );
    switch (result.status) {
      case "updated":
        return reply.send({ tenant: result.tenant });
      case "not_ready": {
        const labels = {
          active_owner: "un propietario activo",
          active_branch: "una sede activa",
          contact_email: "un correo de contacto",
        };
        return sendError(
          reply,
          409,
          "TENANT_NOT_READY",
          `Antes de activar la empresa configura ${result.missing.map((item) => labels[item]).join(", ")}.`,
          request.id,
        );
      }
      case "invalid_transition":
        return sendError(
          reply,
          409,
          "INVALID_TENANT_TRANSITION",
          "Ese cambio de estado no está permitido.",
          request.id,
        );
      default:
        return sendError(reply, 404, "TENANT_NOT_FOUND", "La empresa no existe.", request.id);
    }
  });

  app.post("/v1/platform/tenants/:tenantId/invitations", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session || !requireDeveloper(session.user, request, reply)) return;
    const params = tenantIdParamsSchema.safeParse(request.params);
    const body = invitationSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return sendError(
        reply,
        400,
        "INVALID_INVITATION",
        "Revisa el correo, el rol y la empresa.",
        request.id,
      );
    }
    const invitation = await dependencies.tenancyService.createInvitation(
      { userId: session.user.id, platformRole: "developer", tenantRole: null },
      params.data.tenantId,
      { ...body.data, requestId: request.id },
    );
    if (!invitation)
      return sendError(reply, 404, "TENANT_NOT_FOUND", "La empresa no existe.", request.id);
    return reply.code(201).send({ invitation });
  });

  app.get("/v1/invitations/:token", async (request, reply) => {
    const params = invitationTokenParamsSchema.safeParse(request.params);
    if (!params.success)
      return sendError(reply, 404, "INVITATION_INVALID", "La invitación no es válida.", request.id);
    const invitation = await dependencies.tenancyService.previewInvitation(params.data.token);
    if (!invitation) {
      return sendError(
        reply,
        404,
        "INVITATION_INVALID",
        "La invitación venció o ya no es válida.",
        request.id,
      );
    }
    return { invitation };
  });

  app.post("/v1/invitations/:token/accept", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const params = invitationTokenParamsSchema.safeParse(request.params);
    if (!params.success)
      return sendError(reply, 404, "INVITATION_INVALID", "La invitación no es válida.", request.id);
    const user = await optionalUser(request);
    let acceptanceInput: { existingUserId: string } | z.infer<typeof invitationAcceptanceSchema>;
    if (user) {
      acceptanceInput = { existingUserId: user.id };
    } else {
      const body = invitationAcceptanceSchema.safeParse(request.body);
      if (!body.success) {
        return sendError(
          reply,
          400,
          "INVALID_ACCOUNT",
          "Revisa el nombre, usuario y contraseña.",
          request.id,
        );
      }
      acceptanceInput = body.data;
    }
    const result = await dependencies.tenancyService.acceptInvitation(
      params.data.token,
      acceptanceInput,
      request.id,
    );
    switch (result.status) {
      case "accepted":
        return reply.send({ tenantSlug: result.tenantSlug });
      case "account_exists":
        return sendError(
          reply,
          409,
          "ACCOUNT_EXISTS",
          "Inicia sesión con esa cuenta para aceptar la invitación.",
          request.id,
        );
      case "email_mismatch":
        return sendError(
          reply,
          403,
          "INVITATION_EMAIL_MISMATCH",
          "La invitación corresponde a otra cuenta.",
          request.id,
        );
      case "username_unavailable":
        return sendError(
          reply,
          409,
          "USERNAME_UNAVAILABLE",
          "Ese nombre de usuario no está disponible.",
          request.id,
        );
      case "expired":
        return sendError(reply, 410, "INVITATION_EXPIRED", "La invitación venció.", request.id);
      default:
        return sendError(
          reply,
          404,
          "INVITATION_INVALID",
          "La invitación ya no es válida.",
          request.id,
        );
    }
  });

  app.get("/v1/tenants/:tenantId/overview", async (request, reply) => {
    const session = await requireUser(request, reply);
    if (!session) return;
    const params = tenantIdParamsSchema.safeParse(request.params);
    if (!params.success)
      return sendError(reply, 404, "TENANT_NOT_FOUND", "La empresa no existe.", request.id);
    const membership = session.user.memberships.find(
      (item) => item.tenantId === params.data.tenantId,
    );
    if (!membership)
      return sendError(reply, 403, "SCOPE_DENIED", "No tienes acceso a esta empresa.", request.id);
    const overview = await dependencies.tenancyService.overview(
      {
        userId: session.user.id,
        platformRole: session.user.platformRole,
        tenantRole: membership.role,
      },
      params.data.tenantId,
    );
    if (!overview)
      return sendError(
        reply,
        404,
        "TENANT_NOT_FOUND",
        "La empresa no está disponible.",
        request.id,
      );
    return overview;
  });

  app.post("/v1/tenants/:tenantId/invitations", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session) return;
    const params = tenantIdParamsSchema.safeParse(request.params);
    const body = invitationSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return sendError(
        reply,
        400,
        "INVALID_INVITATION",
        "Revisa el correo, el rol y la empresa.",
        request.id,
      );
    }
    const membership = session.user.memberships.find(
      (item) => item.tenantId === params.data.tenantId,
    );
    if (membership?.role !== "owner") {
      return sendError(
        reply,
        403,
        "OWNER_REQUIRED",
        "Solo el propietario puede invitar usuarios.",
        request.id,
      );
    }
    if (body.data.role === "owner") {
      return sendError(
        reply,
        403,
        "PLATFORM_APPROVAL_REQUIRED",
        "La incorporación de otro propietario requiere aprobación de plataforma.",
        request.id,
      );
    }
    const invitation = await dependencies.tenancyService.createInvitation(
      {
        userId: session.user.id,
        platformRole: session.user.platformRole,
        tenantRole: membership.role,
      },
      params.data.tenantId,
      { ...body.data, requestId: request.id },
    );
    if (!invitation)
      return sendError(reply, 404, "TENANT_NOT_FOUND", "La empresa no existe.", request.id);
    return reply.code(201).send({ invitation });
  });

  app.patch("/v1/tenants/:tenantId/members/:userId", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session) return;
    const params = tenantMemberParamsSchema.safeParse(request.params);
    const body = memberUpdateSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return sendError(
        reply,
        400,
        "INVALID_MEMBER_UPDATE",
        "Revisa el rol y el estado del acceso.",
        request.id,
      );
    }
    const membership = session.user.memberships.find(
      (item) => item.tenantId === params.data.tenantId,
    );
    if (membership?.role !== "owner") {
      return sendError(
        reply,
        403,
        "OWNER_REQUIRED",
        "Solo el propietario puede administrar accesos.",
        request.id,
      );
    }
    const result = await dependencies.tenancyService.updateMember(
      {
        userId: session.user.id,
        platformRole: session.user.platformRole,
        tenantRole: membership.role,
      },
      params.data.tenantId,
      params.data.userId,
      { ...body.data, requestId: request.id },
    );
    if (result.status === "not_found") {
      return sendError(reply, 404, "MEMBER_NOT_FOUND", "El integrante no existe.", request.id);
    }
    if (result.status === "protected") {
      return sendError(
        reply,
        409,
        "PROTECTED_MEMBERSHIP",
        "Este acceso protegido no se puede modificar desde aquí.",
        request.id,
      );
    }
    if (result.status === "invalid_transition") {
      return sendError(
        reply,
        409,
        "MEMBERSHIP_REVOKED",
        "Un acceso revocado no se puede reactivar. Envía una nueva invitación.",
        request.id,
      );
    }
    return reply.send({ member: result.member });
  });

  app.patch("/v1/tenants/:tenantId/settings", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session) return;
    const params = tenantIdParamsSchema.safeParse(request.params);
    const body = tenantSettingsSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return sendError(
        reply,
        400,
        "INVALID_TENANT_SETTINGS",
        "Revisa los datos de contacto y los colores.",
        request.id,
      );
    }
    const membership = session.user.memberships.find(
      (item) => item.tenantId === params.data.tenantId,
    );
    if (membership?.role !== "owner") {
      return sendError(
        reply,
        403,
        "OWNER_REQUIRED",
        "Solo el propietario puede modificar la configuración.",
        request.id,
      );
    }
    const result = await dependencies.tenancyService.updateSettings(
      {
        userId: session.user.id,
        platformRole: session.user.platformRole,
        tenantRole: membership.role,
      },
      params.data.tenantId,
      { ...body.data, requestId: request.id },
    );
    if (result.status === "stale") {
      return sendError(
        reply,
        409,
        "STALE_VERSION",
        "La configuración cambió en otra sesión. Actualiza la página.",
        request.id,
      );
    }
    if (result.status === "not_found") {
      return sendError(
        reply,
        404,
        "TENANT_NOT_FOUND",
        "La empresa no está disponible.",
        request.id,
      );
    }
    return reply.send({ settings: result.settings });
  });

  app.post("/v1/tenants/:tenantId/branches", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session) return;
    const params = tenantIdParamsSchema.safeParse(request.params);
    const body = branchSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return sendError(
        reply,
        400,
        "INVALID_BRANCH",
        "Revisa el nombre y el código de la sede.",
        request.id,
      );
    }
    const membership = session.user.memberships.find(
      (item) => item.tenantId === params.data.tenantId,
    );
    if (membership?.role !== "owner" && membership?.role !== "supervisor") {
      return sendError(
        reply,
        403,
        "MANAGER_REQUIRED",
        "Solo propietarios y supervisores pueden crear sedes.",
        request.id,
      );
    }
    const branch = await dependencies.tenancyService.createBranch(
      {
        userId: session.user.id,
        platformRole: session.user.platformRole,
        tenantRole: membership.role,
      },
      params.data.tenantId,
      { ...body.data, requestId: request.id },
    );
    if (!branch)
      return sendError(
        reply,
        404,
        "TENANT_NOT_FOUND",
        "La empresa no está disponible.",
        request.id,
      );
    return reply.code(201).send({ branch });
  });

  app.post("/v1/tenants/:tenantId/teams", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session) return;
    const params = tenantIdParamsSchema.safeParse(request.params);
    const body = teamSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return sendError(
        reply,
        400,
        "INVALID_TEAM",
        "Revisa el nombre y la sede del equipo.",
        request.id,
      );
    }
    const membership = session.user.memberships.find(
      (item) => item.tenantId === params.data.tenantId,
    );
    if (membership?.role !== "owner" && membership?.role !== "supervisor") {
      return sendError(
        reply,
        403,
        "MANAGER_REQUIRED",
        "Solo propietarios y supervisores pueden crear equipos.",
        request.id,
      );
    }
    const team = await dependencies.tenancyService.createTeam(
      {
        userId: session.user.id,
        platformRole: session.user.platformRole,
        tenantRole: membership.role,
      },
      params.data.tenantId,
      { ...body.data, requestId: request.id },
    );
    if (!team)
      return sendError(
        reply,
        404,
        "TENANT_OR_BRANCH_NOT_FOUND",
        "La empresa o la sede no está disponible.",
        request.id,
      );
    return reply.code(201).send({ team });
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
