import type { Borrower, BorrowerCreateRequest, BorrowerDirectory } from "@cobranzapp/contracts";
import type { TenantActor } from "../tenancy/types.js";

export type BorrowerDirectoryQuery = {
  search: string | null;
  page: number;
  pageSize: number;
};

export type BorrowerCreateInput = BorrowerCreateRequest & { requestId: string };

export type BorrowerCreateResult =
  | { status: "created"; borrower: Borrower }
  | { status: "duplicate_identity" }
  | { status: "invalid_object_key" }
  | { status: "not_found" };

export interface BorrowerService {
  list(
    actor: TenantActor,
    tenantId: string,
    query: BorrowerDirectoryQuery,
  ): Promise<BorrowerDirectory>;
  get(actor: TenantActor, tenantId: string, borrowerId: string): Promise<Borrower | null>;
  create(
    actor: TenantActor,
    tenantId: string,
    input: BorrowerCreateInput,
  ): Promise<BorrowerCreateResult>;
}
