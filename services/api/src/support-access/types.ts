import type { TenantActor } from "../tenancy/types.js";

export type SupportAccessStatus = "pending" | "active" | "denied" | "revoked" | "expired";

export type SupportAccessRecord = {
  id: string;
  tenantId: string;
  tenantName: string;
  requestedByDisplayName: string;
  purpose: string;
  requestedDurationMinutes: number;
  status: SupportAccessStatus;
  requestedAt: string;
  reviewedByDisplayName: string | null;
  reviewedAt: string | null;
  expiresAt: string | null;
};

export type SupportAccessRequestResult =
  | { status: "created"; access: SupportAccessRecord }
  | { status: "exists"; access: SupportAccessRecord }
  | { status: "tenant_not_found" };

export type SupportAccessMutationResult =
  | { status: "updated"; access: SupportAccessRecord }
  | { status: "not_found" }
  | { status: "invalid_transition" };

export interface SupportAccessService {
  requestAccess(
    actorUserId: string,
    tenantId: string,
    input: { purpose: string; durationMinutes: number; requestId: string },
  ): Promise<SupportAccessRequestResult>;
  listForDeveloper(actorUserId: string): Promise<SupportAccessRecord[]>;
  listForTenant(actor: TenantActor, tenantId: string): Promise<SupportAccessRecord[]>;
  reviewAccess(
    actor: TenantActor,
    tenantId: string,
    accessId: string,
    action: "approve" | "deny" | "revoke",
    requestId: string,
  ): Promise<SupportAccessMutationResult>;
  cancelAccess(
    actorUserId: string,
    accessId: string,
    requestId: string,
  ): Promise<SupportAccessMutationResult>;
  findActiveAccess(actorUserId: string, tenantId: string): Promise<SupportAccessRecord | null>;
}
