import { z } from "zod";
import {
  accountSessionSchema,
  accountSessionsResponseSchema,
  apiErrorSchema,
  authenticatedResponseSchema,
  changePasswordRequestSchema,
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
  CurrentUser: currentUserSchema,
  LoginRequest: loginRequestSchema,
  MfaCodeRequest: mfaCodeRequestSchema,
  MfaDisableResponse: mfaDisableResponseSchema,
  MfaEnableResponse: mfaEnableResponseSchema,
  MfaEnrollmentResponse: mfaEnrollmentResponseSchema,
  MfaLoginRequiredResponse: mfaLoginRequiredResponseSchema,
  MfaStatus: mfaStatusSchema,
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
