import type { TenantOverview as SharedTenantOverview } from "@cobranzapp/contracts";
import type { PlatformRole, TenantRole } from "../auth/types.js";

export type TenantActor = {
  userId: string;
  platformRole: PlatformRole;
  tenantRole: TenantRole | null;
  supportAccessId?: string;
};

export type InvitationPreview = {
  email: string;
  role: TenantRole;
  tenantName: string;
  tenantSlug: string;
  expiresAt: string;
  accountExists: boolean;
};

export type TenantOverview = SharedTenantOverview;

export type ManagedMember = TenantOverview["members"][number];

export type MemberUpdateResult =
  | { status: "updated"; member: ManagedMember }
  | { status: "not_found" }
  | { status: "protected" }
  | { status: "seat_limit_reached"; employeeSeatLimit: number }
  | { status: "invalid_transition" };

export type TeamMemberUpdateResult =
  | { status: "updated" }
  | { status: "team_not_found" }
  | { status: "member_not_found" }
  | { status: "member_ineligible" };

export type BranchStatusUpdateResult =
  | { status: "updated"; branchStatus: "active" | "inactive" }
  | { status: "not_found" }
  | { status: "has_active_teams" };

export type TeamStatusUpdateResult =
  | { status: "updated"; teamStatus: "active" | "inactive" }
  | { status: "not_found" }
  | { status: "branch_inactive" };

export type InvitationAcceptanceInput =
  | { existingUserId: string }
  | { username: string; displayName: string; password: string };

export type InvitationAcceptanceResult =
  | { status: "accepted"; tenantSlug: string }
  | { status: "invalid" }
  | { status: "expired" }
  | { status: "account_exists" }
  | { status: "email_mismatch" }
  | { status: "username_unavailable" }
  | { status: "seat_limit_reached"; employeeSeatLimit: number };

export type InvitationRevocationResult =
  | { status: "revoked" }
  | { status: "not_found" }
  | { status: "protected" };

export interface TenancyService {
  createInvitation(
    actor: TenantActor,
    tenantId: string,
    input: { email: string; role: TenantRole; requestId: string },
  ): Promise<{
    id: string;
    email: string;
    role: TenantRole;
    expiresAt: string;
    acceptanceUrl: string;
  } | null>;
  previewInvitation(token: string): Promise<InvitationPreview | null>;
  acceptInvitation(
    token: string,
    input: InvitationAcceptanceInput,
    requestId: string,
  ): Promise<InvitationAcceptanceResult>;
  revokeInvitation(
    actor: TenantActor,
    tenantId: string,
    invitationId: string,
    requestId: string,
  ): Promise<InvitationRevocationResult>;
  overview(actor: TenantActor, tenantId: string): Promise<TenantOverview | null>;
  updateSettings(
    actor: TenantActor,
    tenantId: string,
    input: TenantOverview["settings"] & { requestId: string },
  ): Promise<
    | { status: "updated"; settings: TenantOverview["settings"] }
    | { status: "stale" }
    | { status: "not_found" }
  >;
  createBranch(
    actor: TenantActor,
    tenantId: string,
    input: { code: string; displayName: string; requestId: string },
  ): Promise<TenantOverview["branches"][number] | null>;
  createTeam(
    actor: TenantActor,
    tenantId: string,
    input: { branchId: string | null; displayName: string; requestId: string },
  ): Promise<TenantOverview["teams"][number] | null>;
  updateBranchStatus(
    actor: TenantActor,
    tenantId: string,
    branchId: string,
    status: "active" | "inactive",
    requestId: string,
  ): Promise<BranchStatusUpdateResult>;
  updateTeamStatus(
    actor: TenantActor,
    tenantId: string,
    teamId: string,
    status: "active" | "inactive",
    requestId: string,
  ): Promise<TeamStatusUpdateResult>;
  addTeamMember(
    actor: TenantActor,
    tenantId: string,
    teamId: string,
    userId: string,
    requestId: string,
  ): Promise<TeamMemberUpdateResult>;
  removeTeamMember(
    actor: TenantActor,
    tenantId: string,
    teamId: string,
    userId: string,
    requestId: string,
  ): Promise<TeamMemberUpdateResult>;
  updateMember(
    actor: TenantActor,
    tenantId: string,
    userId: string,
    input: {
      role: Exclude<TenantRole, "owner">;
      status: "active" | "suspended" | "revoked";
      requestId: string;
    },
  ): Promise<MemberUpdateResult>;
}
