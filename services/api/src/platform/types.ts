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
    readiness: {
      activeOwner: boolean;
      activeBranch: boolean;
      contactEmail: boolean;
    };
    createdAt: string;
  }>;
  activity: Array<{
    id: string;
    action: string;
    actorDisplayName: string | null;
    actorUsername: string | null;
    tenantId: string | null;
    tenantName: string | null;
    happenedAt: string;
  }>;
};

export type TenantStatus = PlatformOverview["tenants"][number]["status"];

export type TenantDirectoryQuery = {
  search: string | null;
  status: TenantStatus | null;
  page: number;
  pageSize: number;
};

export type TenantDirectory = {
  tenants: PlatformOverview["tenants"];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type PlatformDatabaseStatus = {
  schemaVersion: string | null;
  jobs: {
    status: "operational" | "attention";
    due: number;
    scheduled: number;
    processing: number;
    dead: number;
    expiredLeases: number;
    oldestDueAt: string | null;
  };
  checkedAt: string;
};

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
  listTenants(actorUserId: string, query: TenantDirectoryQuery): Promise<TenantDirectory>;
  systemStatus(actorUserId: string): Promise<PlatformDatabaseStatus>;
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
