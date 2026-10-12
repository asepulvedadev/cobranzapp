import type {
  LoanApplication,
  LoanApplicationCreateRequest,
  LoanProduct,
  LoanProductCreateRequest,
} from "@cobranzapp/contracts";
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

export interface CreditService {
  listProducts(actor: TenantActor, tenantId: string): Promise<LoanProduct[]>;
  createProduct(
    actor: TenantActor,
    tenantId: string,
    input: LoanProductCreateRequest & { requestId: string },
  ): Promise<LoanProductResult>;
  submitProductForReview(
    actor: TenantActor,
    tenantId: string,
    productId: string,
    requestId: string,
  ): Promise<LoanProductReviewResult>;
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
}
