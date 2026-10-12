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
    membershipPlan: MembershipPlan | null;
    members: number;
    readiness: {
      activeOwner: boolean;
      activeBranch: boolean;
      contactEmail: boolean;
      membershipPlan: boolean;
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

export type MembershipPlan = "pro" | "ultra";
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
      missing: Array<"active_owner" | "active_branch" | "contact_email" | "membership_plan">;
    }
  | { status: "invalid_transition" }
  | { status: "not_found" };

export type MembershipPlanUpdateResult =
  | { status: "updated"; membershipPlan: MembershipPlan }
  | { status: "not_found" };

export interface PlatformService {
  overview(actorUserId: string): Promise<PlatformOverview>;
  listTenants(actorUserId: string, query: TenantDirectoryQuery): Promise<TenantDirectory>;
  systemStatus(actorUserId: string): Promise<PlatformDatabaseStatus>;
  createTenant(
    actorUserId: string,
    input: {
      displayName: string;
      slug: string;
      membershipPlan: MembershipPlan;
      requestId: string;
    },
  ): Promise<PlatformOverview["tenants"][number]>;
  updateMembershipPlan(
    actorUserId: string,
    tenantId: string,
    membershipPlan: MembershipPlan,
    requestId: string,
  ): Promise<MembershipPlanUpdateResult>;
  updateTenantStatus(
    actorUserId: string,
    tenantId: string,
    status: Exclude<TenantStatus, "draft">,
    requestId: string,
  ): Promise<TenantStatusUpdateResult>;
}
