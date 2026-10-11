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

export interface SupportAccessService {
  requestAccess(
    actorUserId: string,
    tenantId: string,
    input: { purpose: string; durationMinutes: number; requestId: string },
  ): Promise<SupportAccessRequestResult>;
  listForDeveloper(actorUserId: string): Promise<SupportAccessRecord[]>;
  listForTenant(actor: TenantActor, tenantId: string): Promise<SupportAccessRecord[]>;
}
