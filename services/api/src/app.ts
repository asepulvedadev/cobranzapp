import {
  borrowerAddressGeocodeRequestSchema,
  borrowerAddressUpdateRequestSchema,
  borrowerCreateRequestSchema,
  borrowerDirectoryQuerySchema,
  borrowerOcrConfirmRequestSchema,
  borrowerReviewRequestSchema,
  changePasswordRequestSchema,
  createBranchRequestSchema,
  createCompanyCreationCodeRequestSchema,
  createOwnerTenantRequestSchema,
  createPlatformOwnerRequestSchema,
  createPlatformTenantRequestSchema,
  createTeamRequestSchema,
  financialSchedulePreviewRequestSchema,
  loanApplicationCreateRequestSchema,
  loanPaymentCreateRequestSchema,
  loanProductCreateRequestSchema,
  loanProductUpdateRequestSchema,
  loanRenewalRequestSchema,
  loginRequestSchema,
  mfaCodeRequestSchema,
  organizationStatusUpdateRequestSchema,
  platformActivityQuerySchema,
  platformMembershipEntitlementUpdateRequestSchema,
  platformMembershipPlanUpdateRequestSchema,
  platformTenantDirectoryQuerySchema,
  platformTenantStatusUpdateRequestSchema,
  platformUserDirectoryQuerySchema,
  platformUserMembershipUpdateRequestSchema,
  platformUserStatusUpdateRequestSchema,
  reauthenticationRequestSchema,
  routeAssignmentUpdateRequestSchema,
  routeCreateRequestSchema,
  routeStatusUpdateRequestSchema,
  routeStopCreateRequestSchema,
  routeStopOptimizeRequestSchema,
  routeStopReorderRequestSchema,
  routeStopVisitRequestSchema,
  type ServiceStatus,
  sharedClientVerificationRequestSchema,
  tenantInvitationRequestSchema,
  tenantMemberCreateRequestSchema,
  tenantMemberProfileRequestSchema,
  tenantMemberUpdateRequestSchema,
  tenantSettingsUpdateRequestSchema,
  userProfileUpdateRequestSchema,
  verificationNetworkAssertionRequestSchema,
  verificationNetworkConsentRequestSchema,
  verificationNetworkCorrectionRequestSchema,
  verificationNetworkQueryRequestSchema,
} from "@cobranzapp/contracts";
import { createOpenApiDocument } from "@cobranzapp/contracts/openapi";
import type { IdentityExtractor, IdentityImage } from "@cobranzapp/hermes-ocr";
import multipart from "@fastify/multipart";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import QRCode from "qrcode";
import { z } from "zod";
import { LoginRateLimiter } from "./auth/login-rate-limiter.js";
import type { AuthenticatedUser, AuthService } from "./auth/types.js";
import type { BorrowerDocumentStorage } from "./borrowers/document-storage.js";
import {
  borrowerDocumentUploadLimits,
  validateIdentityExtractionImage,
} from "./borrowers/document-storage.js";
import type { BorrowerService } from "./borrowers/types.js";
import type { ContactMailer } from "./contact/resend.js";
import { registerContactRoutes } from "./contact/routes.js";
import type { CreditService } from "./credit/types.js";
import type { PlatformService } from "./platform/types.js";
import type { RouteService } from "./routes/types.js";
import type { SupportAccessService } from "./support-access/types.js";
import type { TenancyService } from "./tenancy/types.js";
import type { VerificationNetworkService } from "./verification-network/types.js";

const sessionCookieName = "cobranzapp_session";
const mfaChallengeCookieName = "cobranzapp_mfa_challenge";
const tenantIdParamsSchema = z.object({ tenantId: z.uuid() });
const tenantLoanProductParamsSchema = z.object({ tenantId: z.uuid(), productId: z.uuid() });
const tenantLoanApplicationParamsSchema = z.object({
  tenantId: z.uuid(),
  applicationId: z.uuid(),
});
const tenantRouteParamsSchema = z.object({ tenantId: z.uuid(), routeId: z.uuid() });
const tenantRouteStopParamsSchema = z.object({
  tenantId: z.uuid(),
  routeId: z.uuid(),
  stopId: z.uuid(),
});
const tenantInvitationParamsSchema = z.object({ tenantId: z.uuid(), invitationId: z.uuid() });
const tenantMemberParamsSchema = z.object({ tenantId: z.uuid(), userId: z.uuid() });
const tenantMemberProfileParamsSchema = z.object({ tenantId: z.uuid(), userId: z.uuid() });
const supportAccessParamsSchema = z.object({ accessId: z.uuid() });
const tenantSupportAccessParamsSchema = z.object({ tenantId: z.uuid(), accessId: z.uuid() });
const tenantTeamMemberParamsSchema = z.object({
  tenantId: z.uuid(),
  teamId: z.uuid(),
  userId: z.uuid(),
});
const tenantBranchParamsSchema = z.object({ tenantId: z.uuid(), branchId: z.uuid() });
const tenantTeamParamsSchema = z.object({ tenantId: z.uuid(), teamId: z.uuid() });
const tenantBorrowerParamsSchema = z.object({ tenantId: z.uuid(), borrowerId: z.uuid() });
const tenantBorrowerOcrParamsSchema = z.object({
  tenantId: z.uuid(),
  borrowerId: z.uuid(),
  extractionId: z.uuid(),
});
const verificationNetworkParamsSchema = z.object({ tenantId: z.uuid() });
const verificationNetworkConsentParamsSchema = z.object({
  tenantId: z.uuid(),
  consentId: z.uuid(),
});
const sessionIdParamsSchema = z.object({ sessionId: z.uuid() });
const platformUserParamsSchema = z.object({ userId: z.uuid() });
const invitationTokenParamsSchema = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{40,60}$/) });
const invitationAcceptanceSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,40}$/),
  displayName: z.string().trim().min(2).max(100),
  password: z.string().min(12).max(256),
});
const supportAccessRequestSchema = z.object({
  purpose: z.string().trim().min(12).max(240),
  durationMinutes: z.number().int().min(15).max(480),
});
const supportAccessReviewSchema = z.object({ action: z.enum(["approve", "deny", "revoke"]) });

export interface AppDependencies {
  identityExtractor?: IdentityExtractor;
  borrowerService?: BorrowerService;
  creditService?: CreditService;
  routeService?: RouteService;
  documentStorage?: BorrowerDocumentStorage;
  contactMailer?: ContactMailer;
  allowedWebOrigins?: string[];
  authService: AuthService;
  checkDatabase: () => Promise<void>;
  isProduction?: boolean;
  platformService: PlatformService;
  sessionTtlHours?: number;
  supportAccessService: SupportAccessService;
  tenancyService: TenancyService;
  verificationNetworkService?: VerificationNetworkService;
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

function mfaChallengeCookie(token: string, secure: boolean) {
  return `${mfaChallengeCookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=300${secure ? "; Secure" : ""}`;
}

function expiredMfaChallengeCookie(secure: boolean) {
  return `${mfaChallengeCookieName}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? "; Secure" : ""}`;
}

export function buildApp(dependencies: AppDependencies) {
  const app = Fastify({
    logger: process.env.NODE_ENV !== "test",
    trustProxy: true,
    requestIdHeader: "x-request-id",
  });
  app.register(multipart, { limits: borrowerDocumentUploadLimits });
  const allowedOrigins = new Set(dependencies.allowedWebOrigins ?? ["http://localhost:3000"]);
  registerContactRoutes(app, {
    allowedOrigins: [...allowedOrigins],
    mailer: dependencies.contactMailer,
  });
  const loginRateLimiter = new LoginRateLimiter();
  const reauthenticationRateLimiter = new LoginRateLimiter();
  const identityOcrRateLimiter = new LoginRateLimiter(12, 60_000);
  const secureCookies = dependencies.isProduction ?? false;
  const sessionMaxAgeSeconds = (dependencies.sessionTtlHours ?? 8) * 60 * 60;
  const reauthenticationWindowMinutes = 10;

  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("x-content-type-options", "nosniff");
    reply.header("x-frame-options", "DENY");
    reply.header("referrer-policy", "no-referrer");
    reply.header("permissions-policy", "camera=(), microphone=(), geolocation=()");
    if (secureCookies) {
      reply.header("strict-transport-security", "max-age=31536000; includeSubDomains");
    }
    return payload;
  });

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

  async function requireRecentReauthentication(
    session: { token: string; user: AuthenticatedUser },
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const recent = await dependencies.authService.isRecentlyReauthenticated(
      session.user.id,
      session.token,
      reauthenticationWindowMinutes,
    );
    if (!recent) {
      sendError(
        reply,
        428,
        "REAUTHENTICATION_REQUIRED",
        "Confirma tu contraseña para realizar esta acción.",
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

  app.get("/v1/openapi.json", async (_request, reply) => {
    reply.header("cache-control", "public, max-age=300");
    return createOpenApiDocument(dependencies.version);
  });

  app.post("/v1/auth/login", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const parsed = loginRequestSchema.safeParse(request.body);
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
      requestId: request.id,
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
    if (result.status === "mfa_required") {
      reply.header("set-cookie", mfaChallengeCookie(result.challengeToken, secureCookies));
      reply.header("cache-control", "no-store");
      return reply.code(202).send({ mfaRequired: true, expiresAt: result.expiresAt });
    }
    reply.header("set-cookie", sessionCookie(result.token, secureCookies, sessionMaxAgeSeconds));
    return reply.send({ user: result.user });
  });

  app.post("/v1/auth/mfa/verify-login", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const parsed = mfaCodeRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(
        reply,
        400,
        "MFA_CODE_INVALID",
        "Escribe un código válido de autenticación o recuperación.",
        request.id,
      );
    }
    const challengeToken = parseCookies(request.headers.cookie).get(mfaChallengeCookieName);
    if (!challengeToken) {
      return sendError(
        reply,
        401,
        "MFA_CHALLENGE_REQUIRED",
        "Inicia sesión nuevamente para verificar tu identidad.",
        request.id,
      );
    }
    const result = await dependencies.authService.verifyMfaChallenge(
      challengeToken,
      parsed.data.code,
      request.id,
    );
    if (result.status === "invalid") {
      return sendError(
        reply,
        401,
        "MFA_CODE_INVALID",
        "El código no es válido o ya fue utilizado.",
        request.id,
      );
    }
    if (result.status === "expired") {
      reply.header("set-cookie", expiredMfaChallengeCookie(secureCookies));
      return sendError(
        reply,
        410,
        "MFA_CHALLENGE_EXPIRED",
        "La verificación venció. Inicia sesión nuevamente.",
        request.id,
      );
    }
    if (result.status === "locked") {
      reply.header("set-cookie", expiredMfaChallengeCookie(secureCookies));
      return sendError(
        reply,
        429,
        "MFA_CHALLENGE_LOCKED",
        "Agotaste los intentos. Inicia sesión nuevamente.",
        request.id,
      );
    }
    reply.header("set-cookie", [
      sessionCookie(result.token, secureCookies, sessionMaxAgeSeconds),
      expiredMfaChallengeCookie(secureCookies),
    ]);
    reply.header("cache-control", "no-store");
    return reply.send({ user: result.user });
  });

  app.get("/v1/auth/me", async (request, reply) => {
    const session = await requireUser(request, reply);
    if (!session) return;
    return { user: session.user };
  });

  app.get("/v1/account/profile", async (request, reply) => {
    const session = await requireUser(request, reply);
    if (!session) return;
    const getUserProfile = dependencies.platformService.getUserProfile;
    if (!getUserProfile) {
      return sendError(
        reply,
        501,
        "PROFILE_UNAVAILABLE",
        "El perfil todavía no está habilitado.",
        request.id,
      );
    }
    const profile = await getUserProfile(session.user.id);
    if (!profile)
      return sendError(reply, 404, "PROFILE_NOT_FOUND", "El perfil no existe.", request.id);
    return reply.send({ profile });
  });

  app.put("/v1/account/profile", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session) return;
    if (!(await requireRecentReauthentication(session, request, reply))) return;
    const body = userProfileUpdateRequestSchema.safeParse(request.body);
    const updateUserProfile = dependencies.platformService.updateUserProfile;
    if (!body.success || !updateUserProfile) {
      return sendError(reply, 400, "INVALID_PROFILE", "Revisa los datos personales.", request.id);
    }
    const result = await updateUserProfile(session.user.id, session.user.id, body.data, request.id);
    if (result.status === "forbidden")
      return sendError(reply, 403, "SCOPE_DENIED", "No puedes actualizar este perfil.", request.id);
    if (result.status === "not_found")
      return sendError(reply, 404, "PROFILE_NOT_FOUND", "El perfil no existe.", request.id);
    return reply.send({ profile: result.profile });
  });

  app.get("/v1/account/profile-photo", async (request, reply) => {
    const session = await requireUser(request, reply);
    if (!session) return;
    const getUserProfile = dependencies.platformService.getUserProfile;
    const storage = dependencies.documentStorage;
    if (!getUserProfile || !storage)
      return sendError(
        reply,
        503,
        "PROFILE_PHOTO_UNAVAILABLE",
        "La foto todavía no está configurada.",
        request.id,
      );
    const profile = await getUserProfile(session.user.id);
    const objectKey = profile?.profilePhotoObjectKey;
    if (!objectKey?.startsWith(`users/${session.user.id}/profile/`)) {
      return sendError(reply, 404, "PROFILE_PHOTO_NOT_FOUND", "No hay foto de perfil.", request.id);
    }
    const stored = await storage.read(objectKey);
    if (!stored)
      return sendError(reply, 404, "PROFILE_PHOTO_NOT_FOUND", "No hay foto de perfil.", request.id);
    return reply
      .type(stored.mediaType)
      .header("cache-control", "private, no-store")
      .send(stored.bytes);
  });

  app.post("/v1/account/profile-photo", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session) return;
    if (!(await requireRecentReauthentication(session, request, reply))) return;
    const setUserProfilePhoto = dependencies.platformService.setUserProfilePhoto;
    const storage = dependencies.documentStorage;
    if (!setUserProfilePhoto || !storage)
      return sendError(
        reply,
        503,
        "PROFILE_PHOTO_UNAVAILABLE",
        "La carga privada de fotos todavía no está configurada.",
        request.id,
      );
    let mediaType = "";
    let fileBytes: Buffer | null = null;
    try {
      for await (const part of request.parts()) {
        if (part.type !== "file") continue;
        if (fileBytes)
          return sendError(
            reply,
            400,
            "TOO_MANY_PROFILE_PHOTOS",
            "Solo puedes cargar una foto por vez.",
            request.id,
          );
        mediaType = part.mimetype;
        fileBytes = await part.toBuffer();
      }
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "FST_REQ_FILE_TOO_LARGE"
      ) {
        return sendError(
          reply,
          413,
          "PROFILE_PHOTO_TOO_LARGE",
          "La foto supera el límite de 10 MB.",
          request.id,
        );
      }
      throw error;
    }
    if (!fileBytes || !mediaType)
      return sendError(
        reply,
        400,
        "PROFILE_PHOTO_REQUIRED",
        "Debes seleccionar una foto.",
        request.id,
      );
    try {
      const stored = await storage.quarantineUserProfile({
        userId: session.user.id,
        mediaType,
        bytes: fileBytes,
      });
      const result = await setUserProfilePhoto(
        session.user.id,
        session.user.id,
        stored.objectKey,
        request.id,
      );
      if (result.status !== "updated")
        await storage.remove(stored.objectKey).catch(() => undefined);
      if (result.status === "not_found")
        return sendError(reply, 404, "PROFILE_NOT_FOUND", "El perfil no existe.", request.id);
      if (result.status === "forbidden")
        return sendError(
          reply,
          403,
          "SCOPE_DENIED",
          "No puedes actualizar este perfil.",
          request.id,
        );
      return reply.send({ profile: result.profile });
    } catch (error) {
      if (error instanceof Error) {
        const messages: Record<string, [number, string, string]> = {
          UNSUPPORTED_DOCUMENT_TYPE: [
            400,
            "UNSUPPORTED_PROFILE_PHOTO_TYPE",
            "El formato no está permitido.",
          ],
          DOCUMENT_SIZE_INVALID: [
            400,
            "PROFILE_PHOTO_SIZE_INVALID",
            "La foto está vacía o supera 10 MB.",
          ],
          DOCUMENT_CONTENT_INVALID: [
            400,
            "PROFILE_PHOTO_CONTENT_INVALID",
            "El contenido no coincide con su formato.",
          ],
          PROFILE_PHOTO_TYPE_INVALID: [
            400,
            "PROFILE_PHOTO_TYPE_INVALID",
            "La foto debe ser una imagen.",
          ],
        };
        const mapped = messages[error.message];
        if (mapped) return sendError(reply, mapped[0], mapped[1], mapped[2], request.id);
      }
      throw error;
    }
  });

  app.post("/v1/account/tenants", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session) return;
    if (session.user.platformRole === "developer") {
      return sendError(
        reply,
        403,
        "PLATFORM_ACCOUNT_ONLY",
        "Las empresas se crean desde una cuenta de propietario.",
        request.id,
      );
    }
    const body = createOwnerTenantRequestSchema.safeParse(request.body);
    if (!body.success || !dependencies.platformService.createTenantForOwner) {
      return sendError(
        reply,
        400,
        "INVALID_COMPANY_ONBOARDING",
        "Revisa el nombre y la contraseña de confirmación.",
        request.id,
      );
    }
    const reauthenticated = await dependencies.authService.reauthenticate(
      session.user.id,
      session.token,
      body.data.password,
      request.id,
    );
    if (!reauthenticated) {
      return sendError(
        reply,
        401,
        "REAUTHENTICATION_FAILED",
        "La contraseña de confirmación no es válida.",
        request.id,
      );
    }
    try {
      const tenant = await dependencies.platformService.createTenantForOwner(session.user.id, {
        code: body.data.code,
        displayName: body.data.displayName,
        requestId: request.id,
      });
      if (tenant.status === "invalid_code") {
        return sendError(
          reply,
          403,
          "COMPANY_CODE_INVALID",
          "El código no corresponde a esta cuenta o ya fue utilizado.",
          request.id,
        );
      }
      if (tenant.status === "expired_code") {
        return sendError(
          reply,
          410,
          "COMPANY_CODE_EXPIRED",
          "El código de empresa venció. Solicita uno nuevo.",
          request.id,
        );
      }
      if (tenant.status === "no_subscription") {
        return sendError(
          reply,
          403,
          "SUBSCRIPTION_REQUIRED",
          "Tu cuenta no tiene una suscripción disponible. Solicita al desarrollador que active una.",
          request.id,
        );
      }
      return reply.code(201).send({
        tenant: {
          tenantId: tenant.tenantId,
          tenantName: tenant.tenantName,
          tenantSlug: tenant.tenantSlug,
          role: tenant.role,
        },
      });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "23505") {
        return sendError(
          reply,
          409,
          "COMPANY_NAME_UNAVAILABLE",
          "Ese nombre de empresa ya está en uso. Elige otro.",
          request.id,
        );
      }
      throw error;
    }
  });

  app.get("/v1/account/subscriptions", async (request, reply) => {
    const session = await requireUser(request, reply);
    if (!session) return;
    if (session.user.platformRole === "developer") {
      return sendError(
        reply,
        403,
        "OWNER_ACCOUNT_REQUIRED",
        "Las suscripciones empresariales pertenecen a cuentas de propietario.",
        request.id,
      );
    }
    const getOwnerSubscriptionSummary = dependencies.platformService.getOwnerSubscriptionSummary;
    if (!getOwnerSubscriptionSummary) {
      return sendError(
        reply,
        501,
        "SUBSCRIPTIONS_UNAVAILABLE",
        "El resumen de suscripciones todavía no está habilitado.",
        request.id,
      );
    }
    return reply.send(await getOwnerSubscriptionSummary(session.user.id));
  });

  app.get("/v1/auth/sessions", async (request, reply) => {
    const session = await requireUser(request, reply);
    if (!session) return;
    return {
      sessions: await dependencies.authService.listSessions(session.user.id, session.token),
    };
  });

  app.get("/v1/auth/security-activity", async (request, reply) => {
    const session = await requireUser(request, reply);
    if (!session) return;
    return { activity: await dependencies.authService.listSecurityActivity(session.user.id) };
  });

  app.get("/v1/auth/mfa", async (request, reply) => {
    const session = await requireUser(request, reply);
    if (!session) return;
    reply.header("cache-control", "no-store");
    return { mfa: await dependencies.authService.getMfaStatus(session.user.id) };
  });

  app.post("/v1/auth/mfa/setup", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session || !(await requireRecentReauthentication(session, request, reply))) return;
    const result = await dependencies.authService.beginMfaEnrollment(session.user.id, request.id);
    if (result.status === "already_enabled") {
      return sendError(
        reply,
        409,
        "MFA_ALREADY_ENABLED",
        "La verificación en dos pasos ya está activa.",
        request.id,
      );
    }
    if (result.status === "not_found") {
      return sendError(reply, 404, "USER_NOT_FOUND", "El usuario no existe.", request.id);
    }
    const qrDataUrl = await QRCode.toDataURL(result.uri, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 240,
    });
    reply.header("cache-control", "no-store");
    return reply.code(201).send({
      enrollment: {
        secret: result.secret,
        qrDataUrl,
        expiresAt: result.expiresAt,
      },
    });
  });

  app.post("/v1/auth/mfa/enable", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session || !(await requireRecentReauthentication(session, request, reply))) return;
    const parsed = mfaCodeRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(
        reply,
        400,
        "MFA_CODE_INVALID",
        "Escribe el código de seis dígitos.",
        request.id,
      );
    }
    const result = await dependencies.authService.confirmMfaEnrollment(
      session.user.id,
      session.token,
      parsed.data.code,
      request.id,
    );
    if (result.status === "invalid") {
      return sendError(
        reply,
        400,
        "MFA_CODE_INVALID",
        "El código no es válido o ya fue utilizado.",
        request.id,
      );
    }
    if (result.status === "expired") {
      return sendError(
        reply,
        410,
        "MFA_SETUP_EXPIRED",
        "La configuración venció. Iníciala nuevamente.",
        request.id,
      );
    }
    if (result.status === "already_enabled") {
      return sendError(
        reply,
        409,
        "MFA_ALREADY_ENABLED",
        "La verificación en dos pasos ya está activa.",
        request.id,
      );
    }
    if (result.status === "not_found") {
      return sendError(reply, 404, "USER_NOT_FOUND", "El usuario no existe.", request.id);
    }
    reply.header("cache-control", "no-store");
    return reply.send({
      mfa: { enabled: true },
      recoveryCodes: result.recoveryCodes,
      revokedSessions: result.revokedSessions,
    });
  });

  app.delete("/v1/auth/mfa", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session || !(await requireRecentReauthentication(session, request, reply))) return;
    const parsed = mfaCodeRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(
        reply,
        400,
        "MFA_CODE_INVALID",
        "Escribe un código válido de autenticación o recuperación.",
        request.id,
      );
    }
    const result = await dependencies.authService.disableMfa(
      session.user.id,
      session.token,
      parsed.data.code,
      request.id,
    );
    if (result.status === "invalid") {
      return sendError(
        reply,
        400,
        "MFA_CODE_INVALID",
        "El código no es válido o ya fue utilizado.",
        request.id,
      );
    }
    if (result.status === "not_enabled") {
      return sendError(
        reply,
        409,
        "MFA_NOT_ENABLED",
        "La verificación en dos pasos no está activa.",
        request.id,
      );
    }
    if (result.status === "not_found") {
      return sendError(reply, 404, "USER_NOT_FOUND", "El usuario no existe.", request.id);
    }
    reply.header("cache-control", "no-store");
    return reply.send({
      mfa: { enabled: false },
      revokedSessions: result.revokedSessions,
    });
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
      request.id,
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
      request.id,
    );
    return reply.send({ revoked });
  });

  app.post("/v1/auth/reauthenticate", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session) return;
    const parsed = reauthenticationRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, 400, "INVALID_PASSWORD", "Escribe tu contraseña actual.", request.id);
    }
    const limiterKey = `${request.ip}:${session.user.id}`;
    if (reauthenticationRateLimiter.isBlocked(limiterKey)) {
      return sendError(
        reply,
        429,
        "TOO_MANY_ATTEMPTS",
        "Espera unos minutos antes de volver a intentarlo.",
        request.id,
      );
    }
    const authenticated = await dependencies.authService.reauthenticate(
      session.user.id,
      session.token,
      parsed.data.password,
      request.id,
    );
    if (!authenticated) {
      reauthenticationRateLimiter.registerFailure(limiterKey);
      return sendError(
        reply,
        401,
        "REAUTHENTICATION_FAILED",
        "La contraseña no es válida.",
        request.id,
      );
    }
    reauthenticationRateLimiter.clear(limiterKey);
    return reply.send({ reauthenticated: true, validForMinutes: reauthenticationWindowMinutes });
  });

  app.post("/v1/auth/logout", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const token = parseCookies(request.headers.cookie).get(sessionCookieName);
    if (token) await dependencies.authService.logout(token, request.id);
    reply.header("set-cookie", expiredSessionCookie(secureCookies));
    return reply.code(204).send();
  });

  app.post("/v1/auth/change-password", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session) return;
    const parsed = changePasswordRequestSchema.safeParse(request.body);
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
      request.id,
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

  app.get("/v1/platform/activity", async (request, reply) => {
    const session = await requireUser(request, reply);
    if (!session || !requireDeveloper(session.user, request, reply)) return;
    const parsed = platformActivityQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return sendError(
        reply,
        400,
        "INVALID_ACTIVITY_FILTERS",
        "Revisa los filtros de actividad.",
        request.id,
      );
    }
    return dependencies.platformService.listActivity(session.user.id, {
      search: parsed.data.q || null,
      action: parsed.data.action || null,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
    });
  });

  app.get("/v1/platform/system-status", async (request, reply) => {
    const session = await requireUser(request, reply);
    if (!session || !requireDeveloper(session.user, request, reply)) return;
    const database = await dependencies.platformService.systemStatus(session.user.id);
    return {
      api: { status: "operational", version: dependencies.version },
      database: { status: "operational", schemaVersion: database.schemaVersion },
      jobs: database.jobs,
      checkedAt: database.checkedAt,
    };
  });

  app.get("/v1/platform/tenants", async (request, reply) => {
    const session = await requireUser(request, reply);
    if (!session || !requireDeveloper(session.user, request, reply)) return;
    const parsed = platformTenantDirectoryQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return sendError(
        reply,
        400,
        "INVALID_TENANT_FILTERS",
        "Revisa los filtros del directorio de empresas.",
        request.id,
      );
    }
    return dependencies.platformService.listTenants(session.user.id, {
      search: parsed.data.q || null,
      status: parsed.data.status ?? null,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
    });
  });

  app.get("/v1/platform/users", async (request, reply) => {
    const session = await requireUser(request, reply);
    if (!session || !requireDeveloper(session.user, request, reply)) return;
    const parsed = platformUserDirectoryQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return sendError(
        reply,
        400,
        "INVALID_USER_FILTERS",
        "Revisa los filtros del directorio de usuarios.",
        request.id,
      );
    }
    return dependencies.platformService.listUsers(session.user.id, {
      search: parsed.data.q || null,
      status: parsed.data.status ?? null,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
    });
  });

  app.patch("/v1/platform/users/:userId/status", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session || !requireDeveloper(session.user, request, reply)) return;
    const params = platformUserParamsSchema.safeParse(request.params);
    const body = platformUserStatusUpdateRequestSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return sendError(
        reply,
        400,
        "INVALID_USER_STATUS",
        "El estado solicitado no es válido.",
        request.id,
      );
    }
    if (!(await requireRecentReauthentication(session, request, reply))) return;
    const result = await dependencies.platformService.updateUserStatus(
      session.user.id,
      params.data.userId,
      body.data.status,
      request.id,
    );
    if (result.status === "protected") {
      return sendError(
        reply,
        409,
        "USER_PROTECTED",
        "Las cuentas de desarrollo se administran fuera del directorio general.",
        request.id,
      );
    }
    if (result.status === "not_found") {
      return sendError(reply, 404, "USER_NOT_FOUND", "El usuario no existe.", request.id);
    }
    return reply.send({
      status: result.userStatus,
      revokedSessions: result.revokedSessions,
    });
  });

  app.patch("/v1/platform/users/:userId/membership", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session || !requireDeveloper(session.user, request, reply)) return;
    const params = platformUserParamsSchema.safeParse(request.params);
    const body = platformUserMembershipUpdateRequestSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return sendError(
        reply,
        400,
        "INVALID_USER_MEMBERSHIP",
        "Selecciona una membresía Pro o Ultra válida.",
        request.id,
      );
    }
    if (!(await requireRecentReauthentication(session, request, reply))) return;
    const updateUserMembership = dependencies.platformService.updateUserMembership;
    if (!updateUserMembership) {
      return sendError(
        reply,
        501,
        "USER_MEMBERSHIP_UNAVAILABLE",
        "La activación de membresías todavía no está habilitada.",
        request.id,
      );
    }
    const result = await updateUserMembership(
      session.user.id,
      params.data.userId,
      body.data,
      request.id,
    );
    if (result.status === "not_found") {
      return sendError(reply, 404, "USER_NOT_FOUND", "El usuario no existe.", request.id);
    }
    if (result.status === "protected") {
      return sendError(
        reply,
        409,
        "USER_MEMBERSHIP_PROTECTED",
        "No puedes activar membresías para una cuenta deshabilitada o de desarrollo.",
        request.id,
      );
    }
    return reply.send({
      membershipPlan: result.membershipPlan,
      activatedAt: result.activatedAt,
    });
  });

  app.post("/v1/platform/tenants", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session || !requireDeveloper(session.user, request, reply)) return;
    const parsed = createPlatformTenantRequestSchema.safeParse(request.body);
    if (!parsed.success)
      return sendError(
        reply,
        400,
        "INVALID_TENANT",
        "Revisa el nombre y el identificador de la empresa.",
        request.id,
      );
    if (!(await requireRecentReauthentication(session, request, reply))) return;
    const tenant = await dependencies.platformService.createTenant(session.user.id, {
      ...parsed.data,
      requestId: request.id,
    });
    return reply.code(201).send({ tenant });
  });

  app.post("/v1/platform/owners", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session || !requireDeveloper(session.user, request, reply)) return;
    const parsed = createPlatformOwnerRequestSchema.safeParse(request.body);
    if (!parsed.success || !dependencies.platformService.createOwnerAccount) {
      return sendError(
        reply,
        400,
        "INVALID_OWNER_ACCOUNT",
        "Revisa los datos del propietario.",
        request.id,
      );
    }
    if (!(await requireRecentReauthentication(session, request, reply))) return;
    try {
      const result = await dependencies.platformService.createOwnerAccount(session.user.id, {
        ...parsed.data,
        requestId: request.id,
      });
      return reply.code(201).send(result);
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        return sendError(
          reply,
          409,
          "OWNER_ACCOUNT_EXISTS",
          "Ya existe una cuenta con ese usuario o correo.",
          request.id,
        );
      }
      throw error;
    }
  });

  app.post("/v1/platform/company-codes", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session || !requireDeveloper(session.user, request, reply)) return;
    const parsed = createCompanyCreationCodeRequestSchema.safeParse(request.body);
    if (!parsed.success || !dependencies.platformService.issueCompanyCreationCode) {
      return sendError(
        reply,
        400,
        "INVALID_COMPANY_CODE",
        "Selecciona un propietario y un plan válido.",
        request.id,
      );
    }
    if (!(await requireRecentReauthentication(session, request, reply))) return;
    try {
      const code = await dependencies.platformService.issueCompanyCreationCode(session.user.id, {
        ...parsed.data,
        requestId: request.id,
      });
      return reply.code(201).send({ code });
    } catch (error) {
      if (error instanceof Error && error.message === "OWNER_NOT_FOUND") {
        return sendError(
          reply,
          404,
          "OWNER_NOT_FOUND",
          "El propietario no existe o está deshabilitado.",
          request.id,
        );
      }
      throw error;
    }
  });

  app.patch("/v1/platform/tenants/:tenantId/status", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session || !requireDeveloper(session.user, request, reply)) return;
    const params = tenantIdParamsSchema.safeParse(request.params);
    const body = platformTenantStatusUpdateRequestSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return sendError(
        reply,
        400,
        "INVALID_TENANT_STATUS",
        "El estado solicitado no es válido.",
        request.id,
      );
    }
    if (!(await requireRecentReauthentication(session, request, reply))) return;
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
          membership_plan: "un plan comercial",
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

  app.patch("/v1/platform/tenants/:tenantId/membership-plan", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session || !requireDeveloper(session.user, request, reply)) return;
    const params = tenantIdParamsSchema.safeParse(request.params);
    const body = platformMembershipPlanUpdateRequestSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return sendError(
        reply,
        400,
        "INVALID_MEMBERSHIP_PLAN",
        "Selecciona un plan Pro o Ultra válido.",
        request.id,
      );
    }
    if (!(await requireRecentReauthentication(session, request, reply))) return;
    const result = await dependencies.platformService.updateMembershipPlan(
      session.user.id,
      params.data.tenantId,
      body.data.membershipPlan,
      request.id,
    );
    if (result.status === "not_found") {
      return sendError(reply, 404, "TENANT_NOT_FOUND", "La empresa no existe.", request.id);
    }
    if (result.status === "seat_limit_conflict") {
      return sendError(
        reply,
        409,
        "EMPLOYEE_SEAT_LIMIT_CONFLICT",
        `La empresa tiene ${result.activeEmployeeSeats} empleados activos y el plan seleccionado permitiría ${result.employeeSeatLimit}.`,
        request.id,
      );
    }
    return reply.send({
      membershipPlan: result.membershipPlan,
      membershipEntitlement: result.membershipEntitlement,
    });
  });

  app.patch("/v1/platform/tenants/:tenantId/membership-entitlement", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session || !requireDeveloper(session.user, request, reply)) return;
    const params = tenantIdParamsSchema.safeParse(request.params);
    const body = platformMembershipEntitlementUpdateRequestSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return sendError(
        reply,
        400,
        "INVALID_MEMBERSHIP_ENTITLEMENT",
        "La cantidad de cupos adicionales debe estar entre 0 y 1.000.",
        request.id,
      );
    }
    if (!(await requireRecentReauthentication(session, request, reply))) return;
    const result = await dependencies.platformService.updateMembershipEntitlement(
      session.user.id,
      params.data.tenantId,
      body.data.additionalEmployeeSeats,
      request.id,
    );
    if (result.status === "not_found") {
      return sendError(reply, 404, "TENANT_NOT_FOUND", "La empresa no existe.", request.id);
    }
    if (result.status === "plan_required") {
      return sendError(
        reply,
        409,
        "MEMBERSHIP_PLAN_REQUIRED",
        "Asigna un plan antes de ampliar la capacidad.",
        request.id,
      );
    }
    if (result.status === "seat_limit_conflict") {
      return sendError(
        reply,
        409,
        "EMPLOYEE_SEAT_LIMIT_CONFLICT",
        `La empresa tiene ${result.activeEmployeeSeats} empleados activos y el nuevo límite sería ${result.employeeSeatLimit}.`,
        request.id,
      );
    }
    return reply.send({ membershipEntitlement: result.membershipEntitlement });
  });

  app.post("/v1/platform/tenants/:tenantId/invitations", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session || !requireDeveloper(session.user, request, reply)) return;
    const params = tenantIdParamsSchema.safeParse(request.params);
    const body = tenantInvitationRequestSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return sendError(
        reply,
        400,
        "INVALID_INVITATION",
        "Revisa el correo, el rol y la empresa.",
        request.id,
      );
    }
    if (!(await requireRecentReauthentication(session, request, reply))) return;
    const invitation = await dependencies.tenancyService.createInvitation(
      { userId: session.user.id, platformRole: "developer", tenantRole: null },
      params.data.tenantId,
      { ...body.data, email: body.data.email.toLowerCase(), requestId: request.id },
    );
    if (!invitation)
      return sendError(reply, 404, "TENANT_NOT_FOUND", "La empresa no existe.", request.id);
    return reply.code(201).send({ invitation });
  });

  app.delete("/v1/platform/tenants/:tenantId/invitations/:invitationId", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session || !requireDeveloper(session.user, request, reply)) return;
    const params = tenantInvitationParamsSchema.safeParse(request.params);
    if (!params.success) {
      return sendError(reply, 404, "INVITATION_NOT_FOUND", "La invitación no existe.", request.id);
    }
    if (!(await requireRecentReauthentication(session, request, reply))) return;
    const result = await dependencies.tenancyService.revokeInvitation(
      { userId: session.user.id, platformRole: "developer", tenantRole: null },
      params.data.tenantId,
      params.data.invitationId,
      request.id,
    );
    if (result.status === "not_found") {
      return sendError(
        reply,
        404,
        "INVITATION_NOT_FOUND",
        "La invitación no existe o ya no está pendiente.",
        request.id,
      );
    }
    return reply.code(204).send();
  });

  app.get("/v1/platform/support-access", async (request, reply) => {
    const session = await requireUser(request, reply);
    if (!session || !requireDeveloper(session.user, request, reply)) return;
    return { access: await dependencies.supportAccessService.listForDeveloper(session.user.id) };
  });

  app.post("/v1/platform/tenants/:tenantId/support-access", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session || !requireDeveloper(session.user, request, reply)) return;
    const params = tenantIdParamsSchema.safeParse(request.params);
    const body = supportAccessRequestSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return sendError(
        reply,
        400,
        "INVALID_SUPPORT_ACCESS",
        "Revisa el motivo y la duración solicitada.",
        request.id,
      );
    }
    if (!(await requireRecentReauthentication(session, request, reply))) return;
    const result = await dependencies.supportAccessService.requestAccess(
      session.user.id,
      params.data.tenantId,
      {
        ...body.data,
        requestId: request.id,
      },
    );
    if (result.status === "tenant_not_found") {
      return sendError(reply, 404, "TENANT_NOT_FOUND", "La empresa no existe.", request.id);
    }
    if (result.status === "exists") {
      return sendError(
        reply,
        409,
        "SUPPORT_ACCESS_EXISTS",
        "Ya existe una solicitud pendiente o un acceso vigente.",
        request.id,
      );
    }
    return reply.code(201).send({ access: result.access });
  });

  app.delete("/v1/platform/support-access/:accessId", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session || !requireDeveloper(session.user, request, reply)) return;
    const params = supportAccessParamsSchema.safeParse(request.params);
    if (!params.success) {
      return sendError(reply, 404, "SUPPORT_ACCESS_NOT_FOUND", "El acceso no existe.", request.id);
    }
    if (!(await requireRecentReauthentication(session, request, reply))) return;
    const result = await dependencies.supportAccessService.cancelAccess(
      session.user.id,
      params.data.accessId,
      request.id,
    );
    if (result.status === "not_found") {
      return sendError(reply, 404, "SUPPORT_ACCESS_NOT_FOUND", "El acceso no existe.", request.id);
    }
    if (result.status === "invalid_transition") {
      return sendError(
        reply,
        409,
        "INVALID_SUPPORT_ACCESS_TRANSITION",
        "Ese acceso ya no puede cancelarse.",
        request.id,
      );
    }
    return reply.code(204).send();
  });

  app.get("/v1/platform/tenants/:tenantId/support-overview", async (request, reply) => {
    const session = await requireUser(request, reply);
    if (!session || !requireDeveloper(session.user, request, reply)) return;
    const params = tenantIdParamsSchema.safeParse(request.params);
    if (!params.success) {
      return sendError(reply, 404, "TENANT_NOT_FOUND", "La empresa no existe.", request.id);
    }
    const access = await dependencies.supportAccessService.findActiveAccess(
      session.user.id,
      params.data.tenantId,
    );
    if (!access) {
      return sendError(
        reply,
        403,
        "SUPPORT_ACCESS_REQUIRED",
        "Necesitas una autorización de soporte vigente.",
        request.id,
      );
    }
    const overview = await dependencies.tenancyService.overview(
      {
        userId: session.user.id,
        platformRole: "developer",
        tenantRole: null,
        supportAccessId: access.id,
      },
      params.data.tenantId,
    );
    if (!overview) {
      return sendError(
        reply,
        403,
        "SUPPORT_ACCESS_REQUIRED",
        "La autorización de soporte venció o fue revocada.",
        request.id,
      );
    }
    return { access, overview };
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
      case "seat_limit_reached":
        return sendError(
          reply,
          409,
          "EMPLOYEE_SEAT_LIMIT_REACHED",
          `La empresa ya usa sus ${result.employeeSeatLimit} cupos de empleados. El propietario debe solicitar una ampliación.`,
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

  app.get("/v1/tenants/:tenantId/members/:userId/profile", async (request, reply) => {
    const session = await requireUser(request, reply);
    if (!session) return;
    const params = tenantMemberProfileParamsSchema.safeParse(request.params);
    if (!params.success) {
      return sendError(reply, 404, "MEMBER_PROFILE_NOT_FOUND", "El perfil no existe.", request.id);
    }
    const membership = tenantMembershipForSession(session, params.data.tenantId);
    if (!membership) {
      return sendError(reply, 403, "SCOPE_DENIED", "No tienes acceso a esta empresa.", request.id);
    }
    if (
      params.data.userId !== session.user.id &&
      !["owner", "supervisor"].includes(membership.role)
    ) {
      return sendError(
        reply,
        403,
        "SCOPE_DENIED",
        "Solo puedes consultar tu propia ficha operativa.",
        request.id,
      );
    }
    const getMemberProfile = dependencies.tenancyService.getMemberProfile;
    if (!getMemberProfile) {
      return sendError(
        reply,
        501,
        "MEMBER_PROFILE_UNAVAILABLE",
        "La ficha operativa todavía no está habilitada.",
        request.id,
      );
    }
    const profile = await getMemberProfile(
      {
        userId: session.user.id,
        platformRole: session.user.platformRole,
        tenantRole: membership.role,
      },
      params.data.tenantId,
      params.data.userId,
    );
    if (!profile) {
      return sendError(
        reply,
        404,
        "MEMBER_PROFILE_NOT_FOUND",
        "El integrante no existe.",
        request.id,
      );
    }
    return reply.send({ profile });
  });

  app.put("/v1/tenants/:tenantId/members/:userId/profile", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session) return;
    const params = tenantMemberProfileParamsSchema.safeParse(request.params);
    const body = tenantMemberProfileRequestSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return sendError(
        reply,
        400,
        "INVALID_MEMBER_PROFILE",
        "Revisa los datos de la ficha operativa.",
        request.id,
      );
    }
    const membership = tenantMembershipForSession(session, params.data.tenantId);
    if (!membership) {
      return sendError(reply, 403, "SCOPE_DENIED", "No tienes acceso a esta empresa.", request.id);
    }
    if (
      params.data.userId !== session.user.id &&
      !["owner", "supervisor"].includes(membership.role)
    ) {
      return sendError(
        reply,
        403,
        "SCOPE_DENIED",
        "Solo propietario o supervisor puede actualizar otra ficha.",
        request.id,
      );
    }
    if (!(await requireRecentReauthentication(session, request, reply))) return;
    const updateMemberProfile = dependencies.tenancyService.updateMemberProfile;
    if (!updateMemberProfile) {
      return sendError(
        reply,
        501,
        "MEMBER_PROFILE_UNAVAILABLE",
        "La ficha operativa todavía no está habilitada.",
        request.id,
      );
    }
    const result = await updateMemberProfile(
      {
        userId: session.user.id,
        platformRole: session.user.platformRole,
        tenantRole: membership.role,
      },
      params.data.tenantId,
      params.data.userId,
      { ...body.data, requestId: request.id },
    );
    switch (result.status) {
      case "updated":
        return reply.send({ profile: result.profile });
      case "invalid_photo_key":
        return sendError(
          reply,
          400,
          "INVALID_PROFILE_PHOTO_KEY",
          "La foto debe provenir del almacenamiento privado de la empresa.",
          request.id,
        );
      case "identity_unavailable":
        return sendError(
          reply,
          503,
          "MEMBER_IDENTITY_UNAVAILABLE",
          "La identidad del personal requiere una clave de protección configurada.",
          request.id,
        );
      case "duplicate_identity":
        return sendError(
          reply,
          409,
          "MEMBER_IDENTITY_DUPLICATE",
          "El número de documento ya está registrado en esta empresa.",
          request.id,
        );
      case "forbidden":
        return sendError(
          reply,
          403,
          "SCOPE_DENIED",
          "No puedes actualizar esta ficha.",
          request.id,
        );
      default:
        return sendError(
          reply,
          404,
          "MEMBER_PROFILE_NOT_FOUND",
          "El integrante no existe.",
          request.id,
        );
    }
  });

  app.post("/v1/tenants/:tenantId/members/:userId/profile-photo", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session) return;
    const params = tenantMemberProfileParamsSchema.safeParse(request.params);
    if (!params.success) {
      return sendError(reply, 404, "MEMBER_PROFILE_NOT_FOUND", "La ficha no existe.", request.id);
    }
    const membership = tenantMembershipForSession(session, params.data.tenantId);
    if (!membership) {
      return sendError(reply, 403, "SCOPE_DENIED", "No tienes acceso a esta empresa.", request.id);
    }
    if (
      params.data.userId !== session.user.id &&
      !["owner", "supervisor"].includes(membership.role)
    ) {
      return sendError(
        reply,
        403,
        "SCOPE_DENIED",
        "Solo puedes cargar tu propia foto de perfil.",
        request.id,
      );
    }
    if (!(await requireRecentReauthentication(session, request, reply))) return;
    const setMemberProfilePhoto = dependencies.tenancyService.setMemberProfilePhoto;
    if (!setMemberProfilePhoto || !dependencies.documentStorage) {
      return sendError(
        reply,
        503,
        "MEMBER_PROFILE_PHOTO_UNAVAILABLE",
        "La carga privada de fotos todavía no está configurada.",
        request.id,
      );
    }

    let mediaType = "";
    let fileBytes: Buffer | null = null;
    try {
      for await (const part of request.parts()) {
        if (part.type !== "file") continue;
        if (fileBytes) {
          return sendError(
            reply,
            400,
            "TOO_MANY_PROFILE_PHOTOS",
            "Solo puedes cargar una foto por vez.",
            request.id,
          );
        }
        mediaType = part.mimetype;
        fileBytes = await part.toBuffer();
      }
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "FST_REQ_FILE_TOO_LARGE"
      ) {
        return sendError(
          reply,
          413,
          "PROFILE_PHOTO_TOO_LARGE",
          "La foto supera el límite de 10 MB.",
          request.id,
        );
      }
      throw error;
    }
    if (!fileBytes || !mediaType) {
      return sendError(
        reply,
        400,
        "PROFILE_PHOTO_REQUIRED",
        "Debes seleccionar una foto.",
        request.id,
      );
    }
    try {
      const stored = await dependencies.documentStorage.quarantineMemberProfile({
        tenantId: params.data.tenantId,
        userId: params.data.userId,
        mediaType,
        bytes: fileBytes,
      });
      const result = await setMemberProfilePhoto(
        {
          userId: session.user.id,
          platformRole: session.user.platformRole,
          tenantRole: membership.role,
        },
        params.data.tenantId,
        params.data.userId,
        { objectKey: stored.objectKey, requestId: request.id },
      );
      if (result.status !== "updated") {
        await dependencies.documentStorage.remove(stored.objectKey).catch(() => undefined);
      }
      if (result.status === "not_found") {
        return sendError(reply, 404, "MEMBER_PROFILE_NOT_FOUND", "La ficha no existe.", request.id);
      }
      if (result.status === "forbidden") {
        return sendError(reply, 403, "SCOPE_DENIED", "No puedes actualizar esta foto.", request.id);
      }
      if (result.status === "invalid_photo_key") {
        return sendError(
          reply,
          400,
          "INVALID_PROFILE_PHOTO_KEY",
          "La ruta privada no es válida.",
          request.id,
        );
      }
      return reply.send({ profile: result.profile });
    } catch (error) {
      if (error instanceof Error) {
        const messages: Record<string, [number, string, string]> = {
          UNSUPPORTED_DOCUMENT_TYPE: [
            400,
            "UNSUPPORTED_PROFILE_PHOTO_TYPE",
            "El formato no está permitido.",
          ],
          DOCUMENT_SIZE_INVALID: [
            400,
            "PROFILE_PHOTO_SIZE_INVALID",
            "La foto está vacía o supera 10 MB.",
          ],
          DOCUMENT_CONTENT_INVALID: [
            400,
            "PROFILE_PHOTO_CONTENT_INVALID",
            "El contenido no coincide con su formato.",
          ],
          PROFILE_PHOTO_TYPE_INVALID: [
            400,
            "PROFILE_PHOTO_TYPE_INVALID",
            "La foto debe ser una imagen.",
          ],
        };
        const mapped = messages[error.message];
        if (mapped) return sendError(reply, mapped[0], mapped[1], mapped[2], request.id);
      }
      throw error;
    }
  });

  app.post("/v1/tenants/:tenantId/members/:userId/profile-documents", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session) return;
    const params = tenantMemberProfileParamsSchema.safeParse(request.params);
    if (!params.success) {
      return sendError(reply, 404, "MEMBER_PROFILE_NOT_FOUND", "La ficha no existe.", request.id);
    }
    const membership = tenantMembershipForSession(session, params.data.tenantId);
    if (!membership) {
      return sendError(reply, 403, "SCOPE_DENIED", "No tienes acceso a esta empresa.", request.id);
    }
    if (
      params.data.userId !== session.user.id &&
      !["owner", "supervisor"].includes(membership.role)
    ) {
      return sendError(reply, 403, "SCOPE_DENIED", "No puedes cargar este documento.", request.id);
    }
    if (!(await requireRecentReauthentication(session, request, reply))) return;
    const setMemberIdentityDocument = dependencies.tenancyService.setMemberIdentityDocument;
    if (!setMemberIdentityDocument || !dependencies.documentStorage) {
      return sendError(
        reply,
        503,
        "MEMBER_DOCUMENTS_UNAVAILABLE",
        "La carga privada de documentos todavía no está configurada.",
        request.id,
      );
    }
    let side: "front" | "back" | null = null;
    let mediaType = "";
    let fileBytes: Buffer | null = null;
    try {
      for await (const part of request.parts()) {
        if (part.type === "field" && part.fieldname === "side") {
          side = part.value === "front" || part.value === "back" ? part.value : null;
        }
        if (part.type === "file") {
          if (fileBytes) {
            return sendError(
              reply,
              400,
              "TOO_MANY_MEMBER_DOCUMENTS",
              "Solo puedes cargar un documento por vez.",
              request.id,
            );
          }
          mediaType = part.mimetype;
          fileBytes = await part.toBuffer();
        }
      }
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "FST_REQ_FILE_TOO_LARGE"
      ) {
        return sendError(
          reply,
          413,
          "MEMBER_DOCUMENT_TOO_LARGE",
          "El documento supera el límite de 10 MB.",
          request.id,
        );
      }
      throw error;
    }
    if (!side)
      return sendError(
        reply,
        400,
        "MEMBER_DOCUMENT_SIDE_REQUIRED",
        "Indica si es el frente o el reverso.",
        request.id,
      );
    if (!fileBytes || !mediaType)
      return sendError(
        reply,
        400,
        "MEMBER_DOCUMENT_REQUIRED",
        "Debes seleccionar un documento.",
        request.id,
      );
    try {
      const stored = await dependencies.documentStorage.quarantineMemberIdentityDocument({
        tenantId: params.data.tenantId,
        userId: params.data.userId,
        side,
        mediaType,
        bytes: fileBytes,
      });
      const result = await setMemberIdentityDocument(
        {
          userId: session.user.id,
          platformRole: session.user.platformRole,
          tenantRole: membership.role,
        },
        params.data.tenantId,
        params.data.userId,
        { side, objectKey: stored.objectKey, requestId: request.id },
      );
      if (result.status !== "updated")
        await dependencies.documentStorage.remove(stored.objectKey).catch(() => undefined);
      if (result.status === "not_found")
        return sendError(reply, 404, "MEMBER_PROFILE_NOT_FOUND", "La ficha no existe.", request.id);
      if (result.status === "forbidden")
        return sendError(
          reply,
          403,
          "SCOPE_DENIED",
          "No puedes actualizar esta ficha.",
          request.id,
        );
      if (result.status === "invalid_document_key")
        return sendError(
          reply,
          400,
          "INVALID_MEMBER_DOCUMENT_KEY",
          "La ruta privada no es válida.",
          request.id,
        );
      return reply.send({ profile: result.profile });
    } catch (error) {
      if (error instanceof Error) {
        const messages: Record<string, [number, string, string]> = {
          UNSUPPORTED_DOCUMENT_TYPE: [
            400,
            "UNSUPPORTED_MEMBER_DOCUMENT_TYPE",
            "El formato no está permitido.",
          ],
          DOCUMENT_SIZE_INVALID: [
            400,
            "MEMBER_DOCUMENT_SIZE_INVALID",
            "El documento está vacío o supera 10 MB.",
          ],
          DOCUMENT_CONTENT_INVALID: [
            400,
            "MEMBER_DOCUMENT_CONTENT_INVALID",
            "El contenido no coincide con su formato.",
          ],
        };
        const mapped = messages[error.message];
        if (mapped) return sendError(reply, mapped[0], mapped[1], mapped[2], request.id);
      }
      throw error;
    }
  });

  app.get("/v1/tenants/:tenantId/routes", async (request, reply) => {
    const session = await requireUser(request, reply);
    if (!session) return;
    const params = tenantIdParamsSchema.safeParse(request.params);
    if (!params.success) {
      return sendError(reply, 404, "TENANT_NOT_FOUND", "La empresa no existe.", request.id);
    }
    const membership = session.user.memberships.find(
      (item) => item.tenantId === params.data.tenantId,
    );
    if (!membership || !["owner", "supervisor", "collector"].includes(membership.role)) {
      return sendError(
        reply,
        403,
        "SCOPE_DENIED",
        "No puedes consultar las rutas de cobranza.",
        request.id,
      );
    }
    if (!(await requireRecentReauthentication(session, request, reply))) return;
    if (!dependencies.routeService) {
      return sendError(
        reply,
        503,
        "ROUTES_UNAVAILABLE",
        "Las rutas todavía no están configuradas.",
        request.id,
      );
    }
    const routes = await dependencies.routeService.list(
      {
        userId: session.user.id,
        platformRole: session.user.platformRole,
        tenantRole: membership.role,
      },
      params.data.tenantId,
    );
    return reply.send({ routes });
  });

  app.post("/v1/tenants/:tenantId/routes", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session) return;
    const params = tenantIdParamsSchema.safeParse(request.params);
    const body = routeCreateRequestSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return sendError(
        reply,
        400,
        "INVALID_ROUTE",
        "Revisa el nombre y la descripción de la ruta.",
        request.id,
      );
    }
    const membership = session.user.memberships.find(
      (item) => item.tenantId === params.data.tenantId,
    );
    if (!membership || !["owner", "supervisor"].includes(membership.role)) {
      return sendError(
        reply,
        403,
        "SCOPE_DENIED",
        "Solo propietarios y supervisores pueden crear rutas.",
        request.id,
      );
    }
    if (!(await requireRecentReauthentication(session, request, reply))) return;
    if (!dependencies.routeService) {
      return sendError(
        reply,
        503,
        "ROUTES_UNAVAILABLE",
        "Las rutas todavía no están configuradas.",
        request.id,
      );
    }
    const result = await dependencies.routeService.create(
      {
        userId: session.user.id,
        platformRole: session.user.platformRole,
        tenantRole: membership.role,
      },
      params.data.tenantId,
      { ...body.data, requestId: request.id },
    );
    if (result.status === "duplicate") {
      return sendError(
        reply,
        409,
        "ROUTE_DUPLICATE",
        "Ya existe una ruta con ese nombre.",
        request.id,
      );
    }
    if (result.status === "forbidden") {
      return sendError(
        reply,
        403,
        "SCOPE_DENIED",
        "Solo propietarios y supervisores pueden crear rutas.",
        request.id,
      );
    }
    return reply.code(201).send({ route: result.route });
  });

  app.post("/v1/tenants/:tenantId/routes/:routeId/stops", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session) return;
    const params = tenantRouteParamsSchema.safeParse(request.params);
    const body = routeStopCreateRequestSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return sendError(
        reply,
        400,
        "INVALID_ROUTE_STOP",
        "Revisa el cliente, la dirección y la posición.",
        request.id,
      );
    }
    const membership = session.user.memberships.find(
      (item) => item.tenantId === params.data.tenantId,
    );
    if (!membership || !["owner", "supervisor"].includes(membership.role)) {
      return sendError(
        reply,
        403,
        "SCOPE_DENIED",
        "Solo propietarios y supervisores pueden editar rutas.",
        request.id,
      );
    }
    if (!(await requireRecentReauthentication(session, request, reply))) return;
    if (!dependencies.routeService) {
      return sendError(
        reply,
        503,
        "ROUTES_UNAVAILABLE",
        "Las rutas todavía no están configuradas.",
        request.id,
      );
    }
    const result = await dependencies.routeService.addStop(
      {
        userId: session.user.id,
        platformRole: session.user.platformRole,
        tenantRole: membership.role,
      },
      params.data.tenantId,
      params.data.routeId,
      { ...body.data, requestId: request.id },
    );
    if (result.status === "not_found") {
      return sendError(reply, 404, "ROUTE_NOT_FOUND", "La ruta no existe.", request.id);
    }
    if (result.status === "borrower_not_found") {
      return sendError(
        reply,
        404,
        "BORROWER_NOT_FOUND",
        "El cliente no existe o no está activo.",
        request.id,
      );
    }
    if (result.status === "duplicate_stop") {
      return sendError(
        reply,
        409,
        "ROUTE_STOP_DUPLICATE",
        "El cliente ya está en esta ruta.",
        request.id,
      );
    }
    if (result.status === "forbidden") {
      return sendError(
        reply,
        403,
        "SCOPE_DENIED",
        "Solo propietarios y supervisores pueden editar rutas.",
        request.id,
      );
    }
    return reply.send({ route: result.route });
  });

  app.patch("/v1/tenants/:tenantId/routes/:routeId/stops/order", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session) return;
    const params = tenantRouteParamsSchema.safeParse(request.params);
    const body = routeStopReorderRequestSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return sendError(
        reply,
        400,
        "INVALID_ROUTE_ORDER",
        "El orden de paradas no es válido.",
        request.id,
      );
    }
    const membership = session.user.memberships.find(
      (item) => item.tenantId === params.data.tenantId,
    );
    if (!membership || !["owner", "supervisor"].includes(membership.role)) {
      return sendError(
        reply,
        403,
        "SCOPE_DENIED",
        "Solo propietarios y supervisores pueden ordenar rutas.",
        request.id,
      );
    }
    if (!(await requireRecentReauthentication(session, request, reply))) return;
    if (!dependencies.routeService) {
      return sendError(
        reply,
        503,
        "ROUTES_UNAVAILABLE",
        "Las rutas todavía no están configuradas.",
        request.id,
      );
    }
    const result = await dependencies.routeService.reorderStops(
      {
        userId: session.user.id,
        platformRole: session.user.platformRole,
        tenantRole: membership.role,
      },
      params.data.tenantId,
      params.data.routeId,
      { ...body.data, requestId: request.id },
    );
    if (result.status === "not_found") {
      return sendError(reply, 404, "ROUTE_NOT_FOUND", "La ruta no existe.", request.id);
    }
    if (result.status === "forbidden") {
      return sendError(reply, 403, "SCOPE_DENIED", "No puedes ordenar esta ruta.", request.id);
    }
    if (result.status === "invalid_order") {
      return sendError(
        reply,
        409,
        "ROUTE_ORDER_INVALID",
        "Debes incluir todas las paradas una sola vez.",
        request.id,
      );
    }
    return reply.send({ route: result.route });
  });

  app.patch("/v1/tenants/:tenantId/routes/:routeId/stops/:stopId/visit", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session) return;
    const params = tenantRouteStopParamsSchema.safeParse(request.params);
    const body = routeStopVisitRequestSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return sendError(
        reply,
        400,
        "INVALID_ROUTE_VISIT",
        "El estado de visita no es válido.",
        request.id,
      );
    }
    const membership = session.user.memberships.find(
      (item) => item.tenantId === params.data.tenantId,
    );
    if (!membership || !["owner", "supervisor", "collector"].includes(membership.role)) {
      return sendError(reply, 403, "SCOPE_DENIED", "No tienes acceso a esta ruta.", request.id);
    }
    if (!(await requireRecentReauthentication(session, request, reply))) return;
    if (!dependencies.routeService) {
      return sendError(
        reply,
        503,
        "ROUTES_UNAVAILABLE",
        "Las rutas todavía no están configuradas.",
        request.id,
      );
    }
    const result = await dependencies.routeService.updateStopVisit(
      {
        userId: session.user.id,
        platformRole: session.user.platformRole,
        tenantRole: membership.role,
      },
      params.data.tenantId,
      params.data.routeId,
      params.data.stopId,
      { ...body.data, requestId: request.id },
    );
    if (result.status === "not_found") {
      return sendError(reply, 404, "ROUTE_STOP_NOT_FOUND", "La parada no existe.", request.id);
    }
    if (result.status === "forbidden") {
      return sendError(reply, 403, "SCOPE_DENIED", "No puedes actualizar esta parada.", request.id);
    }
    return reply.send({ route: result.route });
  });

  app.post("/v1/tenants/:tenantId/routes/:routeId/stops/optimize", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session) return;
    const params = tenantRouteParamsSchema.safeParse(request.params);
    const body = routeStopOptimizeRequestSchema.safeParse(request.body ?? {});
    if (!params.success || !body.success) {
      return sendError(
        reply,
        400,
        "INVALID_ROUTE_OPTIMIZATION",
        "El punto de inicio no es válido.",
        request.id,
      );
    }
    const membership = session.user.memberships.find(
      (item) => item.tenantId === params.data.tenantId,
    );
    if (!membership || !["owner", "supervisor"].includes(membership.role)) {
      return sendError(
        reply,
        403,
        "SCOPE_DENIED",
        "Solo propietarios y supervisores pueden optimizar rutas.",
        request.id,
      );
    }
    if (!(await requireRecentReauthentication(session, request, reply))) return;
    if (!dependencies.routeService) {
      return sendError(
        reply,
        503,
        "ROUTES_UNAVAILABLE",
        "Las rutas todavía no están configuradas.",
        request.id,
      );
    }
    const result = await dependencies.routeService.optimizeStops(
      {
        userId: session.user.id,
        platformRole: session.user.platformRole,
        tenantRole: membership.role,
      },
      params.data.tenantId,
      params.data.routeId,
      { ...body.data, requestId: request.id },
    );
    if (result.status === "not_found") {
      return sendError(reply, 404, "ROUTE_NOT_FOUND", "La ruta no existe.", request.id);
    }
    if (result.status === "forbidden") {
      return sendError(reply, 403, "SCOPE_DENIED", "No puedes optimizar esta ruta.", request.id);
    }
    if (result.status === "missing_coordinates") {
      return sendError(
        reply,
        409,
        "ROUTE_COORDINATES_REQUIRED",
        "Ubica todas las direcciones antes de optimizar la ruta.",
        request.id,
      );
    }
    return reply.send({ route: result.route });
  });

  app.patch("/v1/tenants/:tenantId/routes/:routeId", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session) return;
    const params = tenantRouteParamsSchema.safeParse(request.params);
    const body = routeStatusUpdateRequestSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return sendError(
        reply,
        400,
        "INVALID_ROUTE_STATUS",
        "El estado solicitado no es válido.",
        request.id,
      );
    }
    const membership = session.user.memberships.find(
      (item) => item.tenantId === params.data.tenantId,
    );
    if (!membership || !["owner", "supervisor"].includes(membership.role)) {
      return sendError(
        reply,
        403,
        "SCOPE_DENIED",
        "Solo propietarios y supervisores pueden actualizar rutas.",
        request.id,
      );
    }
    if (!(await requireRecentReauthentication(session, request, reply))) return;
    if (!dependencies.routeService) {
      return sendError(
        reply,
        503,
        "ROUTES_UNAVAILABLE",
        "Las rutas todavía no están configuradas.",
        request.id,
      );
    }
    const result = await dependencies.routeService.updateStatus(
      {
        userId: session.user.id,
        platformRole: session.user.platformRole,
        tenantRole: membership.role,
      },
      params.data.tenantId,
      params.data.routeId,
      { ...body.data, requestId: request.id },
    );
    if (result.status === "not_found") {
      return sendError(reply, 404, "ROUTE_NOT_FOUND", "La ruta no existe.", request.id);
    }
    if (result.status === "forbidden") {
      return sendError(
        reply,
        403,
        "SCOPE_DENIED",
        "Solo propietarios y supervisores pueden actualizar rutas.",
        request.id,
      );
    }
    if (result.status === "invalid_transition") {
      return sendError(
        reply,
        409,
        result.reason === "empty_route" ? "ROUTE_EMPTY" : "ROUTE_STATUS_INVALID",
        result.reason === "empty_route"
          ? "Agrega al menos una parada antes de activar la ruta."
          : "La ruta no puede cambiar a ese estado.",
        request.id,
      );
    }
    return reply.send({ route: result.route });
  });

  app.patch("/v1/tenants/:tenantId/routes/:routeId/assignment", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session) return;
    const params = tenantRouteParamsSchema.safeParse(request.params);
    const body = routeAssignmentUpdateRequestSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return sendError(
        reply,
        400,
        "INVALID_ROUTE_ASSIGNMENT",
        "Selecciona un cobrador válido o deja la ruta sin asignar.",
        request.id,
      );
    }
    const membership = session.user.memberships.find(
      (item) => item.tenantId === params.data.tenantId,
    );
    if (!membership || !["owner", "supervisor"].includes(membership.role)) {
      return sendError(
        reply,
        403,
        "SCOPE_DENIED",
        "Solo propietarios y supervisores pueden asignar rutas.",
        request.id,
      );
    }
    if (!(await requireRecentReauthentication(session, request, reply))) return;
    if (!dependencies.routeService) {
      return sendError(
        reply,
        503,
        "ROUTES_UNAVAILABLE",
        "Las rutas todavía no están configuradas.",
        request.id,
      );
    }
    const result = await dependencies.routeService.assignCollector(
      {
        userId: session.user.id,
        platformRole: session.user.platformRole,
        tenantRole: membership.role,
      },
      params.data.tenantId,
      params.data.routeId,
      { ...body.data, requestId: request.id },
    );
    if (result.status === "not_found") {
      return sendError(reply, 404, "ROUTE_NOT_FOUND", "La ruta no existe.", request.id);
    }
    if (result.status === "collector_not_found") {
      return sendError(
        reply,
        404,
        "COLLECTOR_NOT_FOUND",
        "El usuario seleccionado no es un cobrador de esta empresa.",
        request.id,
      );
    }
    if (result.status === "collector_inactive") {
      return sendError(
        reply,
        409,
        "COLLECTOR_INACTIVE",
        "El cobrador seleccionado no tiene un acceso activo.",
        request.id,
      );
    }
    if (result.status === "forbidden") {
      return sendError(
        reply,
        403,
        "SCOPE_DENIED",
        "Solo propietarios y supervisores pueden asignar rutas.",
        request.id,
      );
    }
    return reply.send({ route: result.route });
  });

  function canManageBorrowers(role: AuthenticatedUser["memberships"][number]["role"] | undefined) {
    return role === "owner" || role === "supervisor" || role === "collector";
  }

  app.post("/v1/tenants/:tenantId/borrowers/identity-extract", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session) return;
    const params = tenantIdParamsSchema.safeParse(request.params);
    if (!params.success) {
      return sendError(reply, 400, "INVALID_TENANT", "La empresa no es válida.", request.id);
    }
    const membership = tenantMembershipForSession(session, params.data.tenantId);
    if (!membership || !canManageBorrowers(membership.role)) {
      return sendError(
        reply,
        403,
        "SCOPE_DENIED",
        "No puedes leer documentos de clientes.",
        request.id,
      );
    }
    if (!(await requireRecentReauthentication(session, request, reply))) return;
    if (!dependencies.identityExtractor) {
      return sendError(
        reply,
        503,
        "HERMES_OCR_UNAVAILABLE",
        "Hermes no está disponible. Puedes escribir los datos manualmente.",
        request.id,
      );
    }

    const images: Partial<Record<"front" | "back", IdentityImage>> = {};
    let totalBytes = 0;
    try {
      for await (const part of request.parts()) {
        if (part.type !== "file" || (part.fieldname !== "front" && part.fieldname !== "back")) {
          continue;
        }
        if (images[part.fieldname]) {
          return sendError(
            reply,
            400,
            "DUPLICATE_OCR_IMAGE",
            "Adjunta una sola imagen por cada cara de la cédula.",
            request.id,
          );
        }
        const bytes = await part.toBuffer();
        totalBytes += bytes.length;
        const mediaType = validateIdentityExtractionImage(bytes, part.mimetype);
        images[part.fieldname] = { bytes, mediaType, side: part.fieldname };
      }
    } catch (error) {
      if (error instanceof Error) {
        const errors: Record<string, [number, string, string]> = {
          FST_REQ_FILE_TOO_LARGE: [
            413,
            "OCR_IMAGE_TOO_LARGE",
            "Cada imagen debe pesar menos de 10 MB.",
          ],
          UNSUPPORTED_OCR_IMAGE_TYPE: [
            400,
            "UNSUPPORTED_OCR_IMAGE_TYPE",
            "Usa una imagen JPG, PNG o WebP.",
          ],
          OCR_IMAGE_SIZE_INVALID: [
            400,
            "OCR_IMAGE_SIZE_INVALID",
            "La imagen está vacía o es demasiado grande.",
          ],
          OCR_IMAGE_CONTENT_INVALID: [
            400,
            "OCR_IMAGE_CONTENT_INVALID",
            "El archivo no coincide con el formato de imagen indicado.",
          ],
        };
        const mapped =
          errors[error.message] ??
          ("code" in error && typeof error.code === "string" ? errors[error.code] : undefined);
        if (mapped) return sendError(reply, mapped[0], mapped[1], mapped[2], request.id);
      }
      throw error;
    }
    if (!images.front) {
      return sendError(
        reply,
        400,
        "IDENTITY_FRONT_REQUIRED",
        "Adjunta el frente de la cédula para leer sus datos.",
        request.id,
      );
    }
    if (totalBytes > 7_000_000) {
      return sendError(
        reply,
        413,
        "OCR_IMAGES_TOO_LARGE",
        "Las imágenes para lectura pesan demasiado. Toma fotos con menor resolución.",
        request.id,
      );
    }
    const limiterKey = `${params.data.tenantId}:${session.user.id}`;
    if (identityOcrRateLimiter.isBlocked(limiterKey)) {
      return sendError(
        reply,
        429,
        "HERMES_OCR_RATE_LIMITED",
        "Has realizado varias lecturas seguidas. Espera un minuto antes de intentar nuevamente.",
        request.id,
      );
    }
    identityOcrRateLimiter.registerFailure(limiterKey);
    try {
      const extraction = await dependencies.identityExtractor.extract({
        front: images.front,
        ...(images.back ? { back: images.back } : {}),
      });
      return reply.send({ extraction });
    } catch (error) {
      const code = error instanceof Error ? error.message : "HERMES_OCR_UNAVAILABLE";
      const busy = code === "HERMES_OCR_BUSY";
      return sendError(
        reply,
        busy ? 429 : 502,
        ["HERMES_OCR_TIMEOUT", "HERMES_OCR_INVALID_RESPONSE"].includes(code)
          ? code
          : "HERMES_OCR_UNAVAILABLE",
        busy
          ? "Hermes está atendiendo otras lecturas. Intenta nuevamente en unos segundos."
          : "Hermes no pudo leer el documento. Toma fotos más nítidas o escribe los datos manualmente.",
        request.id,
      );
    }
  });

  app.get("/v1/tenants/:tenantId/borrowers", async (request, reply) => {
    const session = await requireUser(request, reply);
    if (!session) return;
    const params = tenantIdParamsSchema.safeParse(request.params);
    const query = borrowerDirectoryQuerySchema.safeParse(request.query);
    if (!params.success || !query.success) {
      return sendError(
        reply,
        400,
        "INVALID_BORROWER_QUERY",
        "Revisa los filtros de clientes.",
        request.id,
      );
    }
    const membership = tenantMembershipForSession(session, params.data.tenantId);
    if (!membership || !canManageBorrowers(membership.role)) {
      return sendError(
        reply,
        403,
        "SCOPE_DENIED",
        "No tienes acceso al directorio de clientes.",
        request.id,
      );
    }
    if (!(await requireRecentReauthentication(session, request, reply))) return;
    if (!dependencies.borrowerService) {
      return sendError(
        reply,
        503,
        "BORROWER_DOSSIER_UNAVAILABLE",
        "El módulo de clientes requiere configurar su clave de protección.",
        request.id,
      );
    }
    const directory = await dependencies.borrowerService.list(
      {
        userId: session.user.id,
        platformRole: session.user.platformRole,
        tenantRole: membership.role,
      },
      params.data.tenantId,
      {
        search: query.data.q?.trim() || null,
        page: query.data.page,
        pageSize: query.data.pageSize,
      },
    );
    return reply.send(directory);
  });

  app.post("/v1/tenants/:tenantId/client-verification", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session) return;
    const params = tenantIdParamsSchema.safeParse(request.params);
    const body = sharedClientVerificationRequestSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      const consentMissing =
        !body.success && body.error.issues.some((issue) => issue.path[0] === "consentConfirmed");
      return sendError(
        reply,
        400,
        consentMissing ? "CLIENT_VERIFICATION_CONSENT_REQUIRED" : "INVALID_CLIENT_VERIFICATION",
        consentMissing
          ? "Confirma que el cliente autorizó esta consulta antes de continuar."
          : "Ingresa una cédula válida.",
        request.id,
      );
    }
    const membership = tenantMembershipForSession(session, params.data.tenantId);
    if (!membership || !canManageBorrowers(membership.role)) {
      return sendError(
        reply,
        403,
        "SCOPE_DENIED",
        "Solo el propietario, supervisor o cobrador puede verificar clientes.",
        request.id,
      );
    }
    if (!dependencies.borrowerService) {
      return sendError(
        reply,
        503,
        "BORROWER_DOSSIER_UNAVAILABLE",
        "El módulo de clientes requiere configurar su clave de protección.",
        request.id,
      );
    }
    try {
      const verification = await dependencies.borrowerService.verifyShared(
        {
          userId: session.user.id,
          platformRole: session.user.platformRole,
          tenantRole: membership.role,
        },
        params.data.tenantId,
        body.data.documentNumber,
        request.id,
      );
      return reply.send({ verification });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("INVALID_DOCUMENT_")) {
        return sendError(
          reply,
          400,
          "INVALID_CLIENT_VERIFICATION",
          "Ingresa una cédula válida.",
          request.id,
        );
      }
      if (error instanceof Error && error.message === "INVALID_BORROWER_ADDRESS") {
        return sendError(
          reply,
          400,
          "INVALID_BORROWER_ADDRESS",
          "Escribe una dirección completa de casa y trabajo.",
          request.id,
        );
      }
      throw error;
    }
  });

  app.get("/v1/tenants/:tenantId/borrowers/:borrowerId", async (request, reply) => {
    const session = await requireUser(request, reply);
    if (!session) return;
    const params = tenantBorrowerParamsSchema.safeParse(request.params);
    if (!params.success) {
      return sendError(reply, 404, "BORROWER_NOT_FOUND", "El cliente no existe.", request.id);
    }
    const membership = tenantMembershipForSession(session, params.data.tenantId);
    if (!membership || !canManageBorrowers(membership.role)) {
      return sendError(reply, 403, "SCOPE_DENIED", "No tienes acceso a este cliente.", request.id);
    }
    if (!dependencies.borrowerService) {
      return sendError(
        reply,
        503,
        "BORROWER_DOSSIER_UNAVAILABLE",
        "El módulo de clientes requiere configurar su clave de protección.",
        request.id,
      );
    }
    const borrower = await dependencies.borrowerService.get(
      {
        userId: session.user.id,
        platformRole: session.user.platformRole,
        tenantRole: membership.role,
      },
      params.data.tenantId,
      params.data.borrowerId,
    );
    if (!borrower)
      return sendError(reply, 404, "BORROWER_NOT_FOUND", "El cliente no existe.", request.id);
    return reply.send({ borrower });
  });

  app.patch("/v1/tenants/:tenantId/borrowers/:borrowerId/addresses", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session) return;
    const params = tenantBorrowerParamsSchema.safeParse(request.params);
    const body = borrowerAddressUpdateRequestSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return sendError(
        reply,
        400,
        "INVALID_BORROWER_ADDRESSES",
        "Escribe y confirma las direcciones completas de casa y trabajo.",
        request.id,
      );
    }
    const membership = tenantMembershipForSession(session, params.data.tenantId);
    if (!membership || !canManageBorrowers(membership.role)) {
      return sendError(reply, 403, "SCOPE_DENIED", "No tienes acceso a este cliente.", request.id);
    }
    if (!(await requireRecentReauthentication(session, request, reply))) return;
    if (!dependencies.borrowerService) {
      return sendError(
        reply,
        503,
        "BORROWER_DOSSIER_UNAVAILABLE",
        "El módulo de clientes requiere configurar su clave de protección.",
        request.id,
      );
    }
    try {
      const result = await dependencies.borrowerService.updateAddresses(
        {
          userId: session.user.id,
          platformRole: session.user.platformRole,
          tenantRole: membership.role,
        },
        params.data.tenantId,
        params.data.borrowerId,
        { ...body.data, requestId: request.id },
      );
      if (result.status === "not_found") {
        return sendError(reply, 404, "BORROWER_NOT_FOUND", "El cliente no existe.", request.id);
      }
      if (result.status === "forbidden") {
        return sendError(
          reply,
          403,
          "SCOPE_DENIED",
          "No puedes actualizar este cliente.",
          request.id,
        );
      }
      if (result.status === "addresses_unconfirmed") {
        return sendError(
          reply,
          400,
          "BORROWER_ADDRESSES_UNCONFIRMED",
          "Confirma con el cliente las direcciones completas de casa y trabajo antes de guardar.",
          request.id,
        );
      }
      return reply.send({ borrower: result.borrower });
    } catch (error) {
      if (error instanceof Error && error.message === "INVALID_BORROWER_ADDRESS") {
        return sendError(
          reply,
          400,
          "INVALID_BORROWER_ADDRESS",
          "Escribe una dirección completa de casa y trabajo.",
          request.id,
        );
      }
      throw error;
    }
  });

  app.post("/v1/tenants/:tenantId/borrowers/:borrowerId/geocode", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session) return;
    const params = tenantBorrowerParamsSchema.safeParse(request.params);
    const body = borrowerAddressGeocodeRequestSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return sendError(
        reply,
        400,
        "INVALID_ADDRESS_GEOCODE",
        "Selecciona casa o trabajo.",
        request.id,
      );
    }
    const membership = tenantMembershipForSession(session, params.data.tenantId);
    if (!membership || !canManageBorrowers(membership.role)) {
      return sendError(reply, 403, "SCOPE_DENIED", "No tienes acceso a este cliente.", request.id);
    }
    if (!(await requireRecentReauthentication(session, request, reply))) return;
    if (!dependencies.borrowerService) {
      return sendError(
        reply,
        503,
        "BORROWER_DOSSIER_UNAVAILABLE",
        "El módulo de clientes requiere configurar su clave de protección.",
        request.id,
      );
    }
    const result = await dependencies.borrowerService.geocodeAddress(
      {
        userId: session.user.id,
        platformRole: session.user.platformRole,
        tenantRole: membership.role,
      },
      params.data.tenantId,
      params.data.borrowerId,
      body.data,
      request.id,
    );
    if (result.status === "not_found") {
      return sendError(reply, 404, "BORROWER_NOT_FOUND", "El cliente no existe.", request.id);
    }
    if (result.status === "forbidden") {
      return sendError(reply, 403, "SCOPE_DENIED", "No puedes ubicar esta dirección.", request.id);
    }
    if (result.status === "unconfirmed") {
      return sendError(
        reply,
        409,
        "BORROWER_ADDRESSES_UNCONFIRMED",
        "Confirma esta dirección con el cliente antes de ubicarla.",
        request.id,
      );
    }
    if (result.status === "stale") {
      return sendError(
        reply,
        409,
        "BORROWER_ADDRESS_CHANGED",
        "La dirección cambió mientras se ubicaba. Vuelve a intentarlo con la dirección actual.",
        request.id,
      );
    }
    if (result.status === "unavailable") {
      return reply.code(502).send({ location: result.location });
    }
    return reply.send({ borrower: result.borrower });
  });

  app.get("/v1/tenants/:tenantId/borrowers/:borrowerId/ocr", async (request, reply) => {
    const session = await requireUser(request, reply);
    if (!session) return;
    const params = tenantBorrowerParamsSchema.safeParse(request.params);
    if (!params.success) {
      return sendError(reply, 404, "BORROWER_NOT_FOUND", "El cliente no existe.", request.id);
    }
    const membership = tenantMembershipForSession(session, params.data.tenantId);
    if (!membership || !canManageBorrowers(membership.role)) {
      return sendError(reply, 403, "SCOPE_DENIED", "No tienes acceso a este cliente.", request.id);
    }
    if (!dependencies.borrowerService) {
      return sendError(
        reply,
        503,
        "BORROWER_DOSSIER_UNAVAILABLE",
        "El módulo de clientes requiere configurar su clave de protección.",
        request.id,
      );
    }
    const extractions = await dependencies.borrowerService.listOcr(
      {
        userId: session.user.id,
        platformRole: session.user.platformRole,
        tenantRole: membership.role,
      },
      params.data.tenantId,
      params.data.borrowerId,
    );
    return reply.send({ extractions });
  });

  app.post(
    "/v1/tenants/:tenantId/borrowers/:borrowerId/ocr/:extractionId/confirm",
    async (request, reply) => {
      if (!requireAllowedOrigin(request, reply)) return;
      const session = await requireUser(request, reply);
      if (!session) return;
      const params = tenantBorrowerOcrParamsSchema.safeParse(request.params);
      const body = borrowerOcrConfirmRequestSchema.safeParse({
        ...(request.body && typeof request.body === "object" ? request.body : {}),
        extractionId: params.success ? params.data.extractionId : undefined,
      });
      if (!params.success || !body.success) {
        return sendError(
          reply,
          400,
          "INVALID_OCR_CONFIRMATION",
          "Confirma al menos un dato extraído.",
          request.id,
        );
      }
      const membership = tenantMembershipForSession(session, params.data.tenantId);
      if (!membership || !canManageBorrowers(membership.role)) {
        return sendError(
          reply,
          403,
          "SCOPE_DENIED",
          "No tienes acceso a este cliente.",
          request.id,
        );
      }
      if (!(await requireRecentReauthentication(session, request, reply))) return;
      if (!dependencies.borrowerService) {
        return sendError(
          reply,
          503,
          "BORROWER_DOSSIER_UNAVAILABLE",
          "El módulo de clientes requiere configurar su clave de protección.",
          request.id,
        );
      }
      const result = await dependencies.borrowerService.confirmOcr(
        {
          userId: session.user.id,
          platformRole: session.user.platformRole,
          tenantRole: membership.role,
        },
        params.data.tenantId,
        params.data.borrowerId,
        { ...body.data, requestId: request.id },
      );
      if (result.status === "not_found") {
        return sendError(reply, 404, "OCR_NOT_FOUND", "La extracción no existe.", request.id);
      }
      if (result.status === "forbidden") {
        return sendError(
          reply,
          403,
          "SCOPE_DENIED",
          "No puedes confirmar estos datos.",
          request.id,
        );
      }
      if (result.status === "invalid_extraction") {
        return sendError(
          reply,
          409,
          "OCR_NOT_READY",
          "La extracción aún no tiene datos confirmables.",
          request.id,
        );
      }
      return reply.send({ borrower: result.borrower, extraction: result.extraction });
    },
  );

  app.post(
    "/v1/tenants/:tenantId/borrowers/:borrowerId/ocr/:extractionId/retry",
    async (request, reply) => {
      if (!requireAllowedOrigin(request, reply)) return;
      const session = await requireUser(request, reply);
      if (!session) return;
      const params = tenantBorrowerOcrParamsSchema.safeParse(request.params);
      if (!params.success) {
        return sendError(reply, 404, "OCR_NOT_FOUND", "La extracción no existe.", request.id);
      }
      const membership = tenantMembershipForSession(session, params.data.tenantId);
      if (!membership || !canManageBorrowers(membership.role)) {
        return sendError(reply, 403, "SCOPE_DENIED", "No puedes reintentar este OCR.", request.id);
      }
      if (!(await requireRecentReauthentication(session, request, reply))) return;
      if (!dependencies.borrowerService) {
        return sendError(
          reply,
          503,
          "BORROWER_DOSSIER_UNAVAILABLE",
          "El módulo de clientes requiere configurar su clave de protección.",
          request.id,
        );
      }
      const result = await dependencies.borrowerService.retryOcr(
        {
          userId: session.user.id,
          platformRole: session.user.platformRole,
          tenantRole: membership.role,
        },
        params.data.tenantId,
        params.data.borrowerId,
        params.data.extractionId,
        request.id,
      );
      if (result.status === "not_found") {
        return sendError(reply, 404, "OCR_NOT_FOUND", "La extracción no existe.", request.id);
      }
      if (result.status === "forbidden") {
        return sendError(reply, 403, "SCOPE_DENIED", "No puedes reintentar este OCR.", request.id);
      }
      if (result.status === "not_retryable") {
        return sendError(
          reply,
          409,
          "OCR_NOT_RETRYABLE",
          "Este documento todavía está siendo procesado o ya fue confirmado.",
          request.id,
        );
      }
      return reply.code(202).send({ extraction: result.extraction });
    },
  );

  app.post("/v1/tenants/:tenantId/borrowers/:borrowerId/documents", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session) return;
    const params = tenantBorrowerParamsSchema.safeParse(request.params);
    if (!params.success) {
      return sendError(reply, 404, "BORROWER_NOT_FOUND", "El cliente no existe.", request.id);
    }
    const membership = tenantMembershipForSession(session, params.data.tenantId);
    if (!membership || !canManageBorrowers(membership.role)) {
      return sendError(reply, 403, "SCOPE_DENIED", "No tienes acceso a este cliente.", request.id);
    }
    if (!(await requireRecentReauthentication(session, request, reply))) return;
    if (!dependencies.borrowerService || !dependencies.documentStorage) {
      return sendError(
        reply,
        503,
        "BORROWER_DOCUMENT_STORAGE_UNAVAILABLE",
        "La carga privada de documentos todavía no está configurada.",
        request.id,
      );
    }

    let categoryValue = "";
    let sideValue = "";
    let mediaType = "";
    let fileBytes: Buffer | null = null;
    try {
      for await (const part of request.parts()) {
        if (part.type === "file") {
          if (fileBytes) {
            return sendError(
              reply,
              400,
              "TOO_MANY_DOCUMENT_FILES",
              "Solo puedes cargar un archivo por vez.",
              request.id,
            );
          }
          mediaType = part.mimetype;
          fileBytes = await part.toBuffer();
        } else if (part.fieldname === "category") {
          categoryValue = String(part.value);
        } else if (part.fieldname === "side") {
          sideValue = String(part.value);
        }
      }
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "FST_REQ_FILE_TOO_LARGE"
      ) {
        return sendError(
          reply,
          413,
          "DOCUMENT_TOO_LARGE",
          "El documento supera el límite de 10 MB.",
          request.id,
        );
      }
      throw error;
    }
    const category =
      categoryValue === "identity" || categoryValue === "profile_photo" ? categoryValue : null;
    const side = sideValue === "front" || sideValue === "back" ? sideValue : null;
    if (!category || (category === "identity" && !side) || (category === "profile_photo" && side)) {
      return sendError(
        reply,
        400,
        "INVALID_DOCUMENT_CATEGORY",
        "Indica si es frente, reverso o selfie del cliente.",
        request.id,
      );
    }
    if (!fileBytes || !mediaType) {
      return sendError(
        reply,
        400,
        "DOCUMENT_REQUIRED",
        "Debes seleccionar un archivo.",
        request.id,
      );
    }
    try {
      const stored = await dependencies.documentStorage.quarantine({
        tenantId: params.data.tenantId,
        borrowerId: params.data.borrowerId,
        category,
        side,
        mediaType,
        bytes: fileBytes,
      });
      const result = await dependencies.borrowerService.addDocument(
        {
          userId: session.user.id,
          platformRole: session.user.platformRole,
          tenantRole: membership.role,
        },
        params.data.tenantId,
        params.data.borrowerId,
        { ...stored, category, side, requestId: request.id },
      );
      if (result.status !== "created") {
        await dependencies.documentStorage.remove(stored.objectKey).catch(() => undefined);
      }
      if (result.status === "not_found") {
        return sendError(reply, 404, "BORROWER_NOT_FOUND", "El cliente no existe.", request.id);
      }
      if (result.status === "forbidden") {
        return sendError(
          reply,
          403,
          "SCOPE_DENIED",
          "No puedes cargar este documento.",
          request.id,
        );
      }
      if (result.status === "invalid_object_key") {
        return sendError(
          reply,
          400,
          "INVALID_DOCUMENT_OBJECT_KEY",
          "La ruta privada no es válida.",
          request.id,
        );
      }
      if (result.status === "duplicate") {
        return sendError(
          reply,
          409,
          "DOCUMENT_ALREADY_EXISTS",
          "Ya existe un documento para esa cara del expediente.",
          request.id,
        );
      }
      return reply.code(201).send({ document: result.document });
    } catch (error) {
      if (error instanceof Error) {
        const messages: Record<string, [number, string, string]> = {
          UNSUPPORTED_DOCUMENT_TYPE: [
            400,
            "UNSUPPORTED_DOCUMENT_TYPE",
            "El formato no está permitido.",
          ],
          DOCUMENT_SIZE_INVALID: [
            400,
            "DOCUMENT_SIZE_INVALID",
            "El archivo está vacío o supera 10 MB.",
          ],
          DOCUMENT_CONTENT_INVALID: [
            400,
            "DOCUMENT_CONTENT_INVALID",
            "El contenido no coincide con su formato.",
          ],
          PROFILE_PHOTO_TYPE_INVALID: [
            400,
            "PROFILE_PHOTO_TYPE_INVALID",
            "La foto de perfil debe ser una imagen.",
          ],
          PROFILE_PHOTO_SIDE_INVALID: [
            400,
            "PROFILE_PHOTO_SIDE_INVALID",
            "La foto de perfil no tiene cara documental.",
          ],
          IDENTITY_DOCUMENT_SIDE_REQUIRED: [
            400,
            "IDENTITY_DOCUMENT_SIDE_REQUIRED",
            "El documento requiere frente o reverso.",
          ],
        };
        const mapped = messages[error.message];
        if (mapped) return sendError(reply, mapped[0], mapped[1], mapped[2], request.id);
      }
      throw error;
    }
  });

  app.post("/v1/tenants/:tenantId/borrowers", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session) return;
    const params = tenantIdParamsSchema.safeParse(request.params);
    const body = borrowerCreateRequestSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return sendError(
        reply,
        400,
        "INVALID_BORROWER",
        "Revisa los datos obligatorios del cliente y sus contactos.",
        request.id,
      );
    }
    const membership = tenantMembershipForSession(session, params.data.tenantId);
    if (!membership || !canManageBorrowers(membership.role)) {
      return sendError(
        reply,
        403,
        "SCOPE_DENIED",
        "No tienes permiso para crear clientes.",
        request.id,
      );
    }
    if (!(await requireRecentReauthentication(session, request, reply))) return;
    if (!dependencies.borrowerService) {
      return sendError(
        reply,
        503,
        "BORROWER_DOSSIER_UNAVAILABLE",
        "El módulo de clientes requiere configurar su clave de protección.",
        request.id,
      );
    }
    try {
      const result = await dependencies.borrowerService.create(
        {
          userId: session.user.id,
          platformRole: session.user.platformRole,
          tenantRole: membership.role,
        },
        params.data.tenantId,
        { ...body.data, requestId: request.id },
      );
      if (result.status === "addresses_unconfirmed") {
        return sendError(
          reply,
          400,
          "BORROWER_ADDRESSES_UNCONFIRMED",
          "Confirma con el cliente las direcciones completas de casa y trabajo antes de guardar.",
          request.id,
        );
      }
      if (result.status === "duplicate_identity") {
        return sendError(
          reply,
          409,
          "BORROWER_DUPLICATE_IDENTITY",
          "Ya existe un cliente activo con ese documento en esta empresa.",
          request.id,
        );
      }
      if (result.status === "invalid_object_key") {
        return sendError(
          reply,
          400,
          "INVALID_BORROWER_OBJECT_KEY",
          "Los documentos deben provenir del almacenamiento privado del cliente.",
          request.id,
        );
      }
      if (result.status === "not_found") {
        return sendError(
          reply,
          404,
          "BORROWER_NOT_FOUND",
          "No fue posible crear el cliente.",
          request.id,
        );
      }
      return reply.code(201).send({ borrower: result.borrower });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("INVALID_DOCUMENT_")) {
        return sendError(
          reply,
          400,
          "INVALID_BORROWER_IDENTITY",
          "El número de documento no tiene un formato válido.",
          request.id,
        );
      }
      throw error;
    }
  });

  app.patch("/v1/tenants/:tenantId/borrowers/:borrowerId/review", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session) return;
    const params = tenantBorrowerParamsSchema.safeParse(request.params);
    const body = borrowerReviewRequestSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return sendError(
        reply,
        400,
        "INVALID_BORROWER_REVIEW",
        "Revisa la decisión y la lista de comprobación.",
        request.id,
      );
    }
    const membership = tenantMembershipForSession(session, params.data.tenantId);
    if (!membership || !["owner", "supervisor"].includes(membership.role)) {
      return sendError(
        reply,
        403,
        "SCOPE_DENIED",
        "Solo propietario o supervisor puede revisar identidades.",
        request.id,
      );
    }
    if (!(await requireRecentReauthentication(session, request, reply))) return;
    if (!dependencies.borrowerService) {
      return sendError(
        reply,
        503,
        "BORROWER_DOSSIER_UNAVAILABLE",
        "El módulo de clientes requiere configurar su clave de protección.",
        request.id,
      );
    }
    const result = await dependencies.borrowerService.review(
      {
        userId: session.user.id,
        platformRole: session.user.platformRole,
        tenantRole: membership.role,
      },
      params.data.tenantId,
      params.data.borrowerId,
      { ...body.data, requestId: request.id },
    );
    if (result.status === "not_found") {
      return sendError(reply, 404, "BORROWER_NOT_FOUND", "El cliente no existe.", request.id);
    }
    if (result.status === "forbidden") {
      return sendError(reply, 403, "SCOPE_DENIED", "No puedes revisar esta identidad.", request.id);
    }
    if (result.status === "missing_documents") {
      return reply.code(409).send({
        error: {
          code: "BORROWER_DOCUMENTS_INCOMPLETE",
          message: "La aprobación exige el frente de la cédula y la selfie aceptados.",
          requestId: request.id,
        },
        missing: result.missing,
      });
    }
    return reply.send({ borrower: result.borrower });
  });

  function tenantMembershipForSession(session: { user: AuthenticatedUser }, tenantId: string) {
    return session.user.memberships.find((item) => item.tenantId === tenantId);
  }

  function verificationNetworkUnavailable(request: FastifyRequest, reply: FastifyReply) {
    return sendError(
      reply,
      503,
      "VERIFICATION_NETWORK_DISABLED",
      "La red de verificación está pendiente de habilitar la política de datos y su clave operativa.",
      request.id,
    );
  }

  app.post("/v1/tenants/:tenantId/verification-network/consents", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session) return;
    const params = verificationNetworkParamsSchema.safeParse(request.params);
    const body = verificationNetworkConsentRequestSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return sendError(
        reply,
        400,
        "INVALID_VERIFICATION_CONSENT",
        "Revisa la autorización.",
        request.id,
      );
    }
    const membership = tenantMembershipForSession(session, params.data.tenantId);
    if (!membership || !["owner", "supervisor"].includes(membership.role)) {
      return sendError(
        reply,
        403,
        "SCOPE_DENIED",
        "No tienes permiso para registrar autorizaciones.",
        request.id,
      );
    }
    if (!(await requireRecentReauthentication(session, request, reply))) return;
    if (!dependencies.verificationNetworkService)
      return verificationNetworkUnavailable(request, reply);
    try {
      const result = await dependencies.verificationNetworkService.createConsent(
        {
          userId: session.user.id,
          platformRole: session.user.platformRole,
          tenantRole: membership.role,
        },
        params.data.tenantId,
        { ...body.data, requestId: request.id },
      );
      if (result.status === "disabled") return verificationNetworkUnavailable(request, reply);
      if (result.status !== "ok") {
        return sendError(
          reply,
          404,
          "VERIFICATION_CONSENT_NOT_FOUND",
          "No fue posible registrar el consentimiento.",
          request.id,
        );
      }
      return reply.code(201).send({ consent: result.value });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("INVALID_DOCUMENT_")) {
        return sendError(
          reply,
          400,
          "INVALID_DOCUMENT_IDENTITY",
          "Los datos de identificación no son válidos.",
          request.id,
        );
      }
      throw error;
    }
  });

  app.delete(
    "/v1/tenants/:tenantId/verification-network/consents/:consentId",
    async (request, reply) => {
      if (!requireAllowedOrigin(request, reply)) return;
      const session = await requireUser(request, reply);
      if (!session) return;
      const params = verificationNetworkConsentParamsSchema.safeParse(request.params);
      if (!params.success) {
        return sendError(
          reply,
          404,
          "VERIFICATION_CONSENT_NOT_FOUND",
          "El consentimiento no existe.",
          request.id,
        );
      }
      const membership = tenantMembershipForSession(session, params.data.tenantId);
      if (!membership || !["owner", "supervisor"].includes(membership.role)) {
        return sendError(
          reply,
          403,
          "SCOPE_DENIED",
          "Solo propietario o supervisor puede revocar un consentimiento.",
          request.id,
        );
      }
      if (!(await requireRecentReauthentication(session, request, reply))) return;
      if (!dependencies.verificationNetworkService)
        return verificationNetworkUnavailable(request, reply);
      const result = await dependencies.verificationNetworkService.revokeConsent(
        {
          userId: session.user.id,
          platformRole: session.user.platformRole,
          tenantRole: membership.role,
        },
        params.data.tenantId,
        params.data.consentId,
        request.id,
      );
      if (result.status === "disabled") return verificationNetworkUnavailable(request, reply);
      if (result.status !== "ok")
        return sendError(
          reply,
          404,
          "VERIFICATION_CONSENT_NOT_FOUND",
          "El consentimiento no existe o ya fue revocado.",
          request.id,
        );
      return reply.code(204).send();
    },
  );

  app.post("/v1/tenants/:tenantId/verification-network/query", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session) return;
    const params = verificationNetworkParamsSchema.safeParse(request.params);
    const body = verificationNetworkQueryRequestSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return sendError(
        reply,
        400,
        "INVALID_VERIFICATION_QUERY",
        "Revisa la consulta y el consentimiento.",
        request.id,
      );
    }
    const membership = tenantMembershipForSession(session, params.data.tenantId);
    if (!membership)
      return sendError(reply, 403, "SCOPE_DENIED", "No tienes acceso a esta empresa.", request.id);
    if (!dependencies.verificationNetworkService)
      return verificationNetworkUnavailable(request, reply);
    try {
      const result = await dependencies.verificationNetworkService.query(
        {
          userId: session.user.id,
          platformRole: session.user.platformRole,
          tenantRole: membership.role,
        },
        params.data.tenantId,
        { ...body.data, requestId: request.id },
      );
      if (result.status === "disabled") return verificationNetworkUnavailable(request, reply);
      if (result.status !== "ok")
        return sendError(
          reply,
          403,
          "CONSENT_REQUIRED",
          "El consentimiento no es válido.",
          request.id,
        );
      return reply.send(result.value);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("INVALID_DOCUMENT_")) {
        return sendError(
          reply,
          400,
          "INVALID_DOCUMENT_IDENTITY",
          "Los datos de identificación no son válidos.",
          request.id,
        );
      }
      throw error;
    }
  });

  app.post("/v1/tenants/:tenantId/verification-network/assertions", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session) return;
    const params = verificationNetworkParamsSchema.safeParse(request.params);
    const body = verificationNetworkAssertionRequestSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return sendError(
        reply,
        400,
        "INVALID_VERIFICATION_ASSERTION",
        "Revisa el evento verificable.",
        request.id,
      );
    }
    const membership = tenantMembershipForSession(session, params.data.tenantId);
    if (!membership || !["owner", "supervisor"].includes(membership.role)) {
      return sendError(
        reply,
        403,
        "SCOPE_DENIED",
        "Solo propietario o supervisor puede publicar una observación.",
        request.id,
      );
    }
    if (!(await requireRecentReauthentication(session, request, reply))) return;
    if (!dependencies.verificationNetworkService)
      return verificationNetworkUnavailable(request, reply);
    try {
      const result = await dependencies.verificationNetworkService.publishAssertion(
        {
          userId: session.user.id,
          platformRole: session.user.platformRole,
          tenantRole: membership.role,
        },
        params.data.tenantId,
        { ...body.data, requestId: request.id },
      );
      if (result.status === "disabled") return verificationNetworkUnavailable(request, reply);
      if (result.status === "not_found")
        return sendError(
          reply,
          404,
          "VERIFICATION_ASSERTION_NOT_FOUND",
          "No fue posible publicar la observación.",
          request.id,
        );
      if (result.status === "no_consent")
        return sendError(
          reply,
          409,
          "CONSENT_REQUIRED",
          "La persona debe autorizar primero esta publicación.",
          request.id,
        );
      return reply.code(201).send({ assertion: result.value });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("INVALID_DOCUMENT_")) {
        return sendError(
          reply,
          400,
          "INVALID_DOCUMENT_IDENTITY",
          "Los datos de identificación no son válidos.",
          request.id,
        );
      }
      throw error;
    }
  });

  app.post("/v1/tenants/:tenantId/verification-network/corrections", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session) return;
    const params = verificationNetworkParamsSchema.safeParse(request.params);
    const body = verificationNetworkCorrectionRequestSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return sendError(
        reply,
        400,
        "INVALID_VERIFICATION_CORRECTION",
        "Describe la corrección con al menos 10 caracteres.",
        request.id,
      );
    }
    const membership = tenantMembershipForSession(session, params.data.tenantId);
    if (!membership)
      return sendError(reply, 403, "SCOPE_DENIED", "No tienes acceso a esta empresa.", request.id);
    if (!dependencies.verificationNetworkService)
      return verificationNetworkUnavailable(request, reply);
    try {
      const result = await dependencies.verificationNetworkService.createCorrection(
        {
          userId: session.user.id,
          platformRole: session.user.platformRole,
          tenantRole: membership.role,
        },
        params.data.tenantId,
        { ...body.data, requestId: request.id },
      );
      if (result.status === "disabled") return verificationNetworkUnavailable(request, reply);
      if (result.status === "not_found")
        return sendError(
          reply,
          404,
          "VERIFICATION_CORRECTION_NOT_FOUND",
          "No fue posible abrir la corrección.",
          request.id,
        );
      if (result.status === "no_consent")
        return sendError(
          reply,
          403,
          "CONSENT_REQUIRED",
          "El token de consentimiento no es válido.",
          request.id,
        );
      return reply.code(201).send({ correction: result.value });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("INVALID_DOCUMENT_")) {
        return sendError(
          reply,
          400,
          "INVALID_DOCUMENT_IDENTITY",
          "Los datos de identificación no son válidos.",
          request.id,
        );
      }
      throw error;
    }
  });

  app.get("/v1/tenants/:tenantId/support-access", async (request, reply) => {
    const session = await requireUser(request, reply);
    if (!session) return;
    const params = tenantIdParamsSchema.safeParse(request.params);
    if (!params.success) {
      return sendError(reply, 404, "TENANT_NOT_FOUND", "La empresa no existe.", request.id);
    }
    const membership = session.user.memberships.find(
      (item) => item.tenantId === params.data.tenantId,
    );
    if (membership?.role !== "owner") {
      return sendError(
        reply,
        403,
        "OWNER_REQUIRED",
        "Solo el propietario puede revisar accesos de soporte.",
        request.id,
      );
    }
    return {
      access: await dependencies.supportAccessService.listForTenant(
        {
          userId: session.user.id,
          platformRole: session.user.platformRole,
          tenantRole: membership.role,
        },
        params.data.tenantId,
      ),
    };
  });

  app.patch("/v1/tenants/:tenantId/support-access/:accessId", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session) return;
    const params = tenantSupportAccessParamsSchema.safeParse(request.params);
    const body = supportAccessReviewSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return sendError(
        reply,
        400,
        "INVALID_SUPPORT_ACCESS",
        "La decisión solicitada no es válida.",
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
        "Solo el propietario puede administrar accesos de soporte.",
        request.id,
      );
    }
    if (!(await requireRecentReauthentication(session, request, reply))) return;
    const result = await dependencies.supportAccessService.reviewAccess(
      {
        userId: session.user.id,
        platformRole: session.user.platformRole,
        tenantRole: membership.role,
      },
      params.data.tenantId,
      params.data.accessId,
      body.data.action,
      request.id,
    );
    if (result.status === "not_found") {
      return sendError(reply, 404, "SUPPORT_ACCESS_NOT_FOUND", "El acceso no existe.", request.id);
    }
    if (result.status === "invalid_transition") {
      return sendError(
        reply,
        409,
        "INVALID_SUPPORT_ACCESS_TRANSITION",
        "Ese acceso ya no admite la acción solicitada.",
        request.id,
      );
    }
    return { access: result.access };
  });

  app.post("/v1/tenants/:tenantId/invitations", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session) return;
    const params = tenantIdParamsSchema.safeParse(request.params);
    const body = tenantInvitationRequestSchema.safeParse(request.body);
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
    if (!(await requireRecentReauthentication(session, request, reply))) return;
    const invitation = await dependencies.tenancyService.createInvitation(
      {
        userId: session.user.id,
        platformRole: session.user.platformRole,
        tenantRole: membership.role,
      },
      params.data.tenantId,
      { ...body.data, email: body.data.email.toLowerCase(), requestId: request.id },
    );
    if (!invitation)
      return sendError(reply, 404, "TENANT_NOT_FOUND", "La empresa no existe.", request.id);
    return reply.code(201).send({ invitation });
  });

  app.delete("/v1/tenants/:tenantId/invitations/:invitationId", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session) return;
    const params = tenantInvitationParamsSchema.safeParse(request.params);
    if (!params.success) {
      return sendError(reply, 404, "INVITATION_NOT_FOUND", "La invitación no existe.", request.id);
    }
    const membership = session.user.memberships.find(
      (item) => item.tenantId === params.data.tenantId,
    );
    if (membership?.role !== "owner") {
      return sendError(
        reply,
        403,
        "OWNER_REQUIRED",
        "Solo el propietario puede revocar invitaciones.",
        request.id,
      );
    }
    if (!(await requireRecentReauthentication(session, request, reply))) return;
    const result = await dependencies.tenancyService.revokeInvitation(
      {
        userId: session.user.id,
        platformRole: session.user.platformRole,
        tenantRole: membership.role,
      },
      params.data.tenantId,
      params.data.invitationId,
      request.id,
    );
    if (result.status === "protected") {
      return sendError(
        reply,
        409,
        "PLATFORM_APPROVAL_REQUIRED",
        "La invitación de un propietario debe administrarse desde la plataforma.",
        request.id,
      );
    }
    if (result.status === "not_found") {
      return sendError(
        reply,
        404,
        "INVITATION_NOT_FOUND",
        "La invitación no existe o ya no está pendiente.",
        request.id,
      );
    }
    return reply.code(204).send();
  });

  app.post("/v1/tenants/:tenantId/members", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session) return;
    const params = tenantIdParamsSchema.safeParse(request.params);
    const body = tenantMemberCreateRequestSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return sendError(
        reply,
        400,
        "INVALID_MEMBER_CREATE",
        "Revisa el nombre de usuario, teléfono, contraseña y rol.",
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
        "Solo el propietario puede crear empleados.",
        request.id,
      );
    }
    if (!(await requireRecentReauthentication(session, request, reply))) return;
    const result = await dependencies.tenancyService.createMember(
      {
        userId: session.user.id,
        platformRole: session.user.platformRole,
        tenantRole: membership.role,
      },
      params.data.tenantId,
      { ...body.data, requestId: request.id },
    );
    if (result.status === "username_unavailable") {
      return sendError(
        reply,
        409,
        "USERNAME_UNAVAILABLE",
        "Ese nombre de usuario ya está ocupado. Elige otro.",
        request.id,
      );
    }
    if (result.status === "seat_limit_reached") {
      return sendError(
        reply,
        409,
        "EMPLOYEE_SEAT_LIMIT_REACHED",
        `El plan permite ${result.employeeSeatLimit} empleados activos. Actualiza el plan para crear más accesos.`,
        request.id,
      );
    }
    return reply.code(201).send({ member: result.member });
  });

  app.patch("/v1/tenants/:tenantId/members/:userId", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session) return;
    const params = tenantMemberParamsSchema.safeParse(request.params);
    const body = tenantMemberUpdateRequestSchema.safeParse(request.body);
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
    if (!(await requireRecentReauthentication(session, request, reply))) return;
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
    if (result.status === "seat_limit_reached") {
      return sendError(
        reply,
        409,
        "EMPLOYEE_SEAT_LIMIT_REACHED",
        `La empresa ya usa sus ${result.employeeSeatLimit} cupos de empleados. Solicita una ampliación antes de activar este acceso.`,
        request.id,
      );
    }
    return reply.send({ member: result.member });
  });

  app.get("/v1/tenants/:tenantId/loan-products", async (request, reply) => {
    const session = await requireUser(request, reply);
    if (!session) return;
    const params = tenantIdParamsSchema.safeParse(request.params);
    if (!params.success) {
      return sendError(reply, 404, "TENANT_NOT_FOUND", "La empresa no existe.", request.id);
    }
    const membership = session.user.memberships.find(
      (item) => item.tenantId === params.data.tenantId,
    );
    if (!membership || !["owner", "supervisor", "collector"].includes(membership.role)) {
      return sendError(
        reply,
        403,
        "SCOPE_DENIED",
        "No puedes consultar el catálogo de crédito.",
        request.id,
      );
    }
    if (!dependencies.creditService) {
      return sendError(
        reply,
        503,
        "CREDIT_CATALOG_UNAVAILABLE",
        "El catálogo de crédito todavía no está configurado.",
        request.id,
      );
    }
    const products = await dependencies.creditService.listProducts(
      {
        userId: session.user.id,
        platformRole: session.user.platformRole,
        tenantRole: membership.role,
      },
      params.data.tenantId,
    );
    return reply.send({ products });
  });

  app.post("/v1/tenants/:tenantId/loan-products", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session) return;
    const params = tenantIdParamsSchema.safeParse(request.params);
    const body = loanProductCreateRequestSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return sendError(
        reply,
        400,
        "INVALID_LOAN_PRODUCT",
        "Revisa los parámetros del producto y los decimales.",
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
        "SCOPE_DENIED",
        "Solo el propietario puede configurar productos de crédito.",
        request.id,
      );
    }
    if (!(await requireRecentReauthentication(session, request, reply))) return;
    if (!dependencies.creditService) {
      return sendError(
        reply,
        503,
        "CREDIT_CATALOG_UNAVAILABLE",
        "El catálogo de crédito todavía no está configurado.",
        request.id,
      );
    }
    const result = await dependencies.creditService.createProduct(
      {
        userId: session.user.id,
        platformRole: session.user.platformRole,
        tenantRole: membership.role,
      },
      params.data.tenantId,
      { ...body.data, requestId: request.id },
    );
    if (result.status === "forbidden") {
      return sendError(
        reply,
        403,
        "SCOPE_DENIED",
        "Solo el propietario puede configurar productos de crédito.",
        request.id,
      );
    }
    if (result.status === "duplicate") {
      return sendError(
        reply,
        409,
        "LOAN_PRODUCT_DUPLICATE",
        "Ya existe un producto con ese nombre en la empresa.",
        request.id,
      );
    }
    return reply.code(201).send({ product: result.product });
  });

  app.patch("/v1/tenants/:tenantId/loan-products/:productId", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session) return;
    const params = tenantLoanProductParamsSchema.safeParse(request.params);
    const body = loanProductUpdateRequestSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return sendError(
        reply,
        400,
        "INVALID_LOAN_PRODUCT",
        "Revisa los parámetros del producto y los decimales.",
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
        "SCOPE_DENIED",
        "Solo el propietario puede ajustar productos.",
        request.id,
      );
    }
    if (!(await requireRecentReauthentication(session, request, reply))) return;
    if (!dependencies.creditService) {
      return sendError(
        reply,
        503,
        "CREDIT_CATALOG_UNAVAILABLE",
        "El catálogo de crédito todavía no está configurado.",
        request.id,
      );
    }
    const result = await dependencies.creditService.updateProduct(
      {
        userId: session.user.id,
        platformRole: session.user.platformRole,
        tenantRole: membership.role,
      },
      params.data.tenantId,
      params.data.productId,
      { ...body.data, requestId: request.id },
    );
    if (result.status === "forbidden") {
      return sendError(reply, 403, "SCOPE_DENIED", "No puedes ajustar este producto.", request.id);
    }
    if (result.status === "not_found") {
      return sendError(reply, 404, "LOAN_PRODUCT_NOT_FOUND", "El producto no existe.", request.id);
    }
    if (result.status === "invalid_state") {
      return sendError(
        reply,
        409,
        "LOAN_PRODUCT_INVALID_STATE",
        "Solo los productos en borrador pueden ajustarse.",
        request.id,
      );
    }
    if (result.status === "duplicate") {
      return sendError(
        reply,
        409,
        "LOAN_PRODUCT_DUPLICATE",
        "Ya existe un producto con ese nombre en la empresa.",
        request.id,
      );
    }
    return reply.send({ product: result.product });
  });

  app.post("/v1/tenants/:tenantId/loan-products/:productId/review", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session) return;
    const params = tenantLoanProductParamsSchema.safeParse(request.params);
    if (!params.success) {
      return sendError(reply, 404, "LOAN_PRODUCT_NOT_FOUND", "El producto no existe.", request.id);
    }
    const membership = session.user.memberships.find(
      (item) => item.tenantId === params.data.tenantId,
    );
    if (!membership || !["owner", "supervisor"].includes(membership.role)) {
      return sendError(
        reply,
        403,
        "SCOPE_DENIED",
        "Solo propietarios y supervisores pueden enviar productos a revisión.",
        request.id,
      );
    }
    if (!(await requireRecentReauthentication(session, request, reply))) return;
    if (!dependencies.creditService) {
      return sendError(
        reply,
        503,
        "CREDIT_CATALOG_UNAVAILABLE",
        "El catálogo de crédito todavía no está configurado.",
        request.id,
      );
    }
    const result = await dependencies.creditService.submitProductForReview(
      {
        userId: session.user.id,
        platformRole: session.user.platformRole,
        tenantRole: membership.role,
      },
      params.data.tenantId,
      params.data.productId,
      request.id,
    );
    if (result.status === "forbidden") {
      return sendError(
        reply,
        403,
        "SCOPE_DENIED",
        "Solo propietarios y supervisores pueden enviar productos a revisión.",
        request.id,
      );
    }
    if (result.status === "not_found") {
      return sendError(reply, 404, "LOAN_PRODUCT_NOT_FOUND", "El producto no existe.", request.id);
    }
    if (result.status === "invalid_state") {
      return sendError(
        reply,
        409,
        "LOAN_PRODUCT_INVALID_STATE",
        "Solo un borrador puede enviarse a revisión.",
        request.id,
      );
    }
    if (result.status === "missing_evidence") {
      return sendError(
        reply,
        409,
        "LOAN_PRODUCT_EVIDENCE_REQUIRED",
        "Agrega una referencia normativa vigente antes de enviar el producto a revisión.",
        request.id,
      );
    }
    return reply.send({ product: result.product });
  });

  app.post(
    "/v1/tenants/:tenantId/loan-products/:productId/schedule-preview",
    async (request, reply) => {
      if (!requireAllowedOrigin(request, reply)) return;
      const session = await requireUser(request, reply);
      if (!session) return;
      const params = tenantLoanProductParamsSchema.safeParse(request.params);
      const body = financialSchedulePreviewRequestSchema.safeParse(request.body);
      if (!params.success || !body.success) {
        return sendError(
          reply,
          400,
          "INVALID_SCHEDULE_PREVIEW",
          "Revisa el monto, los periodos y la fecha inicial.",
          request.id,
        );
      }
      const membership = session.user.memberships.find(
        (item) => item.tenantId === params.data.tenantId,
      );
      if (!membership || !["owner", "supervisor", "collector"].includes(membership.role)) {
        return sendError(
          reply,
          403,
          "SCOPE_DENIED",
          "No puedes consultar la proyección de este producto.",
          request.id,
        );
      }
      if (!dependencies.creditService) {
        return sendError(
          reply,
          503,
          "CREDIT_CATALOG_UNAVAILABLE",
          "El catálogo de crédito todavía no está configurado.",
          request.id,
        );
      }
      const result = await dependencies.creditService.previewSchedule(
        {
          userId: session.user.id,
          platformRole: session.user.platformRole,
          tenantRole: membership.role,
        },
        params.data.tenantId,
        params.data.productId,
        body.data,
      );
      if (result.status === "forbidden") {
        return sendError(
          reply,
          403,
          "SCOPE_DENIED",
          "No puedes consultar la proyección de este producto.",
          request.id,
        );
      }
      if (result.status === "not_found") {
        return sendError(
          reply,
          404,
          "LOAN_PRODUCT_NOT_FOUND",
          "El producto no existe.",
          request.id,
        );
      }
      if (result.status === "invalid_parameters") {
        return sendError(
          reply,
          409,
          "INVALID_SCHEDULE_PREVIEW",
          "El monto o el plazo no son compatibles con el producto.",
          request.id,
        );
      }
      return reply.send({ preview: result.preview });
    },
  );

  app.get("/v1/tenants/:tenantId/loan-applications", async (request, reply) => {
    const session = await requireUser(request, reply);
    if (!session) return;
    const params = tenantIdParamsSchema.safeParse(request.params);
    if (!params.success) {
      return sendError(reply, 404, "TENANT_NOT_FOUND", "La empresa no existe.", request.id);
    }
    const membership = session.user.memberships.find(
      (item) => item.tenantId === params.data.tenantId,
    );
    if (!membership || !["owner", "supervisor", "collector"].includes(membership.role)) {
      return sendError(
        reply,
        403,
        "SCOPE_DENIED",
        "No puedes consultar solicitudes de crédito.",
        request.id,
      );
    }
    if (!dependencies.creditService) {
      return sendError(
        reply,
        503,
        "CREDIT_APPLICATIONS_UNAVAILABLE",
        "Las solicitudes de crédito todavía no están configuradas.",
        request.id,
      );
    }
    const applications = await dependencies.creditService.listApplications(
      {
        userId: session.user.id,
        platformRole: session.user.platformRole,
        tenantRole: membership.role,
      },
      params.data.tenantId,
    );
    return reply.send({ applications });
  });

  app.post("/v1/tenants/:tenantId/loan-applications", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session) return;
    const params = tenantIdParamsSchema.safeParse(request.params);
    const body = loanApplicationCreateRequestSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return sendError(
        reply,
        400,
        "INVALID_LOAN_APPLICATION",
        "Revisa el cliente, producto, monto y plazo solicitados.",
        request.id,
      );
    }
    const membership = session.user.memberships.find(
      (item) => item.tenantId === params.data.tenantId,
    );
    if (!membership || !["owner", "supervisor", "collector"].includes(membership.role)) {
      return sendError(
        reply,
        403,
        "SCOPE_DENIED",
        "No puedes crear solicitudes de crédito.",
        request.id,
      );
    }
    if (!(await requireRecentReauthentication(session, request, reply))) return;
    if (!dependencies.creditService) {
      return sendError(
        reply,
        503,
        "CREDIT_APPLICATIONS_UNAVAILABLE",
        "Las solicitudes de crédito todavía no están configuradas.",
        request.id,
      );
    }
    const result = await dependencies.creditService.createApplication(
      {
        userId: session.user.id,
        platformRole: session.user.platformRole,
        tenantRole: membership.role,
      },
      params.data.tenantId,
      { ...body.data, requestId: request.id },
    );
    if (result.status === "forbidden") {
      return sendError(
        reply,
        403,
        "SCOPE_DENIED",
        "No puedes crear solicitudes de crédito.",
        request.id,
      );
    }
    if (result.status === "not_found") {
      return sendError(
        reply,
        404,
        "BORROWER_OR_PRODUCT_NOT_FOUND",
        "El cliente no existe o no está activo.",
        request.id,
      );
    }
    if (result.status === "invalid_product") {
      return sendError(
        reply,
        409,
        "LOAN_PRODUCT_NOT_AVAILABLE",
        "El producto no está disponible para nuevas solicitudes.",
        request.id,
      );
    }
    if (result.status === "amount_out_of_range") {
      return sendError(
        reply,
        409,
        "LOAN_APPLICATION_AMOUNT_OUT_OF_RANGE",
        "El monto está fuera del rango permitido por el producto.",
        request.id,
      );
    }
    if (result.status === "term_out_of_range") {
      return sendError(
        reply,
        409,
        "LOAN_APPLICATION_TERM_OUT_OF_RANGE",
        "El plazo supera los periodos permitidos por el producto.",
        request.id,
      );
    }
    return reply.code(201).send({ application: result.application });
  });

  app.post(
    "/v1/tenants/:tenantId/loan-applications/:applicationId/payments",
    async (request, reply) => {
      if (!requireAllowedOrigin(request, reply)) return;
      const session = await requireUser(request, reply);
      if (!session) return;
      const params = tenantLoanApplicationParamsSchema.safeParse(request.params);
      const body = loanPaymentCreateRequestSchema.safeParse(request.body);
      if (!params.success || !body.success) {
        return sendError(reply, 400, "INVALID_LOAN_PAYMENT", "La cuota no es válida.", request.id);
      }
      const membership = session.user.memberships.find(
        (item) => item.tenantId === params.data.tenantId,
      );
      if (!membership || !["owner", "supervisor", "collector"].includes(membership.role)) {
        return sendError(reply, 403, "SCOPE_DENIED", "No puedes registrar pagos.", request.id);
      }
      if (!(await requireRecentReauthentication(session, request, reply))) return;
      if (!dependencies.creditService) {
        return sendError(
          reply,
          503,
          "CREDIT_APPLICATIONS_UNAVAILABLE",
          "Los créditos no están configurados.",
          request.id,
        );
      }
      const result = await dependencies.creditService.recordPayment(
        {
          userId: session.user.id,
          platformRole: session.user.platformRole,
          tenantRole: membership.role,
        },
        params.data.tenantId,
        params.data.applicationId,
        { ...body.data, requestId: request.id },
      );
      if (result.status === "forbidden") {
        return sendError(reply, 403, "SCOPE_DENIED", "No puedes registrar pagos.", request.id);
      }
      if (result.status === "not_found") {
        return sendError(
          reply,
          404,
          "LOAN_APPLICATION_NOT_FOUND",
          "El crédito no existe.",
          request.id,
        );
      }
      if (result.status === "invalid_state") {
        return sendError(
          reply,
          409,
          "LOAN_APPLICATION_INVALID_STATE",
          "El crédito no está activo.",
          request.id,
        );
      }
      if (result.status === "already_paid" || result.status === "invalid_installment") {
        return sendError(
          reply,
          409,
          "LOAN_PAYMENT_INVALID_INSTALLMENT",
          "Registra las cuotas en orden y una sola vez.",
          request.id,
        );
      }
      return reply.send({ application: result.application, amount: result.amount });
    },
  );

  app.post(
    "/v1/tenants/:tenantId/loan-applications/:applicationId/renew",
    async (request, reply) => {
      if (!requireAllowedOrigin(request, reply)) return;
      const session = await requireUser(request, reply);
      if (!session) return;
      const params = tenantLoanApplicationParamsSchema.safeParse(request.params);
      const body = loanRenewalRequestSchema.safeParse(request.body);
      if (!params.success || !body.success) {
        return sendError(
          reply,
          400,
          "INVALID_LOAN_RENEWAL",
          "El excedente de renovación no es válido.",
          request.id,
        );
      }
      const membership = session.user.memberships.find(
        (item) => item.tenantId === params.data.tenantId,
      );
      if (!membership || !["owner", "supervisor", "collector"].includes(membership.role)) {
        return sendError(reply, 403, "SCOPE_DENIED", "No puedes renovar créditos.", request.id);
      }
      if (!(await requireRecentReauthentication(session, request, reply))) return;
      if (!dependencies.creditService) {
        return sendError(
          reply,
          503,
          "CREDIT_APPLICATIONS_UNAVAILABLE",
          "Los créditos no están configurados.",
          request.id,
        );
      }
      const result = await dependencies.creditService.renewApplication(
        {
          userId: session.user.id,
          platformRole: session.user.platformRole,
          tenantRole: membership.role,
        },
        params.data.tenantId,
        params.data.applicationId,
        { ...body.data, requestId: request.id },
      );
      if (result.status === "forbidden") {
        return sendError(reply, 403, "SCOPE_DENIED", "No puedes renovar créditos.", request.id);
      }
      if (result.status === "not_found") {
        return sendError(
          reply,
          404,
          "LOAN_APPLICATION_NOT_FOUND",
          "El crédito no existe.",
          request.id,
        );
      }
      if (result.status === "invalid_state") {
        return sendError(
          reply,
          409,
          "LOAN_RENEWAL_REQUIRES_TWO_PAYMENTS",
          "La renovación está disponible después de dos cuotas pagadas.",
          request.id,
        );
      }
      if (result.status === "amount_out_of_range") {
        return sendError(
          reply,
          409,
          "LOAN_RENEWAL_AMOUNT_OUT_OF_RANGE",
          "El nuevo crédito supera el monto máximo configurado.",
          request.id,
        );
      }
      return reply.code(201).send({
        application: result.application,
        renewedPrincipal: result.renewedPrincipal,
        excessAmount: result.excessAmount,
      });
    },
  );

  app.post(
    "/v1/tenants/:tenantId/loan-applications/:applicationId/submit",
    async (request, reply) => {
      if (!requireAllowedOrigin(request, reply)) return;
      const session = await requireUser(request, reply);
      if (!session) return;
      const params = tenantLoanApplicationParamsSchema.safeParse(request.params);
      if (!params.success) {
        return sendError(
          reply,
          404,
          "LOAN_APPLICATION_NOT_FOUND",
          "La solicitud no existe.",
          request.id,
        );
      }
      const membership = session.user.memberships.find(
        (item) => item.tenantId === params.data.tenantId,
      );
      if (!membership || !["owner", "supervisor", "collector"].includes(membership.role)) {
        return sendError(
          reply,
          403,
          "SCOPE_DENIED",
          "No puedes enviar solicitudes de crédito a revisión.",
          request.id,
        );
      }
      if (!(await requireRecentReauthentication(session, request, reply))) return;
      if (!dependencies.creditService) {
        return sendError(
          reply,
          503,
          "CREDIT_APPLICATIONS_UNAVAILABLE",
          "Las solicitudes de crédito todavía no están configuradas.",
          request.id,
        );
      }
      const result = await dependencies.creditService.submitApplicationForReview(
        {
          userId: session.user.id,
          platformRole: session.user.platformRole,
          tenantRole: membership.role,
        },
        params.data.tenantId,
        params.data.applicationId,
        request.id,
      );
      if (result.status === "forbidden") {
        return sendError(
          reply,
          403,
          "SCOPE_DENIED",
          "No puedes enviar solicitudes de crédito a revisión.",
          request.id,
        );
      }
      if (result.status === "not_found") {
        return sendError(
          reply,
          404,
          "LOAN_APPLICATION_NOT_FOUND",
          "La solicitud no existe.",
          request.id,
        );
      }
      if (result.status === "invalid_state") {
        return sendError(
          reply,
          409,
          "LOAN_APPLICATION_INVALID_STATE",
          "Solo un borrador puede enviarse a revisión.",
          request.id,
        );
      }
      if (result.status === "borrower_not_verified") {
        return sendError(
          reply,
          409,
          "BORROWER_IDENTITY_REVIEW_REQUIRED",
          "La identidad del cliente debe estar revisada antes de enviar la solicitud.",
          request.id,
        );
      }
      if (result.status === "product_not_reviewed") {
        return sendError(
          reply,
          409,
          "LOAN_PRODUCT_REVIEW_REQUIRED",
          "El producto debe estar en revisión o aprobado antes de enviar la solicitud.",
          request.id,
        );
      }
      return reply.send({ application: result.application });
    },
  );

  app.post(
    "/v1/tenants/:tenantId/loan-applications/:applicationId/review",
    async (request, reply) => {
      if (!requireAllowedOrigin(request, reply)) return;
      const session = await requireUser(request, reply);
      if (!session) return;
      const params = tenantLoanApplicationParamsSchema.safeParse(request.params);
      if (!params.success) {
        return sendError(
          reply,
          404,
          "LOAN_APPLICATION_NOT_FOUND",
          "La solicitud no existe.",
          request.id,
        );
      }
      const membership = session.user.memberships.find(
        (item) => item.tenantId === params.data.tenantId,
      );
      if (!membership || !["owner", "supervisor"].includes(membership.role)) {
        return sendError(
          reply,
          403,
          "SCOPE_DENIED",
          "Solo un propietario o supervisor puede iniciar la revisión.",
          request.id,
        );
      }
      if (!(await requireRecentReauthentication(session, request, reply))) return;
      if (!dependencies.creditService) {
        return sendError(
          reply,
          503,
          "CREDIT_APPLICATIONS_UNAVAILABLE",
          "Las solicitudes de crédito todavía no están configuradas.",
          request.id,
        );
      }
      const result = await dependencies.creditService.startApplicationReview(
        {
          userId: session.user.id,
          platformRole: session.user.platformRole,
          tenantRole: membership.role,
        },
        params.data.tenantId,
        params.data.applicationId,
        request.id,
      );
      if (result.status === "forbidden") {
        return sendError(
          reply,
          403,
          "SCOPE_DENIED",
          "Solo un propietario o supervisor puede iniciar la revisión.",
          request.id,
        );
      }
      if (result.status === "not_found") {
        return sendError(
          reply,
          404,
          "LOAN_APPLICATION_NOT_FOUND",
          "La solicitud no existe.",
          request.id,
        );
      }
      if (result.status === "invalid_state") {
        return sendError(
          reply,
          409,
          "LOAN_APPLICATION_INVALID_STATE",
          "Solo una solicitud enviada puede entrar en revisión.",
          request.id,
        );
      }
      return reply.send({ application: result.application });
    },
  );

  app.post(
    "/v1/tenants/:tenantId/loan-applications/:applicationId/approve",
    async (request, reply) => {
      if (!requireAllowedOrigin(request, reply)) return;
      const session = await requireUser(request, reply);
      if (!session) return;
      const params = tenantLoanApplicationParamsSchema.safeParse(request.params);
      if (!params.success) {
        return sendError(
          reply,
          404,
          "LOAN_APPLICATION_NOT_FOUND",
          "La solicitud no existe.",
          request.id,
        );
      }
      const membership = session.user.memberships.find(
        (item) => item.tenantId === params.data.tenantId,
      );
      if (!membership || !["owner", "supervisor"].includes(membership.role)) {
        return sendError(
          reply,
          403,
          "SCOPE_DENIED",
          "Solo un propietario o supervisor puede aprobar el crédito.",
          request.id,
        );
      }
      if (!(await requireRecentReauthentication(session, request, reply))) return;
      if (!dependencies.creditService) {
        return sendError(
          reply,
          503,
          "CREDIT_APPLICATIONS_UNAVAILABLE",
          "Los créditos todavía no están configurados.",
          request.id,
        );
      }
      const result = await dependencies.creditService.approveApplication(
        {
          userId: session.user.id,
          platformRole: session.user.platformRole,
          tenantRole: membership.role,
        },
        params.data.tenantId,
        params.data.applicationId,
        request.id,
      );
      if (result.status === "forbidden") {
        return sendError(
          reply,
          403,
          "SCOPE_DENIED",
          "Solo un propietario o supervisor puede aprobar el crédito.",
          request.id,
        );
      }
      if (result.status === "not_found") {
        return sendError(
          reply,
          404,
          "LOAN_APPLICATION_NOT_FOUND",
          "La solicitud no existe.",
          request.id,
        );
      }
      if (result.status === "invalid_state") {
        return sendError(
          reply,
          409,
          "LOAN_APPLICATION_INVALID_STATE",
          "Solo una solicitud pendiente puede aprobarse.",
          request.id,
        );
      }
      return reply.send({ application: result.application });
    },
  );

  app.get("/v1/tenants/:tenantId/brand-logo", async (request, reply) => {
    const session = await requireUser(request, reply);
    if (!session) return;
    const params = tenantIdParamsSchema.safeParse(request.params);
    if (!params.success)
      return sendError(reply, 400, "INVALID_TENANT", "La empresa no es válida.", request.id);
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
    const objectKey = overview?.settings.logoObjectKey;
    const storage = dependencies.documentStorage;
    if (!objectKey || !storage || !objectKey.startsWith(`tenant/${params.data.tenantId}/brand/`)) {
      return sendError(
        reply,
        404,
        "BRAND_LOGO_NOT_FOUND",
        "La empresa todavía no tiene logo.",
        request.id,
      );
    }
    const stored = await storage.read(objectKey);
    if (!stored)
      return sendError(
        reply,
        404,
        "BRAND_LOGO_NOT_FOUND",
        "La empresa todavía no tiene logo.",
        request.id,
      );
    return reply
      .type(stored.mediaType)
      .header("cache-control", "private, max-age=300")
      .send(stored.bytes);
  });

  app.post("/v1/tenants/:tenantId/brand-logo", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session) return;
    const params = tenantIdParamsSchema.safeParse(request.params);
    if (!params.success)
      return sendError(reply, 400, "INVALID_TENANT", "La empresa no es válida.", request.id);
    const membership = session.user.memberships.find(
      (item) => item.tenantId === params.data.tenantId,
    );
    if (membership?.role !== "owner")
      return sendError(
        reply,
        403,
        "OWNER_REQUIRED",
        "Solo el propietario puede cambiar el logo.",
        request.id,
      );
    if (!(await requireRecentReauthentication(session, request, reply))) return;
    const storage = dependencies.documentStorage;
    const setTenantLogo = dependencies.tenancyService.setTenantLogo;
    if (!storage?.quarantineTenantBrandLogo || !setTenantLogo) {
      return sendError(
        reply,
        503,
        "BRAND_LOGO_UNAVAILABLE",
        "El almacenamiento del logo todavía no está disponible.",
        request.id,
      );
    }
    let mediaType = "";
    let fileBytes: Buffer | null = null;
    for await (const part of request.parts()) {
      if (part.type !== "file") continue;
      if (fileBytes)
        return sendError(
          reply,
          400,
          "TOO_MANY_BRAND_LOGOS",
          "Solo puedes cargar un logo.",
          request.id,
        );
      mediaType = part.mimetype;
      fileBytes = await part.toBuffer();
    }
    if (!fileBytes || !mediaType)
      return sendError(
        reply,
        400,
        "BRAND_LOGO_REQUIRED",
        "Selecciona una imagen para el logo.",
        request.id,
      );
    try {
      const stored = await storage.quarantineTenantBrandLogo({
        tenantId: params.data.tenantId,
        mediaType,
        bytes: fileBytes,
      });
      const result = await setTenantLogo(
        {
          userId: session.user.id,
          platformRole: session.user.platformRole,
          tenantRole: membership.role,
        },
        params.data.tenantId,
        stored.objectKey,
        request.id,
      );
      if (result.status !== "updated") {
        await storage.remove(stored.objectKey).catch(() => undefined);
        return sendError(
          reply,
          404,
          "TENANT_NOT_FOUND",
          "La empresa no está disponible.",
          request.id,
        );
      }
      return reply.send({ logoObjectKey: result.logoObjectKey });
    } catch (error) {
      if (
        error instanceof Error &&
        [
          "UNSUPPORTED_DOCUMENT_TYPE",
          "PROFILE_PHOTO_TYPE_INVALID",
          "DOCUMENT_CONTENT_INVALID",
          "DOCUMENT_SIZE_INVALID",
        ].includes(error.message)
      ) {
        return sendError(
          reply,
          400,
          "INVALID_BRAND_LOGO",
          "El logo debe ser una imagen JPG, PNG o WebP de máximo 10 MB.",
          request.id,
        );
      }
      throw error;
    }
  });

  app.patch("/v1/tenants/:tenantId/settings", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session) return;
    const params = tenantIdParamsSchema.safeParse(request.params);
    const body = tenantSettingsUpdateRequestSchema.safeParse(request.body);
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
      {
        ...body.data,
        contactEmail: body.data.contactEmail ? body.data.contactEmail.toLowerCase() : null,
        contactPhone: body.data.contactPhone || null,
        address: body.data.address || null,
        requestId: request.id,
      },
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
    const body = createBranchRequestSchema.safeParse(request.body);
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
    const body = createTeamRequestSchema.safeParse(request.body);
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

  app.patch("/v1/tenants/:tenantId/branches/:branchId/status", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session) return;
    const params = tenantBranchParamsSchema.safeParse(request.params);
    const body = organizationStatusUpdateRequestSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return sendError(
        reply,
        400,
        "INVALID_BRANCH_STATUS",
        "Revisa la sede y su estado.",
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
        "Solo propietarios y supervisores pueden administrar sedes.",
        request.id,
      );
    }
    if (!(await requireRecentReauthentication(session, request, reply))) return;
    const result = await dependencies.tenancyService.updateBranchStatus(
      {
        userId: session.user.id,
        platformRole: session.user.platformRole,
        tenantRole: membership.role,
      },
      params.data.tenantId,
      params.data.branchId,
      body.data.status,
      request.id,
    );
    if (result.status === "not_found") {
      return sendError(reply, 404, "BRANCH_NOT_FOUND", "La sede no existe.", request.id);
    }
    if (result.status === "has_active_teams") {
      return sendError(
        reply,
        409,
        "BRANCH_HAS_ACTIVE_TEAMS",
        "Desactiva primero los equipos activos vinculados a esta sede.",
        request.id,
      );
    }
    return reply.send({ status: result.branchStatus });
  });

  app.patch("/v1/tenants/:tenantId/teams/:teamId/status", async (request, reply) => {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session) return;
    const params = tenantTeamParamsSchema.safeParse(request.params);
    const body = organizationStatusUpdateRequestSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return sendError(
        reply,
        400,
        "INVALID_TEAM_STATUS",
        "Revisa el equipo y su estado.",
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
        "Solo propietarios y supervisores pueden administrar equipos.",
        request.id,
      );
    }
    if (!(await requireRecentReauthentication(session, request, reply))) return;
    const result = await dependencies.tenancyService.updateTeamStatus(
      {
        userId: session.user.id,
        platformRole: session.user.platformRole,
        tenantRole: membership.role,
      },
      params.data.tenantId,
      params.data.teamId,
      body.data.status,
      request.id,
    );
    if (result.status === "not_found") {
      return sendError(reply, 404, "TEAM_NOT_FOUND", "El equipo no existe.", request.id);
    }
    if (result.status === "branch_inactive") {
      return sendError(
        reply,
        409,
        "BRANCH_INACTIVE",
        "Activa primero la sede vinculada a este equipo.",
        request.id,
      );
    }
    return reply.send({ status: result.teamStatus });
  });

  async function manageTeamMember(
    request: FastifyRequest,
    reply: FastifyReply,
    operation: "add" | "remove",
  ) {
    if (!requireAllowedOrigin(request, reply)) return;
    const session = await requireUser(request, reply);
    if (!session) return;
    const params = tenantTeamMemberParamsSchema.safeParse(request.params);
    if (!params.success) {
      return sendError(
        reply,
        400,
        "INVALID_TEAM_MEMBER",
        "Revisa el equipo y el integrante.",
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
        "Solo propietarios y supervisores pueden administrar equipos.",
        request.id,
      );
    }
    if (!(await requireRecentReauthentication(session, request, reply))) return;
    const actor = {
      userId: session.user.id,
      platformRole: session.user.platformRole,
      tenantRole: membership.role,
    };
    const result =
      operation === "add"
        ? await dependencies.tenancyService.addTeamMember(
            actor,
            params.data.tenantId,
            params.data.teamId,
            params.data.userId,
            request.id,
          )
        : await dependencies.tenancyService.removeTeamMember(
            actor,
            params.data.tenantId,
            params.data.teamId,
            params.data.userId,
            request.id,
          );
    if (result.status === "team_not_found") {
      return sendError(reply, 404, "TEAM_NOT_FOUND", "El equipo no existe.", request.id);
    }
    if (result.status === "member_not_found") {
      return sendError(reply, 404, "MEMBER_NOT_FOUND", "El integrante no existe.", request.id);
    }
    if (result.status === "member_ineligible") {
      return sendError(
        reply,
        409,
        "MEMBER_INELIGIBLE",
        "Solo supervisores y cobradores activos pueden pertenecer a un equipo.",
        request.id,
      );
    }
    return reply
      .code(operation === "add" ? 200 : 204)
      .send(operation === "add" ? { assigned: true } : undefined);
  }

  app.put("/v1/tenants/:tenantId/teams/:teamId/members/:userId", (request, reply) =>
    manageTeamMember(request, reply, "add"),
  );

  app.delete("/v1/tenants/:tenantId/teams/:teamId/members/:userId", (request, reply) =>
    manageTeamMember(request, reply, "remove"),
  );

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
