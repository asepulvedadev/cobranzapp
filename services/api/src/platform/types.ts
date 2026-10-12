import type {
  CompanyCreationCode,
  MembershipEntitlement,
  MembershipPlan,
  PlatformActivityDirectory,
  PlatformOverview,
  PlatformTenantDirectory,
  PlatformTenantStatus,
  PlatformUser,
  PlatformUserDirectory,
  PlatformUserMembershipUpdateRequest,
  PlatformUserStatus,
  UserProfile,
  UserProfileUpdateRequest,
} from "@cobranzapp/contracts";

export type {
  CompanyCreationCode,
  MembershipEntitlement,
  MembershipPlan,
  PlatformActivityDirectory,
  PlatformAuditActivity,
  PlatformOverview,
  PlatformUser,
  PlatformUserDirectory,
  PlatformUserMembershipUpdateRequest,
  PlatformUserStatus,
  UserProfile,
} from "@cobranzapp/contracts";

export type TenantStatus = PlatformTenantStatus;

export type PlatformActivityDirectoryQuery = {
  search: string | null;
  action: string | null;
  page: number;
  pageSize: number;
};

export type TenantDirectoryQuery = {
  search: string | null;
  status: TenantStatus | null;
  page: number;
  pageSize: number;
};

export type TenantDirectory = PlatformTenantDirectory;

export type PlatformUserDirectoryQuery = {
  search: string | null;
  status: PlatformUserStatus | null;
  page: number;
  pageSize: number;
};

export type PlatformUserStatusUpdateResult =
  | {
      status: "updated";
      userStatus: PlatformUserStatus;
      revokedSessions: number;
    }
  | { status: "protected" }
  | { status: "not_found" };

export type PlatformUserMembershipUpdateResult =
  | { status: "updated"; membershipPlan: MembershipPlan; activatedAt: string }
  | { status: "protected" }
  | { status: "not_found" };

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

export type UserProfileUpdateResult =
  | { status: "updated"; profile: UserProfile }
  | { status: "forbidden" }
  | { status: "not_found" };

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
  | {
      status: "updated";
      membershipPlan: MembershipPlan;
      membershipEntitlement: MembershipEntitlement;
    }
  | { status: "seat_limit_conflict"; activeEmployeeSeats: number; employeeSeatLimit: number }
  | { status: "not_found" };

export type MembershipEntitlementUpdateResult =
  | { status: "updated"; membershipEntitlement: MembershipEntitlement }
  | { status: "plan_required" }
  | { status: "seat_limit_conflict"; activeEmployeeSeats: number; employeeSeatLimit: number }
  | { status: "not_found" };

export interface PlatformService {
  getUserProfile?(userId: string): Promise<UserProfile | null>;
  updateUserProfile?(
    actorUserId: string,
    userId: string,
    input: UserProfileUpdateRequest,
    requestId: string,
  ): Promise<UserProfileUpdateResult>;
  setUserProfilePhoto?(
    actorUserId: string,
    userId: string,
    objectKey: string,
    requestId: string,
  ): Promise<UserProfileUpdateResult>;
  overview(actorUserId: string): Promise<PlatformOverview>;
  listActivity(
    actorUserId: string,
    query: PlatformActivityDirectoryQuery,
  ): Promise<PlatformActivityDirectory>;
  listTenants(actorUserId: string, query: TenantDirectoryQuery): Promise<TenantDirectory>;
  listUsers(actorUserId: string, query: PlatformUserDirectoryQuery): Promise<PlatformUserDirectory>;
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
  createTenantForOwner?(
    actorUserId: string,
    input: { code: string; displayName: string; requestId: string },
  ): Promise<
    | {
        status: "created";
        tenantId: string;
        tenantName: string;
        tenantSlug: string;
        role: "owner";
      }
    | { status: "invalid_code" }
    | { status: "expired_code" }
  >;
  createOwnerAccount?(
    actorUserId: string,
    input: {
      username: string;
      email: string;
      displayName: string;
      temporaryPassword: string;
      requestId: string;
    },
  ): Promise<{ user: PlatformUser; temporaryPassword: string }>;
  issueCompanyCreationCode?(
    actorUserId: string,
    input: {
      ownerUserId: string;
      membershipPlan: MembershipPlan;
      requestId: string;
    },
  ): Promise<CompanyCreationCode>;
  updateMembershipPlan(
    actorUserId: string,
    tenantId: string,
    membershipPlan: MembershipPlan,
    requestId: string,
  ): Promise<MembershipPlanUpdateResult>;
  updateMembershipEntitlement(
    actorUserId: string,
    tenantId: string,
    additionalEmployeeSeats: number,
    requestId: string,
  ): Promise<MembershipEntitlementUpdateResult>;
  updateTenantStatus(
    actorUserId: string,
    tenantId: string,
    status: Exclude<TenantStatus, "draft">,
    requestId: string,
  ): Promise<TenantStatusUpdateResult>;
  updateUserStatus(
    actorUserId: string,
    userId: string,
    status: PlatformUserStatus,
    requestId: string,
  ): Promise<PlatformUserStatusUpdateResult>;
  updateUserMembership?(
    actorUserId: string,
    userId: string,
    input: PlatformUserMembershipUpdateRequest,
    requestId: string,
  ): Promise<PlatformUserMembershipUpdateResult>;
}
