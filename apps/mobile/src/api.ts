import {
  authenticatedResponseSchema,
  type BorrowerCreateRequest,
  type BorrowerDirectory,
  borrowerDirectorySchema,
  borrowerDocumentResponseSchema,
  borrowerResponseSchema,
  type CurrentUser,
  currentUserSchema,
  messageResponseSchema,
  mfaLoginRequiredResponseSchema,
  type PlatformOverview,
  type PlatformSystemStatus,
  platformOverviewSchema,
  platformSystemStatusSchema,
  type RouteDirectory,
  reauthenticationResponseSchema,
  routeDirectorySchema,
  type TenantOverview,
  tenantOverviewSchema,
} from "@cobranzapp/contracts";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const sessionStorageKey = "cobranzapp.mobile.session";
const apiBaseUrl = (process.env.EXPO_PUBLIC_API_URL ?? "https://cobranzaap.tech").replace(
  /\/$/,
  "",
);
const usesBrowserCookies = Platform.OS === "web";

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

  constructor(sessionCookie: string | null = null) {
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
    const response = await fetch(`${apiBaseUrl}/api${path}`, {
      ...init,
      credentials: usesBrowserCookies ? "include" : init.credentials,
      headers,
    });
    if (response.status === 401 && path !== "/v1/auth/login") await this.clearSession();
    return response;
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

  async routeDirectory(tenantId: string): Promise<RouteDirectory> {
    const response = await this.request(`/v1/tenants/${tenantId}/routes`);
    if (!response.ok)
      throw new MobileApiError(
        await apiError(response, "No fue posible cargar las rutas."),
        response.status,
      );
    return routeDirectorySchema.parse(await response.json());
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
