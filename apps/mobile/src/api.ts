import {
  authenticatedResponseSchema,
  type BorrowerAddressUpdateRequest,
  type BorrowerCreateRequest,
  type BorrowerDirectory,
  borrowerDirectorySchema,
  borrowerDocumentResponseSchema,
  borrowerOcrConfirmResponseSchema,
  borrowerOcrExtractionSchema,
  borrowerOcrResponseSchema,
  borrowerResponseSchema,
  type CurrentUser,
  currentUserSchema,
  type FinancialSchedulePreview,
  financialSchedulePreviewResponseSchema,
  identityDocumentExtractionResponseSchema,
  type LoanApplication,
  type LoanPayment,
  type LoanProduct,
  loanApplicationDirectorySchema,
  loanApplicationResponseSchema,
  loanPaymentSchema,
  loanProductDirectorySchema,
  messageResponseSchema,
  mfaLoginRequiredResponseSchema,
  type OwnerSubscriptionSummary,
  ownerSubscriptionSummarySchema,
  type PlatformOverview,
  type PlatformSystemStatus,
  platformOverviewSchema,
  platformSystemStatusSchema,
  type RouteDirectory,
  reauthenticationResponseSchema,
  routeDirectorySchema,
  type SharedClientVerification,
  sharedClientVerificationResponseSchema,
  type TenantMemberCreateRequest,
  type TenantMemberProfile,
  type TenantOverview,
  tenantMemberProfileSchema,
  tenantMemberResponseSchema,
  tenantOverviewSchema,
  type UserProfile,
  userProfileResponseSchema,
  userProfileUpdateRequestSchema,
  type VerificationNetworkConsentRequest,
  type VerificationNetworkCorrectionRequest,
  type VerificationNetworkQueryRequest,
  verificationNetworkConsentSchema,
  verificationNetworkCorrectionResponseSchema,
  verificationNetworkQueryResponseSchema,
} from "@cobranzapp/contracts";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import {
  buildAccountProfilePhotoSource,
  buildBrandLogoSource,
  mobileApiBaseUrl,
} from "./brand-assets";
import { fetchWithTimeout, RequestTimeoutError, requestTimeoutMessage } from "./request-timeout";

const sessionStorageKey = "cobranzapp.mobile.session";
const apiBaseUrl = mobileApiBaseUrl;
const usesBrowserCookies = Platform.OS === "web";
const defaultRequestTimeoutMs = 20_000;
const uploadRequestTimeoutMs = 60_000;

function cookieValue(setCookie: string | null, name: string) {
  const match = setCookie?.match(new RegExp(`(?:^|,\\s*)${name}=([^;,]+)`));
  return match?.[1] ? `${name}=${match[1]}` : null;
}

async function apiError(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
  return body?.error?.message ?? fallback;
}

export class MobileApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "MobileApiError";
  }
}

export type LoginResult = { kind: "authenticated"; user: CurrentUser } | { kind: "mfa_required" };

export class MobileApi {
  private sessionCookie: string | null;
  private challengeCookie: string | null = null;

  constructor(
    sessionCookie: string | null = null,
    private readonly requestTimeoutMs = defaultRequestTimeoutMs,
  ) {
    this.sessionCookie = sessionCookie;
  }

  static async restore() {
    return new MobileApi(await SecureStore.getItemAsync(sessionStorageKey));
  }

  private async request(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    headers.set("accept", "application/json");
    if (!usesBrowserCookies) headers.set("origin", apiBaseUrl);
    const cookie = this.sessionCookie ?? this.challengeCookie;
    if (!usesBrowserCookies && cookie) headers.set("cookie", cookie);
    const timeoutMs =
      typeof FormData !== "undefined" && init.body instanceof FormData
        ? uploadRequestTimeoutMs
        : this.requestTimeoutMs;
    try {
      const response = await fetchWithTimeout(
        `${apiBaseUrl}/api${path}`,
        {
          ...init,
          credentials: usesBrowserCookies ? "include" : init.credentials,
          headers,
        },
        timeoutMs,
      );
      if (response.status === 401 && path !== "/v1/auth/login") await this.clearSession();
      return response;
    } catch (error) {
      if (error instanceof RequestTimeoutError) {
        throw new MobileApiError(requestTimeoutMessage, 408);
      }
      throw error;
    }
  }

  async login(identifier: string, password: string): Promise<LoginResult> {
    const response = await this.request("/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    });
    if (response.status === 202) {
      const body = mfaLoginRequiredResponseSchema.parse(await response.json());
      this.challengeCookie = cookieValue(
        response.headers.get("set-cookie"),
        "cobranzapp_mfa_challenge",
      );
      if (!body.mfaRequired || (!usesBrowserCookies && !this.challengeCookie)) {
        throw new MobileApiError("Respuesta de verificación inválida.", 502);
      }
      return { kind: "mfa_required" };
    }
    if (!response.ok) {
      throw new MobileApiError(
        await apiError(response, "No fue posible iniciar sesión."),
        response.status,
      );
    }
    const body = authenticatedResponseSchema.parse(await response.json());
    this.sessionCookie = cookieValue(response.headers.get("set-cookie"), "cobranzapp_session");
    if (!usesBrowserCookies && !this.sessionCookie) {
      throw new MobileApiError("La sesión no pudo guardarse.", 502);
    }
    this.challengeCookie = null;
    if (this.sessionCookie) await SecureStore.setItemAsync(sessionStorageKey, this.sessionCookie);
    return { kind: "authenticated", user: body.user };
  }

  async verifyMfa(code: string) {
    const response = await this.request("/v1/auth/mfa/verify-login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (!response.ok) {
      throw new MobileApiError(
        await apiError(response, "No fue posible verificar el código."),
        response.status,
      );
    }
    const body = authenticatedResponseSchema.parse(await response.json());
    this.sessionCookie = cookieValue(response.headers.get("set-cookie"), "cobranzapp_session");
    if (!usesBrowserCookies && !this.sessionCookie) {
      throw new MobileApiError("La sesión no pudo guardarse.", 502);
    }
    this.challengeCookie = null;
    if (this.sessionCookie) await SecureStore.setItemAsync(sessionStorageKey, this.sessionCookie);
    return body.user;
  }

  async changePassword(currentPassword: string, newPassword: string) {
    const response = await this.request("/v1/auth/change-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (!response.ok) {
      throw new MobileApiError(
        await apiError(response, "No fue posible actualizar la contraseña."),
        response.status,
      );
    }
    messageResponseSchema.parse(await response.json());
    await this.clearSession();
  }

  async reauthenticate(password: string) {
    const response = await this.request("/v1/auth/reauthenticate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!response.ok) {
      throw new MobileApiError(
        await apiError(response, "No fue posible confirmar tu identidad."),
        response.status,
      );
    }
    return reauthenticationResponseSchema.parse(await response.json());
  }

  async me() {
    const response = await this.request("/v1/auth/me");
    if (!response.ok)
      throw new MobileApiError(
        await apiError(response, "La sesión ya no está disponible."),
        response.status,
      );
    return currentUserSchema.parse((await response.json()).user);
  }

  async platformOverview(): Promise<PlatformOverview> {
    const response = await this.request("/v1/platform/overview");
    if (!response.ok)
      throw new MobileApiError(
        await apiError(response, "No fue posible cargar la plataforma."),
        response.status,
      );
    return platformOverviewSchema.parse(await response.json());
  }

  async systemStatus(): Promise<PlatformSystemStatus> {
    const response = await this.request("/v1/platform/system-status");
    if (!response.ok)
      throw new MobileApiError(
        await apiError(response, "No fue posible consultar el estado."),
        response.status,
      );
    return platformSystemStatusSchema.parse(await response.json());
  }

  async tenantOverview(tenantId: string): Promise<TenantOverview> {
    const response = await this.request(`/v1/tenants/${tenantId}/overview`);
    if (!response.ok)
      throw new MobileApiError(
        await apiError(response, "No fue posible cargar el espacio."),
        response.status,
      );
    return tenantOverviewSchema.parse((await response.json()).overview);
  }

  async ownerSubscriptions(): Promise<OwnerSubscriptionSummary> {
    const response = await this.request("/v1/account/subscriptions");
    if (!response.ok)
      throw new MobileApiError(
        await apiError(response, "No fue posible consultar tus suscripciones."),
        response.status,
      );
    return ownerSubscriptionSummarySchema.parse(await response.json());
  }

  brandLogoSource(tenantId: string) {
    return buildBrandLogoSource(tenantId, this.sessionCookie);
  }

  accountProfilePhotoSource(version?: string | number | null) {
    return buildAccountProfilePhotoSource(this.sessionCookie, version);
  }

  async accountProfile(): Promise<UserProfile> {
    const response = await this.request("/v1/account/profile");
    if (!response.ok)
      throw new MobileApiError(
        await apiError(response, "No fue posible cargar tu perfil."),
        response.status,
      );
    return userProfileResponseSchema.parse(await response.json()).profile;
  }

  async updateAccountProfile(input: {
    displayName: string;
    phone: string | null;
    homeAddress: string | null;
    workAddress: string | null;
  }) {
    const parsed = userProfileUpdateRequestSchema.parse(input);
    const response = await this.request("/v1/account/profile", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed),
    });
    if (!response.ok) {
      throw new MobileApiError(
        await apiError(response, "No fue posible guardar tu perfil."),
        response.status,
      );
    }
    return userProfileResponseSchema.parse(await response.json()).profile;
  }

  async uploadAccountProfilePhoto(input: { uri: string; name: string; type: string; file?: Blob }) {
    const form = new FormData();
    form.append(
      "file",
      input.file ?? ({ uri: input.uri, name: input.name, type: input.type } as unknown as Blob),
    );
    const response = await this.request("/v1/account/profile-photo", {
      method: "POST",
      body: form,
    });
    if (!response.ok) {
      throw new MobileApiError(
        await apiError(response, "No fue posible guardar la foto de perfil."),
        response.status,
      );
    }
    return userProfileResponseSchema.parse(await response.json()).profile;
  }

  async createMember(tenantId: string, input: TenantMemberCreateRequest) {
    const response = await this.request(`/v1/tenants/${tenantId}/members`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      throw new MobileApiError(
        await apiError(response, "No fue posible crear el empleado."),
        response.status,
      );
    }
    return tenantMemberResponseSchema.parse(await response.json()).member;
  }

  async extractIdentityDocument(
    tenantId: string,
    front: { uri: string; name: string; type: string; file?: Blob },
    back?: { uri: string; name: string; type: string; file?: Blob },
  ) {
    const form = new FormData();
    form.append(
      "front",
      front.file ?? ({ uri: front.uri, name: front.name, type: front.type } as unknown as Blob),
    );
    if (back) {
      form.append(
        "back",
        back.file ?? ({ uri: back.uri, name: back.name, type: back.type } as unknown as Blob),
      );
    }
    const response = await this.request(`/v1/tenants/${tenantId}/borrowers/identity-extract`, {
      method: "POST",
      body: form,
    });
    if (!response.ok) {
      throw new MobileApiError(
        await apiError(response, "No fue posible leer la cédula."),
        response.status,
      );
    }
    return identityDocumentExtractionResponseSchema.parse(await response.json()).extraction;
  }

  async memberProfile(tenantId: string, userId: string): Promise<TenantMemberProfile> {
    const response = await this.request(`/v1/tenants/${tenantId}/members/${userId}/profile`);
    if (!response.ok)
      throw new MobileApiError(
        await apiError(response, "No fue posible cargar tu ficha operativa."),
        response.status,
      );
    return tenantMemberProfileSchema.parse((await response.json()).profile);
  }

  async updateMemberProfile(
    tenantId: string,
    userId: string,
    input: {
      country: string | null;
      documentType: string | null;
      documentNumber: string | null;
      phone: string | null;
      homeAddress: string | null;
      workAddress: string | null;
      profilePhotoObjectKey: string | null;
      bloodType: TenantMemberProfile["bloodType"];
      bloodTypeConsentVersion: string | null;
      emergencyContacts: Array<{
        fullName: string;
        relationship: string;
        phone: string;
      }>;
    },
  ) {
    const response = await this.request(`/v1/tenants/${tenantId}/members/${userId}/profile`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      throw new MobileApiError(
        await apiError(response, "No fue posible guardar tu ficha operativa."),
        response.status,
      );
    }
    return tenantMemberProfileSchema.parse((await response.json()).profile);
  }

  async uploadMemberProfilePhoto(
    tenantId: string,
    userId: string,
    input: { uri: string; name: string; type: string; file?: Blob },
  ) {
    const form = new FormData();
    form.append(
      "file",
      input.file ?? ({ uri: input.uri, name: input.name, type: input.type } as unknown as Blob),
    );
    const response = await this.request(`/v1/tenants/${tenantId}/members/${userId}/profile-photo`, {
      method: "POST",
      body: form,
    });
    if (!response.ok) {
      throw new MobileApiError(
        await apiError(response, "No fue posible guardar la foto de perfil."),
        response.status,
      );
    }
    return tenantMemberProfileSchema.parse((await response.json()).profile);
  }

  async uploadMemberIdentityDocument(
    tenantId: string,
    userId: string,
    input: { side: "front" | "back"; uri: string; name: string; type: string; file?: Blob },
  ) {
    const form = new FormData();
    form.append("side", input.side);
    form.append(
      "file",
      input.file ?? ({ uri: input.uri, name: input.name, type: input.type } as unknown as Blob),
    );
    const response = await this.request(
      `/v1/tenants/${tenantId}/members/${userId}/profile-documents`,
      { method: "POST", body: form },
    );
    if (!response.ok) {
      throw new MobileApiError(
        await apiError(response, "No fue posible guardar el documento de identidad."),
        response.status,
      );
    }
    return tenantMemberProfileSchema.parse((await response.json()).profile);
  }

  async borrowerDirectory(
    tenantId: string,
    options: { search?: string; page?: number; pageSize?: number } = {},
  ): Promise<BorrowerDirectory> {
    const query = new URLSearchParams({
      page: String(options.page ?? 1),
      pageSize: String(options.pageSize ?? 20),
    });
    if (options.search?.trim()) query.set("q", options.search.trim());
    const response = await this.request(`/v1/tenants/${tenantId}/borrowers?${query}`);
    if (!response.ok)
      throw new MobileApiError(
        await apiError(response, "No fue posible cargar los clientes."),
        response.status,
      );
    return borrowerDirectorySchema.parse(await response.json());
  }

  async createBorrower(tenantId: string, input: BorrowerCreateRequest) {
    const response = await this.request(`/v1/tenants/${tenantId}/borrowers`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      throw new MobileApiError(
        await apiError(response, "No fue posible crear el cliente."),
        response.status,
      );
    }
    return borrowerResponseSchema.parse(await response.json()).borrower;
  }

  async uploadBorrowerDocument(
    tenantId: string,
    borrowerId: string,
    input: {
      uri: string;
      name: string;
      type: string;
      file?: Blob;
      category: "identity" | "profile_photo";
      side?: "front" | "back";
    },
  ) {
    const form = new FormData();
    form.append(
      "file",
      input.file ??
        ({
          uri: input.uri,
          name: input.name,
          type: input.type,
        } as unknown as Blob),
    );
    form.append("category", input.category);
    if (input.side) form.append("side", input.side);
    const response = await this.request(
      `/v1/tenants/${tenantId}/borrowers/${borrowerId}/documents`,
      { method: "POST", body: form },
    );
    if (!response.ok) {
      throw new MobileApiError(
        await apiError(response, "No fue posible guardar el documento."),
        response.status,
      );
    }
    return borrowerDocumentResponseSchema.parse(await response.json()).document;
  }

  async borrowerOcr(tenantId: string, borrowerId: string) {
    const response = await this.request(`/v1/tenants/${tenantId}/borrowers/${borrowerId}/ocr`);
    if (!response.ok) {
      throw new MobileApiError(
        await apiError(response, "No fue posible consultar el resultado del OCR."),
        response.status,
      );
    }
    return borrowerOcrResponseSchema.parse(await response.json());
  }

  async confirmBorrowerOcr(
    tenantId: string,
    borrowerId: string,
    extractionId: string,
    input: { fullName: string | null; documentNumber: string | null },
  ) {
    const response = await this.request(
      `/v1/tenants/${tenantId}/borrowers/${borrowerId}/ocr/${extractionId}/confirm`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ extractionId, ...input }),
      },
    );
    if (!response.ok) {
      throw new MobileApiError(
        await apiError(response, "No fue posible confirmar los datos del OCR."),
        response.status,
      );
    }
    return borrowerOcrConfirmResponseSchema.parse(await response.json());
  }

  async retryBorrowerOcr(tenantId: string, borrowerId: string, extractionId: string) {
    const response = await this.request(
      `/v1/tenants/${tenantId}/borrowers/${borrowerId}/ocr/${extractionId}/retry`,
      { method: "POST" },
    );
    if (!response.ok) {
      throw new MobileApiError(
        await apiError(response, "No fue posible volver a procesar el documento."),
        response.status,
      );
    }
    return borrowerOcrExtractionSchema.parse((await response.json()).extraction);
  }

  async geocodeBorrowerAddress(
    tenantId: string,
    borrowerId: string,
    addressKind: "home" | "work",
    coordinates?: { latitude: number; longitude: number },
  ) {
    const response = await this.request(`/v1/tenants/${tenantId}/borrowers/${borrowerId}/geocode`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ addressKind, ...coordinates }),
    });
    if (!response.ok) {
      throw new MobileApiError(
        await apiError(response, "No fue posible ubicar la dirección."),
        response.status,
      );
    }
    return borrowerResponseSchema.parse(await response.json()).borrower;
  }

  async updateBorrowerAddresses(
    tenantId: string,
    borrowerId: string,
    input: BorrowerAddressUpdateRequest,
  ) {
    const response = await this.request(
      `/v1/tenants/${tenantId}/borrowers/${borrowerId}/addresses`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      },
    );
    if (!response.ok) {
      throw new MobileApiError(
        await apiError(response, "No fue posible guardar las direcciones."),
        response.status,
      );
    }
    return borrowerResponseSchema.parse(await response.json()).borrower;
  }

  async createVerificationConsent(tenantId: string, input: VerificationNetworkConsentRequest) {
    const response = await this.request(`/v1/tenants/${tenantId}/verification-network/consents`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      throw new MobileApiError(
        await apiError(response, "No fue posible registrar el consentimiento."),
        response.status,
      );
    }
    return verificationNetworkConsentSchema.parse((await response.json()).consent);
  }

  async verifyClient(
    tenantId: string,
    documentNumber: string,
    consentConfirmed: boolean,
  ): Promise<SharedClientVerification> {
    const response = await this.request(`/v1/tenants/${tenantId}/client-verification`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ documentNumber, consentConfirmed }),
    });
    if (!response.ok) {
      throw new MobileApiError(
        await apiError(response, "No fue posible verificar el cliente."),
        response.status,
      );
    }
    return sharedClientVerificationResponseSchema.parse(await response.json()).verification;
  }

  async queryVerificationNetwork(tenantId: string, input: VerificationNetworkQueryRequest) {
    const response = await this.request(`/v1/tenants/${tenantId}/verification-network/query`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      throw new MobileApiError(
        await apiError(response, "No fue posible consultar la red compartida."),
        response.status,
      );
    }
    return verificationNetworkQueryResponseSchema.parse(await response.json());
  }

  async createVerificationCorrection(
    tenantId: string,
    input: VerificationNetworkCorrectionRequest,
  ) {
    const response = await this.request(
      `/v1/tenants/${tenantId}/verification-network/corrections`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      },
    );
    if (!response.ok) {
      throw new MobileApiError(
        await apiError(response, "No fue posible abrir la corrección."),
        response.status,
      );
    }
    return verificationNetworkCorrectionResponseSchema.parse((await response.json()).correction);
  }

  async routeDirectory(tenantId: string): Promise<RouteDirectory> {
    const response = await this.request(`/v1/tenants/${tenantId}/routes`);
    if (!response.ok)
      throw new MobileApiError(
        await apiError(response, "No fue posible cargar las rutas."),
        response.status,
      );
    return routeDirectorySchema.parse(await response.json());
  }

  async loanProducts(tenantId: string): Promise<LoanProduct[]> {
    const response = await this.request(`/v1/tenants/${tenantId}/loan-products`);
    if (!response.ok) {
      throw new MobileApiError(
        await apiError(response, "No fue posible cargar los productos de crédito."),
        response.status,
      );
    }
    return loanProductDirectorySchema.parse(await response.json()).products;
  }

  async loanApplications(tenantId: string): Promise<LoanApplication[]> {
    const response = await this.request(`/v1/tenants/${tenantId}/loan-applications`);
    if (!response.ok) {
      throw new MobileApiError(
        await apiError(response, "No fue posible cargar los créditos."),
        response.status,
      );
    }
    return loanApplicationDirectorySchema.parse(await response.json()).applications;
  }

  async createLoanApplication(
    tenantId: string,
    input: {
      borrowerId: string;
      loanProductId: string;
      requestedPrincipal: string;
      paymentFrequency: LoanProduct["paymentFrequency"];
      requestedTermCount: number;
      purpose: string | null;
    },
  ) {
    const response = await this.request(`/v1/tenants/${tenantId}/loan-applications`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      throw new MobileApiError(
        await apiError(response, "No fue posible crear el crédito."),
        response.status,
      );
    }
    return loanApplicationResponseSchema.parse(await response.json()).application;
  }

  async previewLoanSchedule(
    tenantId: string,
    productId: string,
    input: {
      principal: string;
      termCount: number;
      paymentFrequency: LoanProduct["paymentFrequency"];
      startDate: string;
    },
  ): Promise<FinancialSchedulePreview> {
    const response = await this.request(
      `/v1/tenants/${tenantId}/loan-products/${productId}/schedule-preview`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      },
    );
    if (!response.ok) {
      throw new MobileApiError(
        await apiError(response, "No fue posible calcular el calendario."),
        response.status,
      );
    }
    return financialSchedulePreviewResponseSchema.parse(await response.json()).preview;
  }

  async recordLoanPayment(
    tenantId: string,
    application: LoanApplication,
    paymentMethod: "cash" | "transfer",
    proof?: { uri: string; name: string; type: string },
  ): Promise<{ application: LoanApplication; payment: LoanPayment }> {
    const form = new FormData();
    form.append("installmentNumber", String(application.paidInstallments + 1));
    form.append("amount", application.nextPaymentAmount ?? application.installmentAmount);
    form.append("paymentMethod", paymentMethod);
    if (proof) form.append("proof", proof as unknown as Blob);
    const response = await this.request(
      `/v1/tenants/${tenantId}/loan-applications/${application.id}/payments`,
      {
        method: "POST",
        body: form,
      },
    );
    if (!response.ok) {
      throw new MobileApiError(
        await apiError(response, "No fue posible registrar la cuota."),
        response.status,
      );
    }
    const body = (await response.json()) as unknown;
    return {
      application: loanApplicationResponseSchema.parse(body).application,
      payment: loanPaymentSchema.parse((body as { payment?: unknown }).payment),
    };
  }

  async renewLoan(tenantId: string, applicationId: string, excessAmount: string) {
    const response = await this.request(
      `/v1/tenants/${tenantId}/loan-applications/${applicationId}/renew`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ excessAmount }),
      },
    );
    if (!response.ok) {
      throw new MobileApiError(
        await apiError(response, "No fue posible renovar el crédito."),
        response.status,
      );
    }
    return loanApplicationResponseSchema.parse(await response.json()).application;
  }

  async logout() {
    if (this.sessionCookie || usesBrowserCookies)
      await this.request("/v1/auth/logout", { method: "POST" }).catch(() => undefined);
    await this.clearSession();
  }

  async clearSession() {
    this.sessionCookie = null;
    this.challengeCookie = null;
    await SecureStore.deleteItemAsync(sessionStorageKey);
  }
}
