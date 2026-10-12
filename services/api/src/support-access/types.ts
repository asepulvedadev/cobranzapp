import type { SupportAccessRecord } from "@cobranzapp/contracts";
import type { TenantActor } from "../tenancy/types.js";

export type { SupportAccessRecord, SupportAccessStatus } from "@cobranzapp/contracts";

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
