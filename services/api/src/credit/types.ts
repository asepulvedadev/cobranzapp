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

export type LoanApplicationResult =
  | { status: "created"; application: LoanApplication }
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "invalid_product" }
  | { status: "amount_out_of_range" }
  | { status: "term_out_of_range" };

export interface CreditService {
  listProducts(actor: TenantActor, tenantId: string): Promise<LoanProduct[]>;
  createProduct(
    actor: TenantActor,
    tenantId: string,
    input: LoanProductCreateRequest & { requestId: string },
  ): Promise<LoanProductResult>;
  listApplications(actor: TenantActor, tenantId: string): Promise<LoanApplication[]>;
  createApplication(
    actor: TenantActor,
    tenantId: string,
    input: LoanApplicationCreateRequest & { requestId: string },
  ): Promise<LoanApplicationResult>;
}
