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

export interface PlatformService {
  overview(actorUserId: string): Promise<PlatformOverview>;
  createTenant(
    actorUserId: string,
    input: { displayName: string; slug: string; requestId: string },
  ): Promise<PlatformOverview["tenants"][number]>;
}
