export type {
  AccountSession,
  Borrower,
  BorrowerCreateRequest,
  BorrowerDirectory,
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
  TenantMemberProfile,
  TenantOverview,
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
