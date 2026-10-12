import type { MembershipEntitlement, MembershipPlan } from "@cobranzapp/contracts";

export type {
  AccountSession,
  CurrentUser,
  MembershipEntitlement,
  MembershipPlan,
  MfaStatus,
  PlatformActivityDirectory,
  PlatformOverview,
  PlatformSystemStatus,
  PlatformTenantDirectory as TenantDirectory,
  PlatformUserDirectory,
  SecurityActivity,
  SupportAccessRecord,
} from "@cobranzapp/contracts";

export type AuditActivity = {
  id: string;
  action: string;
  actorDisplayName: string | null;
  actorUsername: string | null;
  happenedAt: string;
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
  membershipEntitlement: (MembershipEntitlement & { availableEmployeeSeats: number }) | null;
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
