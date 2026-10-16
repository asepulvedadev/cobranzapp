import type {
  LoanAnalytics,
  LoanAnalyticsQuery,
  LoanApplication,
  LoanApplicationCreateRequest,
  LoanPaymentCreateRequest,
  LoanProduct,
  LoanProductCreateRequest,
  LoanProductUpdateRequest,
  LoanRenewalRequest,
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
  | { status: "borrower_not_verified" }
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

export type LoanApplicationApprovalResult =
  | { status: "approved"; application: LoanApplication }
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "invalid_state" };

export type LoanPaymentResult =
  | { status: "recorded"; application: LoanApplication; amount: string }
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "invalid_state" }
  | { status: "invalid_installment" }
  | { status: "already_paid" };

export type LoanRenewalResult =
  | {
      status: "created";
      application: LoanApplication;
      renewedPrincipal: string;
      excessAmount: string;
    }
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "invalid_state" }
  | { status: "insufficient_payment"; paidPercentage: number }
  | { status: "amount_out_of_range" };

export type LoanAnalyticsResult =
  | { status: "found"; analytics: LoanAnalytics }
  | { status: "forbidden" };

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
    input: {
      principal: string;
      termCount: number;
      paymentFrequency?: LoanProduct["paymentFrequency"];
      startDate: string;
    },
  ): Promise<LoanProductSchedulePreviewResult>;
  listApplications(actor: TenantActor, tenantId: string): Promise<LoanApplication[]>;
  getAnalytics(
    actor: TenantActor,
    tenantId: string,
    query: LoanAnalyticsQuery,
  ): Promise<LoanAnalyticsResult>;
  createApplication(
    actor: TenantActor,
    tenantId: string,
    input: LoanApplicationCreateRequest & { requestId: string },
  ): Promise<LoanApplicationResult>;
  recordPayment(
    actor: TenantActor,
    tenantId: string,
    applicationId: string,
    input: LoanPaymentCreateRequest & { requestId: string },
  ): Promise<LoanPaymentResult>;
  renewApplication(
    actor: TenantActor,
    tenantId: string,
    applicationId: string,
    input: LoanRenewalRequest & { requestId: string },
  ): Promise<LoanRenewalResult>;
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
  approveApplication(
    actor: TenantActor,
    tenantId: string,
    applicationId: string,
    requestId: string,
  ): Promise<LoanApplicationApprovalResult>;
}
