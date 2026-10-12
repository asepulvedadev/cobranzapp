import { redirect } from "next/navigation";
import type { CurrentUser } from "../../lib/platform";
import { serverApi } from "../../lib/server-api";

export default async function PanelPage() {
  const response = await serverApi("/v1/auth/me");
  if (!response.ok) redirect("/ingresar");
  const { user } = (await response.json()) as { user: CurrentUser };
  if (user.platformRole === "developer") redirect("/panel/desarrollador");
  const membership = user.memberships[0];
  if (membership) redirect(`/panel/empresa/${membership.tenantSlug}`);
  redirect("/panel/onboarding");
}
