import type {
  Borrower,
  BorrowerCreateRequest,
  BorrowerDirectory,
  BorrowerDocument,
  BorrowerReviewRequest,
} from "@cobranzapp/contracts";
import type { TenantActor } from "../tenancy/types.js";

export type BorrowerDirectoryQuery = {
  search: string | null;
  page: number;
  pageSize: number;
};

export type BorrowerCreateInput = BorrowerCreateRequest & { requestId: string };
export type BorrowerReviewInput = BorrowerReviewRequest & { requestId: string };
export type BorrowerDocumentInput = {
  category: BorrowerDocument["category"];
  side: BorrowerDocument["side"];
  objectKey: string;
  mediaType: string;
  sizeBytes: number;
  sha256: string;
  requestId: string;
};

export type BorrowerCreateResult =
  | { status: "created"; borrower: Borrower }
  | { status: "duplicate_identity" }
  | { status: "invalid_object_key" }
  | { status: "not_found" };

export type BorrowerReviewResult =
  | { status: "updated"; borrower: Borrower }
  | { status: "not_found" }
  | { status: "forbidden" }
  | {
      status: "missing_documents";
      missing: Array<"identity_front" | "identity_back" | "profile_photo">;
    };

export type BorrowerDocumentResult =
  | { status: "created"; document: BorrowerDocument }
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "invalid_object_key" }
  | { status: "duplicate" };

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
  review(
    actor: TenantActor,
    tenantId: string,
    borrowerId: string,
    input: BorrowerReviewInput,
  ): Promise<BorrowerReviewResult>;
  addDocument(
    actor: TenantActor,
    tenantId: string,
    borrowerId: string,
    input: BorrowerDocumentInput,
  ): Promise<BorrowerDocumentResult>;
}
