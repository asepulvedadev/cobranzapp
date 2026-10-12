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

export type AccountSession = {
  id: string;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  current: boolean;
};

export type SecurityActivity = {
  id: string;
  action: string;
  happenedAt: string;
};

export type AuditActivity = {
  id: string;
  action: string;
  actorDisplayName: string | null;
  actorUsername: string | null;
  happenedAt: string;
};

export type SupportAccessRecord = {
  id: string;
  tenantId: string;
  tenantName: string;
  requestedByDisplayName: string;
  purpose: string;
  requestedDurationMinutes: number;
  status: "pending" | "active" | "denied" | "revoked" | "expired";
  requestedAt: string;
  reviewedByDisplayName: string | null;
  reviewedAt: string | null;
  expiresAt: string | null;
};

export type MembershipPlan = "pro" | "ultra";

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
  activity: Array<
    AuditActivity & {
      tenantId: string | null;
      tenantName: string | null;
    }
  >;
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

export type PlatformSystemStatus = {
  api: { status: "operational"; version: string };
  database: { status: "operational"; schemaVersion: string | null };
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

export type InvitationPreview = {
  email: string;
  role: "owner" | "supervisor" | "collector" | "customer";
  tenantName: string;
  tenantSlug: string;
  expiresAt: string;
  accountExists: boolean;
};

export type TenantOverview = {
  tenant: {
    id: string;
    slug: string;
    displayName: string;
    status: "draft" | "active" | "suspended" | "archived";
    locale: string;
    timezone: string;
    currency: string;
    membershipPlan: MembershipPlan | null;
  };
  actorRole: "owner" | "supervisor" | "collector" | "customer" | "support";
  metrics: {
    members: number;
    branches: number;
    teams: number;
    pendingInvitations: number;
    activeEmployeeSeats: number;
  };
  settings: {
    primaryColor: string;
    accentColor: string;
    contactEmail: string | null;
    contactPhone: string | null;
    address: string | null;
    version: number;
  };
  settingsHistory: Array<{
    version: number;
    primaryColor: string;
    accentColor: string;
    contactEmail: string | null;
    changedByDisplayName: string;
    changedAt: string;
  }>;
  members: Array<{
    userId: string;
    displayName: string;
    email: string;
    username: string;
    role: "owner" | "supervisor" | "collector" | "customer";
    status: "invited" | "active" | "suspended" | "revoked";
  }>;
  branches: Array<{
    id: string;
    code: string;
    displayName: string;
    status: "active" | "inactive";
  }>;
  teams: Array<{
    id: string;
    branchId: string | null;
    branchName: string | null;
    displayName: string;
    status: "active" | "inactive";
    memberIds: string[];
  }>;
  pendingInvitations: Array<{
    id: string;
    email: string;
    role: "owner" | "supervisor" | "collector" | "customer";
    expiresAt: string;
  }>;
  activity: AuditActivity[];
};
