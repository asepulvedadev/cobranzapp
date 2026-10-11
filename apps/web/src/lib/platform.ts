export type CurrentUser = {
  id: string;
  username: string;
  email: string;
  displayName: string;
  platformRole: "developer" | null;
  mustChangePassword: boolean;
  memberships: Array<{
    tenantId: string;
    tenantName: string;
    tenantSlug: string;
    role: "owner" | "supervisor" | "collector" | "customer";
  }>;
};

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
