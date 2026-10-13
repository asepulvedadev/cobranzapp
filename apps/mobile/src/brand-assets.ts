export const mobileApiBaseUrl = (
  process.env.EXPO_PUBLIC_API_URL ?? "https://cobranzaap.tech"
).replace(/\/$/, "");

export function buildBrandLogoSource(tenantId: string, sessionCookie: string | null = null) {
  return {
    uri: `${mobileApiBaseUrl}/api/v1/tenants/${tenantId}/brand-logo`,
    ...(sessionCookie ? { headers: { Cookie: sessionCookie } } : {}),
  };
}
