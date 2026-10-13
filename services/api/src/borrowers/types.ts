import type {
  Borrower,
  BorrowerAddressLocation,
  BorrowerAddressUpdateRequest,
  BorrowerCreateRequest,
  BorrowerDirectory,
  BorrowerDocument,
  BorrowerOcrConfirmRequest,
  BorrowerOcrExtraction,
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
  | { status: "addresses_unconfirmed" }
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

export type BorrowerOcrConfirmResult =
  | { status: "updated"; borrower: Borrower; extraction: BorrowerOcrExtraction }
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "invalid_extraction" };

export type BorrowerOcrRetryResult =
  | { status: "queued"; extraction: BorrowerOcrExtraction }
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "not_retryable" };

export type BorrowerAddressKind = "home" | "work";
export type BorrowerAddressGeocodeInput = {
  addressKind: BorrowerAddressKind;
  latitude?: number;
  longitude?: number;
};
export type BorrowerAddressGeocodeResult =
  | { status: "updated"; borrower: Borrower }
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "unconfirmed" }
  | { status: "stale" }
  | { status: "unavailable"; location: BorrowerAddressLocation };

export type BorrowerAddressUpdateInput = BorrowerAddressUpdateRequest & { requestId: string };
export type BorrowerAddressUpdateResult =
  | { status: "updated"; borrower: Borrower }
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "addresses_unconfirmed" };

export type SharedClientVerification = {
  registered: boolean;
  fullName: string | null;
  activeCreditCount: number;
  payerRating: "good" | "regular" | "low" | "no_data";
  negativeReport: boolean;
};

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
  listOcr(
    actor: TenantActor,
    tenantId: string,
    borrowerId: string,
  ): Promise<BorrowerOcrExtraction[]>;
  confirmOcr(
    actor: TenantActor,
    tenantId: string,
    borrowerId: string,
    input: BorrowerOcrConfirmRequest & { requestId: string },
  ): Promise<BorrowerOcrConfirmResult>;
  retryOcr(
    actor: TenantActor,
    tenantId: string,
    borrowerId: string,
    extractionId: string,
    requestId: string,
  ): Promise<BorrowerOcrRetryResult>;
  geocodeAddress(
    actor: TenantActor,
    tenantId: string,
    borrowerId: string,
    input: BorrowerAddressGeocodeInput,
    requestId: string,
  ): Promise<BorrowerAddressGeocodeResult>;
  updateAddresses(
    actor: TenantActor,
    tenantId: string,
    borrowerId: string,
    input: BorrowerAddressUpdateInput,
  ): Promise<BorrowerAddressUpdateResult>;
  verifyShared(
    actor: TenantActor,
    tenantId: string,
    documentNumber: string,
    requestId: string,
  ): Promise<SharedClientVerification>;
}
