import type { LoanApplication, LoanProduct } from "@cobranzapp/contracts";
import type { Pool, PoolClient } from "pg";
import type { TenantActor } from "../tenancy/types.js";
import type { CreditService, LoanApplicationResult, LoanProductResult } from "./types.js";

type LoanProductRow = {
  id: string;
  name: string;
  status: LoanProduct["status"];
  currency: "COP";
  principal_min: string;
  principal_max: string;
  term_count: number;
  payment_frequency: LoanProduct["paymentFrequency"];
  rate_basis: LoanProduct["rateBasis"];
  nominal_rate: string;
  documentation_fee_rate: string;
  compliance_status: LoanProduct["complianceStatus"];
  compliance_source_ref: string | null;
  created_at: Date;
  updated_at: Date;
};

type LoanApplicationRow = {
  id: string;
  borrower_id: string;
  borrower_name: string;
  loan_product_id: string;
  loan_product_name: string;
  requested_principal: string;
  requested_term_count: number;
  purpose: string | null;
  status: LoanApplication["status"];
  created_at: Date;
  updated_at: Date;
};

function canManageProducts(actor: TenantActor) {
  return actor.tenantRole === "owner" || actor.tenantRole === "supervisor";
}

function canReadProducts(actor: TenantActor) {
  return canManageProducts(actor) || actor.tenantRole === "collector";
}

function canManageApplications(actor: TenantActor) {
  return ["owner", "supervisor", "collector"].includes(actor.tenantRole ?? "");
}

function mapProduct(row: LoanProductRow): LoanProduct {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    currency: row.currency,
    principalMin: row.principal_min,
    principalMax: row.principal_max,
    termCount: row.term_count,
    paymentFrequency: row.payment_frequency,
    rateBasis: row.rate_basis,
    nominalRate: row.nominal_rate,
    documentationFeeRate: row.documentation_fee_rate,
    complianceStatus: row.compliance_status,
    complianceSourceRef: row.compliance_source_ref,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapApplication(row: LoanApplicationRow): LoanApplication {
  return {
    id: row.id,
    borrowerId: row.borrower_id,
    borrowerName: row.borrower_name,
    loanProductId: row.loan_product_id,
    loanProductName: row.loan_product_name,
    requestedPrincipal: row.requested_principal,
    requestedTermCount: row.requested_term_count,
    purpose: row.purpose,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

async function setActorContext(client: PoolClient, actor: TenantActor, tenantId: string) {
  await client.query("SELECT set_config('app.user_id', $1, true)", [actor.userId]);
  await client.query("SELECT set_config('app.platform_role', $1, true)", [
    actor.platformRole ?? "",
  ]);
  await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
  await client.query("SELECT set_config('app.tenant_role', $1, true)", [actor.tenantRole ?? ""]);
}

export function createPostgresCreditService(pool: Pool): CreditService {
  async function withTransaction<T>(
    actor: TenantActor,
    tenantId: string,
    work: (client: PoolClient) => Promise<T>,
  ) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await setActorContext(client, actor, tenantId);
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  return {
    async listProducts(actor, tenantId) {
      if (!canReadProducts(actor)) return [];
      return withTransaction(actor, tenantId, async (client) => {
        const result = await client.query<LoanProductRow>(
          `SELECT id, name, status, currency, principal_min, principal_max,
                  term_count, payment_frequency, rate_basis, nominal_rate,
                  documentation_fee_rate, compliance_status, compliance_source_ref,
                  created_at, updated_at
             FROM loan_products
            WHERE tenant_id = $1
            ORDER BY updated_at DESC, id DESC`,
          [tenantId],
        );
        return result.rows.map(mapProduct);
      });
    },

    async createProduct(actor, tenantId, input): Promise<LoanProductResult> {
      if (!canManageProducts(actor)) return { status: "forbidden" };
      return withTransaction(actor, tenantId, async (client) => {
        try {
          const result = await client.query<LoanProductRow>(
            `INSERT INTO loan_products
               (tenant_id, name, principal_min, principal_max, term_count,
                payment_frequency, rate_basis, nominal_rate, documentation_fee_rate,
                compliance_source_ref, created_by)
             VALUES ($1, $2, $3::numeric, $4::numeric, $5, $6, $7, $8::numeric, $9::numeric, $10, $11)
             RETURNING id, name, status, currency, principal_min, principal_max,
                       term_count, payment_frequency, rate_basis, nominal_rate,
                       documentation_fee_rate, compliance_status, compliance_source_ref,
                       created_at, updated_at`,
            [
              tenantId,
              input.name,
              input.principalMin,
              input.principalMax,
              input.termCount,
              input.paymentFrequency,
              input.rateBasis,
              input.nominalRate,
              input.documentationFeeRate,
              input.complianceSourceRef,
              actor.userId,
            ],
          );
          const row = result.rows[0];
          if (!row) throw new Error("LOAN_PRODUCT_NOT_CREATED");
          await client.query(
            `INSERT INTO audit_events
               (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
             VALUES ($1, $2, 'loan_product.draft_created', 'loan_product', $3, $4,
                     jsonb_build_object('status', 'draft', 'complianceStatus', 'pending'))`,
            [tenantId, actor.userId, row.id, input.requestId],
          );
          return { status: "created", product: mapProduct(row) };
        } catch (error) {
          if (error && typeof error === "object" && "code" in error && error.code === "23505") {
            return { status: "duplicate" };
          }
          throw error;
        }
      });
    },

    async listApplications(actor, tenantId) {
      if (!canManageApplications(actor)) return [];
      return withTransaction(actor, tenantId, async (client) => {
        const result = await client.query<LoanApplicationRow>(
          `SELECT application.id,
                  application.borrower_id,
                  borrower.full_name AS borrower_name,
                  application.loan_product_id,
                  product.name AS loan_product_name,
                  application.requested_principal,
                  application.requested_term_count,
                  application.purpose,
                  application.status,
                  application.created_at,
                  application.updated_at
             FROM loan_applications application
             JOIN borrowers borrower
               ON borrower.tenant_id = application.tenant_id
              AND borrower.id = application.borrower_id
             JOIN loan_products product
               ON product.tenant_id = application.tenant_id
              AND product.id = application.loan_product_id
            WHERE application.tenant_id = $1
            ORDER BY application.updated_at DESC, application.id DESC`,
          [tenantId],
        );
        return result.rows.map(mapApplication);
      });
    },

    async createApplication(actor, tenantId, input): Promise<LoanApplicationResult> {
      if (!canManageApplications(actor)) return { status: "forbidden" };
      return withTransaction(actor, tenantId, async (client) => {
        const borrowerResult = await client.query<{ id: string }>(
          `SELECT id FROM borrowers
            WHERE tenant_id = $1 AND id = $2 AND status = 'active'`,
          [tenantId, input.borrowerId],
        );
        if (!borrowerResult.rows[0]) return { status: "not_found" };

        const productResult = await client.query<{
          id: string;
          name: string;
          status: LoanProduct["status"];
          principal_min: string;
          principal_max: string;
          term_count: number;
        }>(
          `SELECT id, name, status, principal_min, principal_max, term_count
             FROM loan_products
            WHERE tenant_id = $1 AND id = $2`,
          [tenantId, input.loanProductId],
        );
        const product = productResult.rows[0];
        if (!product || product.status === "retired") return { status: "invalid_product" };

        const amountCheck = await client.query<{ out_of_range: boolean }>(
          `SELECT ($3::numeric < $1::numeric OR $3::numeric > $2::numeric) AS out_of_range`,
          [product.principal_min, product.principal_max, input.requestedPrincipal],
        );
        if (amountCheck.rows[0]?.out_of_range) return { status: "amount_out_of_range" };
        if (input.requestedTermCount > product.term_count) return { status: "term_out_of_range" };

        const inserted = await client.query<{ id: string }>(
          `INSERT INTO loan_applications
             (tenant_id, borrower_id, loan_product_id, requested_principal,
              requested_term_count, purpose, created_by)
           VALUES ($1, $2, $3, $4::numeric, $5, $6, $7)
           RETURNING id`,
          [
            tenantId,
            input.borrowerId,
            input.loanProductId,
            input.requestedPrincipal,
            input.requestedTermCount,
            input.purpose,
            actor.userId,
          ],
        );
        const applicationId = inserted.rows[0]?.id;
        if (!applicationId) throw new Error("LOAN_APPLICATION_NOT_CREATED");
        const applicationResult = await client.query<LoanApplicationRow>(
          `SELECT application.id,
                  application.borrower_id,
                  borrower.full_name AS borrower_name,
                  application.loan_product_id,
                  product.name AS loan_product_name,
                  application.requested_principal,
                  application.requested_term_count,
                  application.purpose,
                  application.status,
                  application.created_at,
                  application.updated_at
             FROM loan_applications application
             JOIN borrowers borrower
               ON borrower.tenant_id = application.tenant_id
              AND borrower.id = application.borrower_id
             JOIN loan_products product
               ON product.tenant_id = application.tenant_id
              AND product.id = application.loan_product_id
            WHERE application.tenant_id = $1 AND application.id = $2`,
          [tenantId, applicationId],
        );
        const row = applicationResult.rows[0];
        if (!row) throw new Error("LOAN_APPLICATION_NOT_FOUND_AFTER_INSERT");
        await client.query(
          `INSERT INTO audit_events
             (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
           VALUES ($1, $2, 'loan_application.draft_created', 'loan_application', $3, $4,
                   jsonb_build_object('status', 'draft', 'borrowerId', $5, 'loanProductId', $6))`,
          [
            tenantId,
            actor.userId,
            applicationId,
            input.requestId,
            input.borrowerId,
            input.loanProductId,
          ],
        );
        return { status: "created", application: mapApplication(row) };
      });
    },
  };
}
