import { notFound, redirect } from "next/navigation";
import type { CurrentUser, TenantOverview } from "../../../../lib/platform";
import { serverApi } from "../../../../lib/server-api";

export async function loadTenantContext(slug: string) {
  const userResponse = await serverApi("/v1/auth/me");
  if (userResponse.status === 401) redirect("/ingresar");
  if (!userResponse.ok) throw new Error("No fue posible validar la sesión");
  const { user } = (await userResponse.json()) as { user: CurrentUser };
  const membership = user.memberships.find((item) => item.tenantSlug === slug);
  if (!membership) notFound();
  const response = await serverApi(`/v1/tenants/${membership.tenantId}/overview`);
  if (response.status === 401) redirect("/ingresar");
  if (response.status === 403 || response.status === 404) notFound();
  if (!response.ok) throw new Error("No fue posible cargar la empresa");
  const overview = (await response.json()) as TenantOverview;
  return { user, membership, overview };
}
