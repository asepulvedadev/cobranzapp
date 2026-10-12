import { z } from "zod";
import {
  accountSessionSchema,
  accountSessionsResponseSchema,
  apiErrorSchema,
  authenticatedResponseSchema,
  changePasswordRequestSchema,
  createPlatformTenantRequestSchema,
  currentUserSchema,
  loginRequestSchema,
  messageResponseSchema,
  mfaCodeRequestSchema,
  mfaDisableResponseSchema,
  mfaEnableResponseSchema,
  mfaEnrollmentResponseSchema,
  mfaLoginRequiredResponseSchema,
  mfaStatusResponseSchema,
  mfaStatusSchema,
  platformActivityDirectorySchema,
  platformActivityQuerySchema,
  platformMembershipEntitlementUpdateRequestSchema,
  platformMembershipEntitlementUpdateResponseSchema,
  platformMembershipPlanUpdateRequestSchema,
  platformMembershipPlanUpdateResponseSchema,
  platformOverviewSchema,
  platformSupportAccessResponseSchema,
  platformSystemStatusSchema,
  platformTenantDirectoryQuerySchema,
  platformTenantDirectorySchema,
  platformTenantResponseSchema,
  platformTenantStatusUpdateRequestSchema,
  platformUserDirectoryQuerySchema,
  platformUserDirectorySchema,
  platformUserStatusUpdateRequestSchema,
  platformUserStatusUpdateResponseSchema,
  reauthenticationRequestSchema,
  reauthenticationResponseSchema,
  securityActivityResponseSchema,
  securityActivitySchema,
  serviceStatusSchema,
} from "./index.js";

type OpenApiSchema = Record<string, unknown>;

function toJsonSchema(schema: z.ZodType) {
  return z.toJSONSchema(schema) as OpenApiSchema;
}

function schemaReference(name: string) {
  return { $ref: `#/components/schemas/${name}` };
}

function jsonContent(schema: OpenApiSchema | { $ref: string }) {
  return { "application/json": { schema } };
}

function response(description: string, schema?: OpenApiSchema | { $ref: string }) {
  return schema ? { description, content: jsonContent(schema) } : { description };
}

const documentedSchemas = {
  AccountSession: accountSessionSchema,
  ApiError: apiErrorSchema,
  AuthenticatedResponse: authenticatedResponseSchema,
  ChangePasswordRequest: changePasswordRequestSchema,
  CreatePlatformTenantRequest: createPlatformTenantRequestSchema,
  CurrentUser: currentUserSchema,
  LoginRequest: loginRequestSchema,
  MfaCodeRequest: mfaCodeRequestSchema,
  MfaDisableResponse: mfaDisableResponseSchema,
  MfaEnableResponse: mfaEnableResponseSchema,
  MfaEnrollmentResponse: mfaEnrollmentResponseSchema,
  MfaLoginRequiredResponse: mfaLoginRequiredResponseSchema,
  MfaStatus: mfaStatusSchema,
  PlatformActivityDirectory: platformActivityDirectorySchema,
  PlatformActivityQuery: platformActivityQuerySchema,
  PlatformMembershipEntitlementUpdateRequest: platformMembershipEntitlementUpdateRequestSchema,
  PlatformMembershipEntitlementUpdateResponse: platformMembershipEntitlementUpdateResponseSchema,
  PlatformMembershipPlanUpdateRequest: platformMembershipPlanUpdateRequestSchema,
  PlatformMembershipPlanUpdateResponse: platformMembershipPlanUpdateResponseSchema,
  PlatformOverview: platformOverviewSchema,
  PlatformSupportAccessResponse: platformSupportAccessResponseSchema,
  PlatformSystemStatus: platformSystemStatusSchema,
  PlatformTenantDirectory: platformTenantDirectorySchema,
  PlatformTenantDirectoryQuery: platformTenantDirectoryQuerySchema,
  PlatformTenantResponse: platformTenantResponseSchema,
  PlatformTenantStatusUpdateRequest: platformTenantStatusUpdateRequestSchema,
  PlatformUserDirectory: platformUserDirectorySchema,
  PlatformUserDirectoryQuery: platformUserDirectoryQuerySchema,
  PlatformUserStatusUpdateRequest: platformUserStatusUpdateRequestSchema,
  PlatformUserStatusUpdateResponse: platformUserStatusUpdateResponseSchema,
  ReauthenticationRequest: reauthenticationRequestSchema,
  ReauthenticationResponse: reauthenticationResponseSchema,
  SecurityActivity: securityActivitySchema,
  ServiceStatus: serviceStatusSchema,
} as const;

export function createOpenApiDocument(version: string) {
  const errorResponses = {
    "400": response("Solicitud inválida.", schemaReference("ApiError")),
    "401": response("Autenticación requerida o inválida.", schemaReference("ApiError")),
    "403": response("Origen o alcance no permitido.", schemaReference("ApiError")),
    "429": response("Límite temporal de intentos alcanzado.", schemaReference("ApiError")),
  };
  const sessionSecurity = [{ cookieAuth: [] }];
  return {
    openapi: "3.1.0",
    info: {
      title: "cobranzapp API",
      version,
      description:
        "Contrato HTTP versionado de cobranzapp. Los endpoints administrativos y de negocio se incorporan por módulo.",
    },
    servers: [{ url: "/api", description: "Mismo origen de la aplicación web" }],
    tags: [
      { name: "Estado", description: "Salud y disponibilidad del servicio." },
      { name: "Autenticación", description: "Sesiones web, MFA y seguridad de la cuenta." },
      { name: "Plataforma", description: "Operaciones exclusivas del desarrollador." },
    ],
    paths: {
      "/health": {
        get: {
          tags: ["Estado"],
          operationId: "getHealth",
          responses: { "200": response("Servicio activo.", schemaReference("ServiceStatus")) },
        },
      },
      "/ready": {
        get: {
          tags: ["Estado"],
          operationId: "getReadiness",
          responses: {
            "200": response(
              "Servicio y base de datos disponibles.",
              schemaReference("ServiceStatus"),
            ),
            "503": response("Base de datos no disponible.", schemaReference("ServiceStatus")),
          },
        },
      },
      "/v1/status": {
        get: {
          tags: ["Estado"],
          operationId: "getApiStatus",
          responses: { "200": response("API disponible.", schemaReference("ServiceStatus")) },
        },
      },
      "/v1/auth/login": {
        post: {
          tags: ["Autenticación"],
          operationId: "login",
          requestBody: {
            required: true,
            content: jsonContent(schemaReference("LoginRequest")),
          },
          responses: {
            "200": response("Sesión iniciada.", schemaReference("AuthenticatedResponse")),
            "202": response(
              "Segundo factor requerido.",
              schemaReference("MfaLoginRequiredResponse"),
            ),
            ...errorResponses,
          },
        },
      },
      "/v1/auth/mfa/verify-login": {
        post: {
          tags: ["Autenticación"],
          operationId: "verifyMfaLogin",
          requestBody: { required: true, content: jsonContent(schemaReference("MfaCodeRequest")) },
          responses: {
            "200": response("Segundo factor verificado.", schemaReference("AuthenticatedResponse")),
            "410": response("El reto de verificación venció.", schemaReference("ApiError")),
            ...errorResponses,
          },
        },
      },
      "/v1/auth/me": {
        get: {
          tags: ["Autenticación"],
          operationId: "getCurrentUser",
          security: sessionSecurity,
          responses: {
            "200": response(
              "Identidad y membresías actuales.",
              schemaReference("AuthenticatedResponse"),
            ),
            "401": errorResponses["401"],
          },
        },
      },
      "/v1/auth/sessions": {
        get: {
          tags: ["Autenticación"],
          operationId: "listSessions",
          security: sessionSecurity,
          responses: {
            "200": response("Sesiones activas.", toJsonSchema(accountSessionsResponseSchema)),
            "401": errorResponses["401"],
          },
        },
      },
      "/v1/auth/security-activity": {
        get: {
          tags: ["Autenticación"],
          operationId: "listSecurityActivity",
          security: sessionSecurity,
          responses: {
            "200": response(
              "Actividad de seguridad.",
              toJsonSchema(securityActivityResponseSchema),
            ),
            "401": errorResponses["401"],
          },
        },
      },
      "/v1/auth/mfa": {
        get: {
          tags: ["Autenticación"],
          operationId: "getMfaStatus",
          security: sessionSecurity,
          responses: {
            "200": response("Estado de MFA.", toJsonSchema(mfaStatusResponseSchema)),
            "401": errorResponses["401"],
          },
        },
        delete: {
          tags: ["Autenticación"],
          operationId: "disableMfa",
          security: sessionSecurity,
          requestBody: { required: true, content: jsonContent(schemaReference("MfaCodeRequest")) },
          responses: {
            "200": response("MFA desactivado.", schemaReference("MfaDisableResponse")),
            ...errorResponses,
          },
        },
      },
      "/v1/auth/mfa/setup": {
        post: {
          tags: ["Autenticación"],
          operationId: "beginMfaEnrollment",
          security: sessionSecurity,
          responses: {
            "201": response(
              "Configuración temporal creada.",
              schemaReference("MfaEnrollmentResponse"),
            ),
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "428": response(
              "Confirmación reciente de contraseña requerida.",
              schemaReference("ApiError"),
            ),
          },
        },
      },
      "/v1/auth/mfa/enable": {
        post: {
          tags: ["Autenticación"],
          operationId: "enableMfa",
          security: sessionSecurity,
          requestBody: { required: true, content: jsonContent(schemaReference("MfaCodeRequest")) },
          responses: {
            "200": response("MFA activado.", schemaReference("MfaEnableResponse")),
            ...errorResponses,
            "428": response(
              "Confirmación reciente de contraseña requerida.",
              schemaReference("ApiError"),
            ),
          },
        },
      },
      "/v1/auth/reauthenticate": {
        post: {
          tags: ["Autenticación"],
          operationId: "reauthenticate",
          security: sessionSecurity,
          requestBody: {
            required: true,
            content: jsonContent(schemaReference("ReauthenticationRequest")),
          },
          responses: {
            "200": response("Contraseña confirmada.", schemaReference("ReauthenticationResponse")),
            ...errorResponses,
          },
        },
      },
      "/v1/auth/change-password": {
        post: {
          tags: ["Autenticación"],
          operationId: "changePassword",
          security: sessionSecurity,
          requestBody: {
            required: true,
            content: jsonContent(schemaReference("ChangePasswordRequest")),
          },
          responses: {
            "200": response("Contraseña actualizada.", toJsonSchema(messageResponseSchema)),
            ...errorResponses,
          },
        },
      },
      "/v1/auth/logout": {
        post: {
          tags: ["Autenticación"],
          operationId: "logout",
          security: sessionSecurity,
          responses: {
            "204": response("Sesión cerrada."),
            "403": errorResponses["403"],
          },
        },
      },
      "/v1/platform/overview": {
        get: {
          tags: ["Plataforma"],
          operationId: "getPlatformOverview",
          security: sessionSecurity,
          responses: {
            "200": response(
              "Resumen operativo de la plataforma.",
              schemaReference("PlatformOverview"),
            ),
            "401": errorResponses["401"],
            "403": errorResponses["403"],
          },
        },
      },
      "/v1/platform/system-status": {
        get: {
          tags: ["Plataforma"],
          operationId: "getPlatformSystemStatus",
          security: sessionSecurity,
          responses: {
            "200": response(
              "Estado de la API, la base de datos y los trabajos automáticos.",
              schemaReference("PlatformSystemStatus"),
            ),
            "401": errorResponses["401"],
            "403": errorResponses["403"],
          },
        },
      },
      "/v1/platform/tenants": {
        get: {
          tags: ["Plataforma"],
          operationId: "listPlatformTenants",
          security: sessionSecurity,
          parameters: [
            { name: "q", in: "query", schema: { type: "string", maxLength: 80 } },
            {
              name: "status",
              in: "query",
              schema: {
                type: "string",
                enum: ["draft", "active", "suspended", "archived"],
              },
            },
            {
              name: "page",
              in: "query",
              schema: { type: "integer", minimum: 1, default: 1 },
            },
            {
              name: "pageSize",
              in: "query",
              schema: { type: "integer", minimum: 1, maximum: 50, default: 20 },
            },
          ],
          responses: {
            "200": response(
              "Directorio paginado de empresas.",
              schemaReference("PlatformTenantDirectory"),
            ),
            "400": errorResponses["400"],
            "401": errorResponses["401"],
            "403": errorResponses["403"],
          },
        },
        post: {
          tags: ["Plataforma"],
          operationId: "createPlatformTenant",
          security: sessionSecurity,
          requestBody: {
            required: true,
            content: jsonContent(schemaReference("CreatePlatformTenantRequest")),
          },
          responses: {
            "201": response(
              "Empresa creada en estado borrador.",
              schemaReference("PlatformTenantResponse"),
            ),
            "400": errorResponses["400"],
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "428": response(
              "Confirmación reciente de contraseña requerida.",
              schemaReference("ApiError"),
            ),
          },
        },
      },
      "/v1/platform/users": {
        get: {
          tags: ["Plataforma"],
          operationId: "listPlatformUsers",
          security: sessionSecurity,
          parameters: [
            { name: "q", in: "query", schema: { type: "string", maxLength: 80 } },
            {
              name: "status",
              in: "query",
              schema: { type: "string", enum: ["active", "disabled"] },
            },
            {
              name: "page",
              in: "query",
              schema: { type: "integer", minimum: 1, default: 1 },
            },
            {
              name: "pageSize",
              in: "query",
              schema: { type: "integer", minimum: 1, maximum: 50, default: 20 },
            },
          ],
          responses: {
            "200": response(
              "Directorio paginado de identidades.",
              schemaReference("PlatformUserDirectory"),
            ),
            "400": errorResponses["400"],
            "401": errorResponses["401"],
            "403": errorResponses["403"],
          },
        },
      },
      "/v1/platform/users/{userId}/status": {
        patch: {
          tags: ["Plataforma"],
          operationId: "updatePlatformUserStatus",
          security: sessionSecurity,
          parameters: [
            {
              name: "userId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          requestBody: {
            required: true,
            content: jsonContent(schemaReference("PlatformUserStatusUpdateRequest")),
          },
          responses: {
            "200": response(
              "Estado actualizado y sesiones revocadas cuando corresponde.",
              schemaReference("PlatformUserStatusUpdateResponse"),
            ),
            "400": errorResponses["400"],
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "404": response("El usuario no existe.", schemaReference("ApiError")),
            "409": response("La identidad está protegida.", schemaReference("ApiError")),
            "428": response(
              "Confirmación reciente de contraseña requerida.",
              schemaReference("ApiError"),
            ),
          },
        },
      },
      "/v1/platform/tenants/{tenantId}/status": {
        patch: {
          tags: ["Plataforma"],
          operationId: "updatePlatformTenantStatus",
          security: sessionSecurity,
          parameters: [
            {
              name: "tenantId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          requestBody: {
            required: true,
            content: jsonContent(schemaReference("PlatformTenantStatusUpdateRequest")),
          },
          responses: {
            "200": response(
              "Estado empresarial actualizado.",
              schemaReference("PlatformTenantResponse"),
            ),
            "400": errorResponses["400"],
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "404": response("La empresa no existe.", schemaReference("ApiError")),
            "409": response(
              "La transición no está permitida o faltan requisitos de activación.",
              schemaReference("ApiError"),
            ),
            "428": response(
              "Confirmación reciente de contraseña requerida.",
              schemaReference("ApiError"),
            ),
          },
        },
      },
      "/v1/platform/tenants/{tenantId}/membership-plan": {
        patch: {
          tags: ["Plataforma"],
          operationId: "updatePlatformMembershipPlan",
          security: sessionSecurity,
          parameters: [
            {
              name: "tenantId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          requestBody: {
            required: true,
            content: jsonContent(schemaReference("PlatformMembershipPlanUpdateRequest")),
          },
          responses: {
            "200": response(
              "Plan y derechos comerciales actualizados.",
              schemaReference("PlatformMembershipPlanUpdateResponse"),
            ),
            "400": errorResponses["400"],
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "404": response("La empresa no existe.", schemaReference("ApiError")),
            "409": response(
              "El plan no admite los empleados activos actuales.",
              schemaReference("ApiError"),
            ),
            "428": response(
              "Confirmación reciente de contraseña requerida.",
              schemaReference("ApiError"),
            ),
          },
        },
      },
      "/v1/platform/tenants/{tenantId}/membership-entitlement": {
        patch: {
          tags: ["Plataforma"],
          operationId: "updatePlatformMembershipEntitlement",
          security: sessionSecurity,
          parameters: [
            {
              name: "tenantId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          requestBody: {
            required: true,
            content: jsonContent(schemaReference("PlatformMembershipEntitlementUpdateRequest")),
          },
          responses: {
            "200": response(
              "Capacidad adicional actualizada.",
              schemaReference("PlatformMembershipEntitlementUpdateResponse"),
            ),
            "400": errorResponses["400"],
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "404": response("La empresa no existe.", schemaReference("ApiError")),
            "409": response(
              "Falta un plan o la capacidad no admite los empleados activos.",
              schemaReference("ApiError"),
            ),
            "428": response(
              "Confirmación reciente de contraseña requerida.",
              schemaReference("ApiError"),
            ),
          },
        },
      },
      "/v1/platform/support-access": {
        get: {
          tags: ["Plataforma"],
          operationId: "listPlatformSupportAccess",
          security: sessionSecurity,
          responses: {
            "200": response(
              "Solicitudes y autorizaciones de soporte.",
              schemaReference("PlatformSupportAccessResponse"),
            ),
            "401": errorResponses["401"],
            "403": errorResponses["403"],
          },
        },
      },
      "/v1/platform/activity": {
        get: {
          tags: ["Plataforma"],
          operationId: "listPlatformActivity",
          security: sessionSecurity,
          parameters: [
            {
              name: "q",
              in: "query",
              schema: { type: "string", maxLength: 80 },
            },
            {
              name: "action",
              in: "query",
              schema: { type: "string", pattern: "^[a-z][a-z0-9_.]{2,80}$" },
            },
            {
              name: "page",
              in: "query",
              schema: { type: "integer", minimum: 1, default: 1 },
            },
            {
              name: "pageSize",
              in: "query",
              schema: { type: "integer", minimum: 1, maximum: 50, default: 20 },
            },
          ],
          responses: {
            "200": response(
              "Actividad administrativa paginada.",
              schemaReference("PlatformActivityDirectory"),
            ),
            "400": errorResponses["400"],
            "401": errorResponses["401"],
            "403": errorResponses["403"],
          },
        },
      },
    },
    components: {
      securitySchemes: {
        cookieAuth: { type: "apiKey", in: "cookie", name: "cobranzapp_session" },
      },
      schemas: Object.fromEntries(
        Object.entries(documentedSchemas).map(([name, schema]) => [name, toJsonSchema(schema)]),
      ),
    },
  } as const;
}
