import type { LoanProduct, LoanProductCreateRequest } from "@cobranzapp/contracts";
import type { TenantActor } from "../tenancy/types.js";

export type LoanProductResult =
  | { status: "created"; product: LoanProduct }
  | { status: "duplicate" }
  | { status: "forbidden" };

export interface CreditService {
  listProducts(actor: TenantActor, tenantId: string): Promise<LoanProduct[]>;
  createProduct(
    actor: TenantActor,
    tenantId: string,
    input: LoanProductCreateRequest & { requestId: string },
  ): Promise<LoanProductResult>;
}
