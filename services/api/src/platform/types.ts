export type PlatformOverview = {
  metrics: {
    tenants: number;
    activeTenants: number;
    users: number;
    activeMemberships: number;
  };
  tenants: Array<{
    id: string;
    slug: string;
    displayName: string;
    status: "draft" | "active" | "suspended" | "archived";
    members: number;
    createdAt: string;
  }>;
};

export type TenantStatus = PlatformOverview["tenants"][number]["status"];

export type TenantStatusUpdateResult =
  | {
      status: "updated";
      tenant: PlatformOverview["tenants"][number];
    }
  | {
      status: "not_ready";
      missing: Array<"active_owner" | "active_branch" | "contact_email">;
    }
  | { status: "invalid_transition" }
  | { status: "not_found" };

export interface PlatformService {
  overview(actorUserId: string): Promise<PlatformOverview>;
  createTenant(
    actorUserId: string,
    input: { displayName: string; slug: string; requestId: string },
  ): Promise<PlatformOverview["tenants"][number]>;
  updateTenantStatus(
    actorUserId: string,
    tenantId: string,
    status: Exclude<TenantStatus, "draft">,
    requestId: string,
  ): Promise<TenantStatusUpdateResult>;
}
