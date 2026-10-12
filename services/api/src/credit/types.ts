import type {
  LoanApplication,
  LoanApplicationCreateRequest,
  LoanProduct,
  LoanProductCreateRequest,
  LoanProductUpdateRequest,
} from "@cobranzapp/contracts";
import type { SchedulePreview } from "@cobranzapp/financial";
import type { TenantActor } from "../tenancy/types.js";

export type LoanProductResult =
  | { status: "created"; product: LoanProduct }
  | { status: "duplicate" }
  | { status: "forbidden" };

export type LoanProductReviewResult =
  | { status: "submitted"; product: LoanProduct }
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "invalid_state" }
  | { status: "missing_evidence" };

export type LoanProductUpdateResult =
  | { status: "updated"; product: LoanProduct }
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "invalid_state" }
  | { status: "duplicate" };

export type LoanProductSchedulePreviewResult =
  | { status: "previewed"; preview: SchedulePreview }
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "invalid_parameters" };

export type LoanApplicationResult =
  | { status: "created"; application: LoanApplication }
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "invalid_product" }
  | { status: "amount_out_of_range" }
  | { status: "term_out_of_range" };

export type LoanApplicationReviewResult =
  | { status: "submitted"; application: LoanApplication }
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "invalid_state" }
  | { status: "borrower_not_verified" }
  | { status: "product_not_reviewed" };

export type LoanApplicationReviewStartResult =
  | { status: "review_started"; application: LoanApplication }
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "invalid_state" };

export interface CreditService {
  listProducts(actor: TenantActor, tenantId: string): Promise<LoanProduct[]>;
  createProduct(
    actor: TenantActor,
    tenantId: string,
    input: LoanProductCreateRequest & { requestId: string },
  ): Promise<LoanProductResult>;
  updateProduct(
    actor: TenantActor,
    tenantId: string,
    productId: string,
    input: LoanProductUpdateRequest & { requestId: string },
  ): Promise<LoanProductUpdateResult>;
  submitProductForReview(
    actor: TenantActor,
    tenantId: string,
    productId: string,
    requestId: string,
  ): Promise<LoanProductReviewResult>;
  previewSchedule(
    actor: TenantActor,
    tenantId: string,
    productId: string,
    input: { principal: string; termCount: number; startDate: string },
  ): Promise<LoanProductSchedulePreviewResult>;
  listApplications(actor: TenantActor, tenantId: string): Promise<LoanApplication[]>;
  createApplication(
    actor: TenantActor,
    tenantId: string,
    input: LoanApplicationCreateRequest & { requestId: string },
  ): Promise<LoanApplicationResult>;
  submitApplicationForReview(
    actor: TenantActor,
    tenantId: string,
    applicationId: string,
    requestId: string,
  ): Promise<LoanApplicationReviewResult>;
  startApplicationReview(
    actor: TenantActor,
    tenantId: string,
    applicationId: string,
    requestId: string,
  ): Promise<LoanApplicationReviewStartResult>;
}
