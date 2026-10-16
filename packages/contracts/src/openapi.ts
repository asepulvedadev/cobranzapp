import { z } from "zod";
import {
  accountSessionSchema,
  accountSessionsResponseSchema,
  apiErrorSchema,
  authenticatedResponseSchema,
  borrowerAddressGeocodeRequestSchema,
  borrowerAddressLocationResponseSchema,
  borrowerAddressUpdateRequestSchema,
  borrowerCreateRequestSchema,
  borrowerDirectoryQuerySchema,
  borrowerDirectorySchema,
  borrowerDocumentResponseSchema,
  borrowerOcrConfirmRequestSchema,
  borrowerOcrConfirmResponseSchema,
  borrowerOcrResponseSchema,
  borrowerResponseSchema,
  borrowerReviewRequestSchema,
  borrowerReviewResponseSchema,
  changePasswordRequestSchema,
  companyCreationCodeResponseSchema,
  createBranchRequestSchema,
  createCompanyCreationCodeRequestSchema,
  createOwnerTenantRequestSchema,
  createPlatformOwnerRequestSchema,
  createPlatformTenantRequestSchema,
  createTeamRequestSchema,
  currentUserSchema,
  financialSchedulePreviewRequestSchema,
  financialSchedulePreviewResponseSchema,
  identityDocumentExtractionResponseSchema,
  loanAnalyticsResponseSchema,
  loanApplicationCreateRequestSchema,
  loanApplicationDirectorySchema,
  loanApplicationResponseSchema,
  loanProductCreateRequestSchema,
  loanProductDirectorySchema,
  loanProductResponseSchema,
  loanProductUpdateRequestSchema,
  loginRequestSchema,
  messageResponseSchema,
  mfaCodeRequestSchema,
  mfaDisableResponseSchema,
  mfaEnableResponseSchema,
  mfaEnrollmentResponseSchema,
  mfaLoginRequiredResponseSchema,
  mfaStatusResponseSchema,
  mfaStatusSchema,
  organizationStatusUpdateRequestSchema,
  ownerSubscriptionSummarySchema,
  ownerTenantResponseSchema,
  platformActivityDirectorySchema,
  platformActivityQuerySchema,
  platformMembershipEntitlementUpdateRequestSchema,
  platformMembershipEntitlementUpdateResponseSchema,
  platformMembershipPlanUpdateRequestSchema,
  platformMembershipPlanUpdateResponseSchema,
  platformOverviewSchema,
  platformOwnerCreatedResponseSchema,
  platformSupportAccessResponseSchema,
  platformSystemStatusSchema,
  platformTenantDirectoryQuerySchema,
  platformTenantDirectorySchema,
  platformTenantResponseSchema,
  platformTenantStatusUpdateRequestSchema,
  platformUserDirectoryQuerySchema,
  platformUserDirectorySchema,
  platformUserMembershipUpdateRequestSchema,
  platformUserMembershipUpdateResponseSchema,
  platformUserStatusUpdateRequestSchema,
  platformUserStatusUpdateResponseSchema,
  reauthenticationRequestSchema,
  reauthenticationResponseSchema,
  routeAssignmentUpdateRequestSchema,
  routeCreateRequestSchema,
  routeDirectorySchema,
  routeResponseSchema,
  routeStatusUpdateRequestSchema,
  routeStopCreateRequestSchema,
  routeStopOptimizeRequestSchema,
  routeStopReorderRequestSchema,
  routeStopVisitRequestSchema,
  securityActivityResponseSchema,
  securityActivitySchema,
  serviceStatusSchema,
  tenantBranchResponseSchema,
  tenantInvitationCreatedResponseSchema,
  tenantInvitationRequestSchema,
  tenantMemberProfileRequestSchema,
  tenantMemberProfileResponseSchema,
  tenantMemberResponseSchema,
  tenantMemberUpdateRequestSchema,
  tenantOverviewSchema,
  tenantSettingsResponseSchema,
  tenantSettingsUpdateRequestSchema,
  tenantTeamResponseSchema,
  userProfileResponseSchema,
  userProfileSchema,
  userProfileUpdateRequestSchema,
  verificationNetworkAssertionRequestSchema,
  verificationNetworkAssertionResponseSchema,
  verificationNetworkConsentRequestSchema,
  verificationNetworkConsentSchema,
  verificationNetworkCorrectionRequestSchema,
  verificationNetworkCorrectionResponseSchema,
  verificationNetworkQueryRequestSchema,
  verificationNetworkQueryResponseSchema,
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
  CreateBranchRequest: createBranchRequestSchema,
  CreateCompanyCreationCodeRequest: createCompanyCreationCodeRequestSchema,
  CreateOwnerTenantRequest: createOwnerTenantRequestSchema,
  CreatePlatformOwnerRequest: createPlatformOwnerRequestSchema,
  CreateTeamRequest: createTeamRequestSchema,
  CreatePlatformTenantRequest: createPlatformTenantRequestSchema,
  CurrentUser: currentUserSchema,
  LoginRequest: loginRequestSchema,
  LoanProductCreateRequest: loanProductCreateRequestSchema,
  LoanProductUpdateRequest: loanProductUpdateRequestSchema,
  LoanProductDirectory: loanProductDirectorySchema,
  LoanProductResponse: loanProductResponseSchema,
  FinancialSchedulePreviewRequest: financialSchedulePreviewRequestSchema,
  FinancialSchedulePreviewResponse: financialSchedulePreviewResponseSchema,
  LoanApplicationCreateRequest: loanApplicationCreateRequestSchema,
  LoanApplicationDirectory: loanApplicationDirectorySchema,
  LoanApplicationResponse: loanApplicationResponseSchema,
  LoanAnalyticsResponse: loanAnalyticsResponseSchema,
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
  PlatformOwnerCreatedResponse: platformOwnerCreatedResponseSchema,
  PlatformSupportAccessResponse: platformSupportAccessResponseSchema,
  PlatformSystemStatus: platformSystemStatusSchema,
  PlatformTenantDirectory: platformTenantDirectorySchema,
  PlatformTenantDirectoryQuery: platformTenantDirectoryQuerySchema,
  PlatformTenantResponse: platformTenantResponseSchema,
  PlatformTenantStatusUpdateRequest: platformTenantStatusUpdateRequestSchema,
  PlatformUserDirectory: platformUserDirectorySchema,
  PlatformUserDirectoryQuery: platformUserDirectoryQuerySchema,
  PlatformUserMembershipUpdateRequest: platformUserMembershipUpdateRequestSchema,
  PlatformUserMembershipUpdateResponse: platformUserMembershipUpdateResponseSchema,
  PlatformUserStatusUpdateRequest: platformUserStatusUpdateRequestSchema,
  PlatformUserStatusUpdateResponse: platformUserStatusUpdateResponseSchema,
  TenantOverview: tenantOverviewSchema,
  CompanyCreationCodeResponse: companyCreationCodeResponseSchema,
  OwnerTenantResponse: ownerTenantResponseSchema,
  OwnerSubscriptionSummary: ownerSubscriptionSummarySchema,
  TenantBranchResponse: tenantBranchResponseSchema,
  TenantInvitationCreatedResponse: tenantInvitationCreatedResponseSchema,
  TenantInvitationRequest: tenantInvitationRequestSchema,
  TenantMemberResponse: tenantMemberResponseSchema,
  TenantMemberProfileRequest: tenantMemberProfileRequestSchema,
  TenantMemberProfileResponse: tenantMemberProfileResponseSchema,
  BorrowerCreateRequest: borrowerCreateRequestSchema,
  BorrowerAddressGeocodeRequest: borrowerAddressGeocodeRequestSchema,
  BorrowerAddressLocationResponse: borrowerAddressLocationResponseSchema,
  BorrowerAddressUpdateRequest: borrowerAddressUpdateRequestSchema,
  BorrowerDirectory: borrowerDirectorySchema,
  BorrowerDirectoryQuery: borrowerDirectoryQuerySchema,
  BorrowerDocumentResponse: borrowerDocumentResponseSchema,
  IdentityDocumentExtractionResponse: identityDocumentExtractionResponseSchema,
  BorrowerOcrConfirmRequest: borrowerOcrConfirmRequestSchema,
  BorrowerOcrConfirmResponse: borrowerOcrConfirmResponseSchema,
  BorrowerOcrResponse: borrowerOcrResponseSchema,
  BorrowerResponse: borrowerResponseSchema,
  BorrowerReviewRequest: borrowerReviewRequestSchema,
  BorrowerReviewResponse: borrowerReviewResponseSchema,
  TenantMemberUpdateRequest: tenantMemberUpdateRequestSchema,
  TenantSettingsResponse: tenantSettingsResponseSchema,
  TenantSettingsUpdateRequest: tenantSettingsUpdateRequestSchema,
  TenantTeamResponse: tenantTeamResponseSchema,
  UserProfile: userProfileSchema,
  UserProfileResponse: userProfileResponseSchema,
  UserProfileUpdateRequest: userProfileUpdateRequestSchema,
  VerificationNetworkAssertionRequest: verificationNetworkAssertionRequestSchema,
  VerificationNetworkAssertionResponse: verificationNetworkAssertionResponseSchema,
  VerificationNetworkConsentRequest: verificationNetworkConsentRequestSchema,
  VerificationNetworkConsent: verificationNetworkConsentSchema,
  VerificationNetworkCorrectionRequest: verificationNetworkCorrectionRequestSchema,
  VerificationNetworkCorrectionResponse: verificationNetworkCorrectionResponseSchema,
  VerificationNetworkQueryRequest: verificationNetworkQueryRequestSchema,
  VerificationNetworkQueryResponse: verificationNetworkQueryResponseSchema,
  OrganizationStatusUpdateRequest: organizationStatusUpdateRequestSchema,
  ReauthenticationRequest: reauthenticationRequestSchema,
  ReauthenticationResponse: reauthenticationResponseSchema,
  RouteCreateRequest: routeCreateRequestSchema,
  RouteAssignmentUpdateRequest: routeAssignmentUpdateRequestSchema,
  RouteDirectory: routeDirectorySchema,
  RouteResponse: routeResponseSchema,
  RouteStatusUpdateRequest: routeStatusUpdateRequestSchema,
  RouteStopCreateRequest: routeStopCreateRequestSchema,
  RouteStopOptimizeRequest: routeStopOptimizeRequestSchema,
  RouteStopReorderRequest: routeStopReorderRequestSchema,
  RouteStopVisitRequest: routeStopVisitRequestSchema,
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
      { name: "Empresas", description: "Lecturas autenticadas del espacio empresarial." },
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
      "/v1/account/tenants": {
        post: {
          tags: ["Cuenta"],
          operationId: "createOwnerTenant",
          security: sessionSecurity,
          requestBody: {
            required: true,
            content: jsonContent(schemaReference("CreateOwnerTenantRequest")),
          },
          responses: {
            "201": response(
              "Empresa creada y vinculada al propietario.",
              schemaReference("OwnerTenantResponse"),
            ),
            "400": errorResponses["400"],
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "409": response("El nombre de empresa ya está en uso.", schemaReference("ApiError")),
          },
        },
      },
      "/v1/account/subscriptions": {
        get: {
          tags: ["Cuenta"],
          operationId: "listOwnerSubscriptions",
          security: sessionSecurity,
          responses: {
            "200": response(
              "Suscripciones disponibles para crear empresas.",
              schemaReference("OwnerSubscriptionSummary"),
            ),
            "401": errorResponses["401"],
            "403": errorResponses["403"],
          },
        },
      },
      "/v1/account/profile": {
        get: {
          tags: ["Cuenta"],
          operationId: "getAccountProfile",
          security: sessionSecurity,
          responses: {
            "200": response("Perfil personal.", schemaReference("UserProfileResponse")),
            "401": errorResponses["401"],
          },
        },
        put: {
          tags: ["Cuenta"],
          operationId: "updateAccountProfile",
          security: sessionSecurity,
          requestBody: {
            required: true,
            content: jsonContent(schemaReference("UserProfileUpdateRequest")),
          },
          responses: {
            "200": response("Perfil actualizado.", schemaReference("UserProfileResponse")),
            "400": errorResponses["400"],
            "401": errorResponses["401"],
            "428": response("Reautenticación requerida.", schemaReference("ApiError")),
          },
        },
      },
      "/v1/account/profile-photo": {
        get: {
          tags: ["Cuenta"],
          operationId: "getAccountProfilePhoto",
          security: sessionSecurity,
          responses: {
            "200": { description: "Foto de perfil." },
            "404": response("No hay foto de perfil.", schemaReference("ApiError")),
          },
        },
        post: {
          tags: ["Cuenta"],
          operationId: "uploadAccountProfilePhoto",
          security: sessionSecurity,
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  properties: { file: { type: "string", format: "binary" } },
                  required: ["file"],
                },
              },
            },
          },
          responses: {
            "200": response("Foto de perfil actualizada.", schemaReference("UserProfileResponse")),
            "400": errorResponses["400"],
            "401": errorResponses["401"],
            "428": response("Reautenticación requerida.", schemaReference("ApiError")),
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
      "/v1/tenants/{tenantId}/overview": {
        get: {
          tags: ["Empresas"],
          operationId: "getTenantOverview",
          security: sessionSecurity,
          parameters: [
            {
              name: "tenantId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": response(
              "Espacio empresarial visible para el rol actual.",
              schemaReference("TenantOverview"),
            ),
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "404": response("La empresa no está disponible.", schemaReference("ApiError")),
          },
        },
      },
      "/v1/tenants/{tenantId}/invitations": {
        post: {
          tags: ["Empresas"],
          operationId: "createTenantInvitation",
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
            content: jsonContent(schemaReference("TenantInvitationRequest")),
          },
          responses: {
            "201": response(
              "Invitación empresarial creada.",
              schemaReference("TenantInvitationCreatedResponse"),
            ),
            "400": errorResponses["400"],
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "404": response("La empresa no existe.", schemaReference("ApiError")),
            "428": response(
              "Confirmación reciente de contraseña requerida.",
              schemaReference("ApiError"),
            ),
          },
        },
      },
      "/v1/tenants/{tenantId}/invitations/{invitationId}": {
        delete: {
          tags: ["Empresas"],
          operationId: "revokeTenantInvitation",
          security: sessionSecurity,
          parameters: [
            {
              name: "tenantId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "invitationId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "204": response("Invitación revocada."),
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "404": response(
              "La invitación no existe o ya no está pendiente.",
              schemaReference("ApiError"),
            ),
            "409": response(
              "La invitación está protegida y requiere administración de plataforma.",
              schemaReference("ApiError"),
            ),
            "428": response(
              "Confirmación reciente de contraseña requerida.",
              schemaReference("ApiError"),
            ),
          },
        },
      },
      "/v1/tenants/{tenantId}/members/{userId}": {
        patch: {
          tags: ["Empresas"],
          operationId: "updateTenantMember",
          security: sessionSecurity,
          parameters: [
            {
              name: "tenantId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "userId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          requestBody: {
            required: true,
            content: jsonContent(schemaReference("TenantMemberUpdateRequest")),
          },
          responses: {
            "200": response(
              "Acceso del integrante actualizado.",
              schemaReference("TenantMemberResponse"),
            ),
            "400": errorResponses["400"],
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "404": response("El integrante no existe.", schemaReference("ApiError")),
            "409": response(
              "El acceso está protegido, revocado o no hay cupos disponibles.",
              schemaReference("ApiError"),
            ),
            "428": response(
              "Confirmación reciente de contraseña requerida.",
              schemaReference("ApiError"),
            ),
          },
        },
      },
      "/v1/tenants/{tenantId}/members/{userId}/profile": {
        get: {
          tags: ["Empresas"],
          operationId: "getTenantMemberProfile",
          security: sessionSecurity,
          parameters: [
            {
              name: "tenantId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "userId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": response(
              "Ficha operativa del integrante.",
              schemaReference("TenantMemberProfileResponse"),
            ),
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "404": response("El integrante no existe.", schemaReference("ApiError")),
          },
        },
        put: {
          tags: ["Empresas"],
          operationId: "updateTenantMemberProfile",
          security: sessionSecurity,
          parameters: [
            {
              name: "tenantId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "userId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          requestBody: {
            required: true,
            content: jsonContent(schemaReference("TenantMemberProfileRequest")),
          },
          responses: {
            "200": response(
              "Ficha operativa actualizada.",
              schemaReference("TenantMemberProfileResponse"),
            ),
            "400": errorResponses["400"],
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "404": response("El integrante no existe.", schemaReference("ApiError")),
            "428": response(
              "Confirmación reciente de contraseña requerida.",
              schemaReference("ApiError"),
            ),
          },
        },
      },
      "/v1/tenants/{tenantId}/members/{userId}/profile-photo": {
        post: {
          tags: ["Empresas"],
          operationId: "uploadTenantMemberProfilePhoto",
          security: sessionSecurity,
          parameters: [
            {
              name: "tenantId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "userId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  required: ["file"],
                  properties: { file: { type: "string", format: "binary" } },
                },
              },
            },
          },
          responses: {
            "200": response(
              "Foto de perfil privada actualizada.",
              schemaReference("TenantMemberProfileResponse"),
            ),
            "400": errorResponses["400"],
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "404": response("El integrante no existe.", schemaReference("ApiError")),
            "413": response("La foto supera el límite permitido.", schemaReference("ApiError")),
            "428": response(
              "Confirmación reciente de contraseña requerida.",
              schemaReference("ApiError"),
            ),
            "503": response("La carga privada no está habilitada.", schemaReference("ApiError")),
          },
        },
      },
      "/v1/tenants/{tenantId}/settings": {
        patch: {
          tags: ["Empresas"],
          operationId: "updateTenantSettings",
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
            content: jsonContent(schemaReference("TenantSettingsUpdateRequest")),
          },
          responses: {
            "200": response(
              "Configuración empresarial actualizada.",
              schemaReference("TenantSettingsResponse"),
            ),
            "400": errorResponses["400"],
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "404": response("La empresa no está disponible.", schemaReference("ApiError")),
            "409": response(
              "La configuración cambió en otra sesión y debe actualizarse.",
              schemaReference("ApiError"),
            ),
          },
        },
      },
      "/v1/tenants/{tenantId}/routes": {
        get: {
          tags: ["Empresas"],
          operationId: "listCollectionRoutes",
          security: sessionSecurity,
          parameters: [
            {
              name: "tenantId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": response("Rutas de cobranza de la empresa.", schemaReference("RouteDirectory")),
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "428": response("Confirmación reciente requerida.", schemaReference("ApiError")),
          },
        },
        post: {
          tags: ["Empresas"],
          operationId: "createCollectionRoute",
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
            content: jsonContent(schemaReference("RouteCreateRequest")),
          },
          responses: {
            "201": response("Ruta creada como borrador.", schemaReference("RouteResponse")),
            "400": errorResponses["400"],
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "409": response("El nombre de la ruta ya existe.", schemaReference("ApiError")),
            "428": response("Confirmación reciente requerida.", schemaReference("ApiError")),
          },
        },
      },
      "/v1/tenants/{tenantId}/routes/{routeId}/stops": {
        post: {
          tags: ["Empresas"],
          operationId: "addCollectionRouteStop",
          security: sessionSecurity,
          parameters: [
            {
              name: "tenantId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "routeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          requestBody: {
            required: true,
            content: jsonContent(schemaReference("RouteStopCreateRequest")),
          },
          responses: {
            "200": response("Parada agregada a la ruta.", schemaReference("RouteResponse")),
            "400": errorResponses["400"],
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "404": response("La ruta o el cliente no existe.", schemaReference("ApiError")),
            "409": response("El cliente ya está en la ruta.", schemaReference("ApiError")),
            "428": response("Confirmación reciente requerida.", schemaReference("ApiError")),
          },
        },
      },
      "/v1/tenants/{tenantId}/routes/{routeId}/stops/order": {
        patch: {
          tags: ["Empresas"],
          operationId: "reorderCollectionRouteStops",
          security: sessionSecurity,
          parameters: [
            {
              name: "tenantId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "routeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          requestBody: {
            required: true,
            content: jsonContent(schemaReference("RouteStopReorderRequest")),
          },
          responses: {
            "200": response("Orden de paradas actualizado.", schemaReference("RouteResponse")),
            "400": errorResponses["400"],
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "404": response("La ruta no existe.", schemaReference("ApiError")),
            "409": response("El orden de paradas no es válido.", schemaReference("ApiError")),
            "428": response("Confirmación reciente requerida.", schemaReference("ApiError")),
          },
        },
      },
      "/v1/tenants/{tenantId}/routes/{routeId}/stops/optimize": {
        post: {
          tags: ["Empresas"],
          operationId: "optimizeCollectionRouteStops",
          security: sessionSecurity,
          parameters: [
            {
              name: "tenantId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "routeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          requestBody: {
            required: false,
            content: jsonContent(schemaReference("RouteStopOptimizeRequest")),
          },
          responses: {
            "200": response("Orden optimizado por cercanía.", schemaReference("RouteResponse")),
            "400": errorResponses["400"],
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "404": response("La ruta no existe.", schemaReference("ApiError")),
            "409": response("Faltan coordenadas para alguna parada.", schemaReference("ApiError")),
            "428": response("Confirmación reciente requerida.", schemaReference("ApiError")),
          },
        },
      },
      "/v1/tenants/{tenantId}/routes/{routeId}/stops/{stopId}/visit": {
        patch: {
          tags: ["Empresas"],
          operationId: "updateCollectionRouteStopVisit",
          security: sessionSecurity,
          parameters: [
            {
              name: "tenantId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "routeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "stopId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          requestBody: {
            required: true,
            content: jsonContent(schemaReference("RouteStopVisitRequest")),
          },
          responses: {
            "200": response("Estado de visita actualizado.", schemaReference("RouteResponse")),
            "400": errorResponses["400"],
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "404": response("La parada no existe.", schemaReference("ApiError")),
            "428": response("Confirmación reciente requerida.", schemaReference("ApiError")),
          },
        },
      },
      "/v1/tenants/{tenantId}/routes/{routeId}": {
        patch: {
          tags: ["Empresas"],
          operationId: "updateCollectionRouteStatus",
          security: sessionSecurity,
          parameters: [
            {
              name: "tenantId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "routeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          requestBody: {
            required: true,
            content: jsonContent(schemaReference("RouteStatusUpdateRequest")),
          },
          responses: {
            "200": response("Estado de la ruta actualizado.", schemaReference("RouteResponse")),
            "400": errorResponses["400"],
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "404": response("La ruta no existe.", schemaReference("ApiError")),
            "409": response("La ruta no puede cambiar a ese estado.", schemaReference("ApiError")),
            "428": response("Confirmación reciente requerida.", schemaReference("ApiError")),
          },
        },
      },
      "/v1/tenants/{tenantId}/routes/{routeId}/assignment": {
        patch: {
          tags: ["Empresas"],
          operationId: "assignCollectionRoute",
          security: sessionSecurity,
          parameters: [
            {
              name: "tenantId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "routeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          requestBody: {
            required: true,
            content: jsonContent(schemaReference("RouteAssignmentUpdateRequest")),
          },
          responses: {
            "200": response("Cobrador asignado a la ruta.", schemaReference("RouteResponse")),
            "400": errorResponses["400"],
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "404": response("La ruta o el cobrador no existe.", schemaReference("ApiError")),
            "409": response(
              "El cobrador no está activo en esta empresa.",
              schemaReference("ApiError"),
            ),
            "428": response("Confirmación reciente requerida.", schemaReference("ApiError")),
          },
        },
      },
      "/v1/tenants/{tenantId}/loan-products": {
        get: {
          tags: ["Crédito"],
          operationId: "listLoanProducts",
          security: sessionSecurity,
          parameters: [
            {
              name: "tenantId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": response(
              "Productos de crédito del tenant.",
              schemaReference("LoanProductDirectory"),
            ),
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "428": response("Confirmación reciente requerida.", schemaReference("ApiError")),
            "503": response("El catálogo no está habilitado.", schemaReference("ApiError")),
          },
        },
        post: {
          tags: ["Crédito"],
          operationId: "createLoanProductDraft",
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
            content: jsonContent(schemaReference("LoanProductCreateRequest")),
          },
          responses: {
            "201": response(
              "Producto creado como borrador.",
              schemaReference("LoanProductResponse"),
            ),
            "400": errorResponses["400"],
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "409": response("Ya existe un producto con ese nombre.", schemaReference("ApiError")),
            "428": response("Confirmación reciente requerida.", schemaReference("ApiError")),
            "503": response("El catálogo no está habilitado.", schemaReference("ApiError")),
          },
        },
      },
      "/v1/tenants/{tenantId}/loan-products/{productId}/review": {
        post: {
          tags: ["Crédito"],
          operationId: "submitLoanProductForReview",
          security: sessionSecurity,
          parameters: [
            {
              name: "tenantId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "productId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": response("Producto enviado a revisión.", schemaReference("LoanProductResponse")),
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "404": response("El producto no existe.", schemaReference("ApiError")),
            "409": response(
              "El producto no puede enviarse a revisión.",
              schemaReference("ApiError"),
            ),
            "428": response("Confirmación reciente requerida.", schemaReference("ApiError")),
            "503": response("El catálogo no está habilitado.", schemaReference("ApiError")),
          },
        },
      },
      "/v1/tenants/{tenantId}/loan-products/{productId}": {
        patch: {
          tags: ["Crédito"],
          operationId: "updateLoanProductDraft",
          security: sessionSecurity,
          parameters: [
            {
              name: "tenantId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "productId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          requestBody: {
            required: true,
            content: jsonContent(schemaReference("LoanProductUpdateRequest")),
          },
          responses: {
            "200": response("Borrador actualizado.", schemaReference("LoanProductResponse")),
            "400": errorResponses["400"],
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "404": response("El producto no existe.", schemaReference("ApiError")),
            "409": response("El borrador no puede modificarse.", schemaReference("ApiError")),
            "428": response("Confirmación reciente requerida.", schemaReference("ApiError")),
            "503": response("El catálogo no está habilitado.", schemaReference("ApiError")),
          },
        },
      },
      "/v1/tenants/{tenantId}/loan-products/{productId}/schedule-preview": {
        post: {
          tags: ["Crédito"],
          operationId: "previewLoanProductSchedule",
          security: sessionSecurity,
          parameters: [
            {
              name: "tenantId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "productId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          requestBody: {
            required: true,
            content: jsonContent(schemaReference("FinancialSchedulePreviewRequest")),
          },
          responses: {
            "200": response(
              "Proyección no vinculante de cuotas.",
              schemaReference("FinancialSchedulePreviewResponse"),
            ),
            "400": errorResponses["400"],
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "404": response("El producto no existe.", schemaReference("ApiError")),
            "409": response(
              "Los parámetros no son compatibles con el producto.",
              schemaReference("ApiError"),
            ),
            "503": response("El catálogo no está habilitado.", schemaReference("ApiError")),
          },
        },
      },
      "/v1/tenants/{tenantId}/credit-analytics": {
        get: {
          tags: ["Crédito"],
          operationId: "getCreditAnalytics",
          security: sessionSecurity,
          parameters: [
            {
              name: "tenantId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "from",
              in: "query",
              required: true,
              schema: { type: "string", format: "date" },
            },
            { name: "to", in: "query", required: true, schema: { type: "string", format: "date" } },
            {
              name: "preset",
              in: "query",
              required: false,
              schema: { type: "string", enum: ["day", "week", "month", "custom"] },
            },
          ],
          responses: {
            "200": response(
              "Indicadores financieros exclusivos del propietario.",
              schemaReference("LoanAnalyticsResponse"),
            ),
            "400": errorResponses["400"],
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "503": response("El módulo no está habilitado.", schemaReference("ApiError")),
          },
        },
      },
      "/v1/tenants/{tenantId}/loan-applications": {
        get: {
          tags: ["Crédito"],
          operationId: "listLoanApplications",
          security: sessionSecurity,
          parameters: [
            {
              name: "tenantId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": response(
              "Solicitudes de crédito del tenant.",
              schemaReference("LoanApplicationDirectory"),
            ),
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "503": response("El módulo no está habilitado.", schemaReference("ApiError")),
          },
        },
        post: {
          tags: ["Crédito"],
          operationId: "createLoanApplication",
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
            content: jsonContent(schemaReference("LoanApplicationCreateRequest")),
          },
          responses: {
            "201": response(
              "Crédito activo para propietario/supervisor o solicitud pendiente para cobrador.",
              schemaReference("LoanApplicationResponse"),
            ),
            "400": errorResponses["400"],
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "404": response("El cliente o producto no existe.", schemaReference("ApiError")),
            "409": response("El producto no admite esta solicitud.", schemaReference("ApiError")),
            "428": response("Confirmación reciente requerida.", schemaReference("ApiError")),
            "503": response("El módulo no está habilitado.", schemaReference("ApiError")),
          },
        },
      },
      "/v1/tenants/{tenantId}/loan-applications/{applicationId}/submit": {
        post: {
          tags: ["Crédito"],
          operationId: "submitLoanApplicationForReview",
          security: sessionSecurity,
          parameters: [
            {
              name: "tenantId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "applicationId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": response(
              "Solicitud enviada a revisión.",
              schemaReference("LoanApplicationResponse"),
            ),
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "404": response("La solicitud no existe.", schemaReference("ApiError")),
            "409": response(
              "La solicitud no puede enviarse a revisión.",
              schemaReference("ApiError"),
            ),
            "428": response("Confirmación reciente requerida.", schemaReference("ApiError")),
            "503": response("El módulo no está habilitado.", schemaReference("ApiError")),
          },
        },
      },
      "/v1/tenants/{tenantId}/loan-applications/{applicationId}/review": {
        post: {
          tags: ["Crédito"],
          operationId: "startLoanApplicationReview",
          security: sessionSecurity,
          parameters: [
            {
              name: "tenantId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "applicationId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": response(
              "Solicitud puesta en revisión.",
              schemaReference("LoanApplicationResponse"),
            ),
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "404": response("La solicitud no existe.", schemaReference("ApiError")),
            "409": response(
              "La solicitud no puede entrar en revisión.",
              schemaReference("ApiError"),
            ),
            "428": response("Confirmación reciente requerida.", schemaReference("ApiError")),
            "503": response("El módulo no está habilitado.", schemaReference("ApiError")),
          },
        },
      },
      "/v1/tenants/{tenantId}/loan-applications/{applicationId}/approve": {
        post: {
          tags: ["Crédito"],
          operationId: "approveLoanApplication",
          security: sessionSecurity,
          parameters: [
            {
              name: "tenantId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "applicationId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": response(
              "Solicitud aprobada y crédito activado.",
              schemaReference("LoanApplicationResponse"),
            ),
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "404": response("La solicitud no existe.", schemaReference("ApiError")),
            "409": response("La solicitud no está pendiente.", schemaReference("ApiError")),
            "428": response("Confirmación reciente requerida.", schemaReference("ApiError")),
            "503": response("El módulo no está habilitado.", schemaReference("ApiError")),
          },
        },
      },
      "/v1/tenants/{tenantId}/branches": {
        post: {
          tags: ["Empresas"],
          operationId: "createTenantBranch",
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
            content: jsonContent(schemaReference("CreateBranchRequest")),
          },
          responses: {
            "201": response("Sede creada.", schemaReference("TenantBranchResponse")),
            "400": errorResponses["400"],
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "404": response("La empresa no está disponible.", schemaReference("ApiError")),
          },
        },
      },
      "/v1/tenants/{tenantId}/teams": {
        post: {
          tags: ["Empresas"],
          operationId: "createTenantTeam",
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
            content: jsonContent(schemaReference("CreateTeamRequest")),
          },
          responses: {
            "201": response("Equipo creado.", schemaReference("TenantTeamResponse")),
            "400": errorResponses["400"],
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "404": response(
              "La empresa o la sede no está disponible.",
              schemaReference("ApiError"),
            ),
          },
        },
      },
      "/v1/tenants/{tenantId}/branches/{branchId}/status": {
        patch: {
          tags: ["Empresas"],
          operationId: "updateTenantBranchStatus",
          security: sessionSecurity,
          parameters: [
            {
              name: "tenantId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "branchId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          requestBody: {
            required: true,
            content: jsonContent(schemaReference("OrganizationStatusUpdateRequest")),
          },
          responses: {
            "200": response("Estado de la sede actualizado.", {
              type: "object",
              properties: { status: { type: "string", enum: ["active", "inactive"] } },
              required: ["status"],
            }),
            "400": errorResponses["400"],
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "404": response("La sede no existe.", schemaReference("ApiError")),
            "409": response(
              "La sede tiene equipos activos vinculados.",
              schemaReference("ApiError"),
            ),
            "428": response(
              "Confirmación reciente de contraseña requerida.",
              schemaReference("ApiError"),
            ),
          },
        },
      },
      "/v1/tenants/{tenantId}/teams/{teamId}/status": {
        patch: {
          tags: ["Empresas"],
          operationId: "updateTenantTeamStatus",
          security: sessionSecurity,
          parameters: [
            {
              name: "tenantId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "teamId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          requestBody: {
            required: true,
            content: jsonContent(schemaReference("OrganizationStatusUpdateRequest")),
          },
          responses: {
            "200": response("Estado del equipo actualizado.", {
              type: "object",
              properties: { status: { type: "string", enum: ["active", "inactive"] } },
              required: ["status"],
            }),
            "400": errorResponses["400"],
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "404": response("El equipo no existe.", schemaReference("ApiError")),
            "409": response("La sede vinculada está inactiva.", schemaReference("ApiError")),
            "428": response(
              "Confirmación reciente de contraseña requerida.",
              schemaReference("ApiError"),
            ),
          },
        },
      },
      "/v1/tenants/{tenantId}/teams/{teamId}/members/{userId}": {
        put: {
          tags: ["Empresas"],
          operationId: "addTenantTeamMember",
          security: sessionSecurity,
          parameters: [
            {
              name: "tenantId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "teamId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "userId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": response("Integrante agregado al equipo.", {
              type: "object",
              properties: { assigned: { type: "boolean", const: true } },
              required: ["assigned"],
            }),
            "400": errorResponses["400"],
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "404": response("El equipo o integrante no existe.", schemaReference("ApiError")),
            "409": response(
              "El integrante no puede pertenecer al equipo.",
              schemaReference("ApiError"),
            ),
            "428": response(
              "Confirmación reciente de contraseña requerida.",
              schemaReference("ApiError"),
            ),
          },
        },
        delete: {
          tags: ["Empresas"],
          operationId: "removeTenantTeamMember",
          security: sessionSecurity,
          parameters: [
            {
              name: "tenantId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "teamId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "userId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "204": response("Integrante retirado del equipo."),
            "400": errorResponses["400"],
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "404": response("El equipo o integrante no existe.", schemaReference("ApiError")),
            "409": response(
              "El integrante no puede pertenecer al equipo.",
              schemaReference("ApiError"),
            ),
            "428": response(
              "Confirmación reciente de contraseña requerida.",
              schemaReference("ApiError"),
            ),
          },
        },
      },
      "/v1/tenants/{tenantId}/borrowers": {
        get: {
          tags: ["Clientes"],
          operationId: "listBorrowers",
          security: sessionSecurity,
          parameters: [
            {
              name: "tenantId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            { name: "q", in: "query", schema: { type: "string", maxLength: 80 } },
            { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
            {
              name: "pageSize",
              in: "query",
              schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
            },
          ],
          responses: {
            "200": response("Directorio de clientes.", schemaReference("BorrowerDirectory")),
            "400": errorResponses["400"],
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "503": response("El módulo no está habilitado.", schemaReference("ApiError")),
          },
        },
        post: {
          tags: ["Clientes"],
          operationId: "createBorrower",
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
            content: jsonContent(schemaReference("BorrowerCreateRequest")),
          },
          responses: {
            "201": response(
              "Cliente creado en el espacio empresarial.",
              schemaReference("BorrowerResponse"),
            ),
            "400": errorResponses["400"],
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "409": response("Ya existe ese documento en la empresa.", schemaReference("ApiError")),
            "503": response("El módulo no está habilitado.", schemaReference("ApiError")),
          },
        },
      },
      "/v1/tenants/{tenantId}/borrowers/{borrowerId}": {
        get: {
          tags: ["Clientes"],
          operationId: "getBorrower",
          security: sessionSecurity,
          parameters: [
            {
              name: "tenantId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "borrowerId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": response("Ficha del cliente.", schemaReference("BorrowerResponse")),
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "404": response("El cliente no existe.", schemaReference("ApiError")),
            "503": response("El módulo no está habilitado.", schemaReference("ApiError")),
          },
        },
      },
      "/v1/tenants/{tenantId}/borrowers/{borrowerId}/addresses": {
        patch: {
          tags: ["Clientes"],
          operationId: "updateBorrowerAddresses",
          security: sessionSecurity,
          parameters: [
            {
              name: "tenantId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "borrowerId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          requestBody: {
            required: true,
            content: jsonContent(schemaReference("BorrowerAddressUpdateRequest")),
          },
          responses: {
            "200": response(
              "Direcciones actualizadas y pendientes de ubicar nuevamente.",
              schemaReference("BorrowerResponse"),
            ),
            "400": errorResponses["400"],
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "404": response("El cliente no existe.", schemaReference("ApiError")),
            "428": response("Confirmación reciente requerida.", schemaReference("ApiError")),
            "503": response("El módulo no está habilitado.", schemaReference("ApiError")),
          },
        },
      },
      "/v1/tenants/{tenantId}/borrowers/{borrowerId}/geocode": {
        post: {
          tags: ["Clientes"],
          operationId: "geocodeBorrowerAddress",
          security: sessionSecurity,
          parameters: [
            {
              name: "tenantId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "borrowerId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          requestBody: {
            required: true,
            content: jsonContent(schemaReference("BorrowerAddressGeocodeRequest")),
          },
          responses: {
            "200": response("Dirección ubicada y guardada.", schemaReference("BorrowerResponse")),
            "400": errorResponses["400"],
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "404": response("El cliente no existe.", schemaReference("ApiError")),
            "428": response("Confirmación reciente requerida.", schemaReference("ApiError")),
            "502": response(
              "El proveedor de mapas no encontró la dirección.",
              schemaReference("BorrowerAddressLocationResponse"),
            ),
          },
        },
      },
      "/v1/tenants/{tenantId}/borrowers/{borrowerId}/documents": {
        post: {
          tags: ["Clientes"],
          operationId: "uploadBorrowerDocument",
          security: sessionSecurity,
          parameters: [
            {
              name: "tenantId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "borrowerId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  required: ["file", "category"],
                  properties: {
                    file: { type: "string", format: "binary" },
                    category: { type: "string", enum: ["identity", "profile_photo"] },
                    side: { type: "string", nullable: true, enum: ["front", "back", null] },
                  },
                },
              },
            },
          },
          responses: {
            "201": response(
              "Documento enviado a cuarentena privada.",
              schemaReference("BorrowerDocumentResponse"),
            ),
            "400": errorResponses["400"],
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "404": response("El cliente no existe.", schemaReference("ApiError")),
            "409": response("Ya existe un documento para esa cara.", schemaReference("ApiError")),
            "413": response("El documento supera el límite.", schemaReference("ApiError")),
            "503": response("El almacenamiento no está habilitado.", schemaReference("ApiError")),
          },
        },
      },
      "/v1/tenants/{tenantId}/borrowers/{borrowerId}/documents/{documentId}": {
        get: {
          tags: ["Clientes"],
          operationId: "getBorrowerDocument",
          security: sessionSecurity,
          parameters: [
            {
              name: "tenantId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "borrowerId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "documentId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": { description: "Archivo privado del expediente." },
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "404": response("El archivo no existe.", schemaReference("ApiError")),
            "503": response("El almacenamiento no está habilitado.", schemaReference("ApiError")),
          },
        },
      },
      "/v1/tenants/{tenantId}/borrowers/{borrowerId}/review": {
        patch: {
          tags: ["Clientes"],
          operationId: "reviewBorrowerIdentity",
          security: sessionSecurity,
          parameters: [
            {
              name: "tenantId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "borrowerId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          requestBody: {
            required: true,
            content: jsonContent(schemaReference("BorrowerReviewRequest")),
          },
          responses: {
            "200": response("Revisión manual guardada.", schemaReference("BorrowerReviewResponse")),
            "400": errorResponses["400"],
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "404": response("El cliente no existe.", schemaReference("ApiError")),
            "409": response("Faltan documentos aceptados.", schemaReference("ApiError")),
            "428": response("Reautenticación requerida.", schemaReference("ApiError")),
            "503": response("El módulo no está habilitado.", schemaReference("ApiError")),
          },
        },
      },
      "/v1/tenants/{tenantId}/verification-network/consents": {
        post: {
          tags: ["Empresas"],
          operationId: "grantVerificationNetworkConsent",
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
            content: jsonContent(schemaReference("VerificationNetworkConsentRequest")),
          },
          responses: {
            "201": response(
              "Consentimiento registrado; el token debe entregarse a la persona titular.",
              {
                type: "object",
                properties: { consent: schemaReference("VerificationNetworkConsent") },
              },
            ),
            "400": errorResponses["400"],
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "428": response("Reautenticación requerida.", schemaReference("ApiError")),
            "503": response("La red está deshabilitada.", schemaReference("ApiError")),
          },
        },
      },
      "/v1/tenants/{tenantId}/verification-network/consents/{consentId}": {
        delete: {
          tags: ["Empresas"],
          operationId: "revokeVerificationNetworkConsent",
          security: sessionSecurity,
          parameters: [
            {
              name: "tenantId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "consentId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "204": response("Consentimiento revocado."),
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "404": response("El consentimiento no existe.", schemaReference("ApiError")),
            "428": response("Reautenticación requerida.", schemaReference("ApiError")),
            "503": response("La red está deshabilitada.", schemaReference("ApiError")),
          },
        },
      },
      "/v1/tenants/{tenantId}/verification-network/query": {
        post: {
          tags: ["Empresas"],
          operationId: "queryVerificationNetwork",
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
            content: jsonContent(schemaReference("VerificationNetworkQueryRequest")),
          },
          responses: {
            "200": response(
              "Resultado mínimo y explicable.",
              schemaReference("VerificationNetworkQueryResponse"),
            ),
            "400": errorResponses["400"],
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "503": response("La red está deshabilitada.", schemaReference("ApiError")),
          },
        },
      },
      "/v1/tenants/{tenantId}/verification-network/assertions": {
        post: {
          tags: ["Empresas"],
          operationId: "publishVerificationNetworkAssertion",
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
            content: jsonContent(schemaReference("VerificationNetworkAssertionRequest")),
          },
          responses: {
            "201": response("Observación publicada con consentimiento y vencimiento.", {
              type: "object",
              properties: { assertion: schemaReference("VerificationNetworkAssertionResponse") },
            }),
            "400": errorResponses["400"],
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "409": response("Falta consentimiento vigente.", schemaReference("ApiError")),
            "428": response("Reautenticación requerida.", schemaReference("ApiError")),
            "503": response("La red está deshabilitada.", schemaReference("ApiError")),
          },
        },
      },
      "/v1/tenants/{tenantId}/verification-network/corrections": {
        post: {
          tags: ["Empresas"],
          operationId: "openVerificationNetworkCorrection",
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
            content: jsonContent(schemaReference("VerificationNetworkCorrectionRequest")),
          },
          responses: {
            "201": response("Solicitud de corrección abierta.", {
              type: "object",
              properties: { correction: schemaReference("VerificationNetworkCorrectionResponse") },
            }),
            "400": errorResponses["400"],
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "503": response("La red está deshabilitada.", schemaReference("ApiError")),
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
      "/v1/platform/owners": {
        post: {
          tags: ["Plataforma"],
          operationId: "createPlatformOwner",
          security: sessionSecurity,
          requestBody: {
            required: true,
            content: jsonContent(schemaReference("CreatePlatformOwnerRequest")),
          },
          responses: {
            "201": response(
              "Cuenta de propietario registrada.",
              schemaReference("PlatformOwnerCreatedResponse"),
            ),
            "400": errorResponses["400"],
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "409": response("El usuario o correo ya existe.", schemaReference("ApiError")),
          },
        },
      },
      "/v1/platform/company-codes": {
        post: {
          tags: ["Plataforma"],
          operationId: "issueCompanyCreationCode",
          security: sessionSecurity,
          requestBody: {
            required: true,
            content: jsonContent(schemaReference("CreateCompanyCreationCodeRequest")),
          },
          responses: {
            "201": response(
              "Código de creación emitido.",
              schemaReference("CompanyCreationCodeResponse"),
            ),
            "400": errorResponses["400"],
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "404": errorResponses["400"],
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
      "/v1/platform/users/{userId}/membership": {
        patch: {
          tags: ["Plataforma"],
          operationId: "updatePlatformUserMembership",
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
            content: jsonContent(schemaReference("PlatformUserMembershipUpdateRequest")),
          },
          responses: {
            "200": response(
              "Membresía activada con fecha de inicio.",
              schemaReference("PlatformUserMembershipUpdateResponse"),
            ),
            "400": errorResponses["400"],
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "404": response("El usuario no existe.", schemaReference("ApiError")),
            "409": response("La cuenta está protegida.", schemaReference("ApiError")),
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
