export const mobileApiBaseUrl = (
  process.env.EXPO_PUBLIC_API_URL ?? "https://cobranzaap.tech"
).replace(/\/$/, "");

export function buildBrandLogoSource(tenantId: string, sessionCookie: string | null = null) {
  return {
    uri: `${mobileApiBaseUrl}/api/v1/tenants/${tenantId}/brand-logo`,
    ...(sessionCookie ? { headers: { Cookie: sessionCookie } } : {}),
  };
}

export function buildAccountProfilePhotoSource(
  sessionCookie: string | null = null,
  version?: string | number | null,
) {
  const query = version ? `?v=${encodeURIComponent(String(version))}` : "";
  return {
    uri: `${mobileApiBaseUrl}/api/v1/account/profile-photo${query}`,
    ...(sessionCookie ? { headers: { Cookie: sessionCookie } } : {}),
  };
}
