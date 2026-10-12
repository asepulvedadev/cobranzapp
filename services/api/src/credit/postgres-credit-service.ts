import type { LoanProduct } from "@cobranzapp/contracts";
import type { Pool, PoolClient } from "pg";
import type { TenantActor } from "../tenancy/types.js";
import type { CreditService, LoanProductResult } from "./types.js";

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

function canManageProducts(actor: TenantActor) {
  return actor.tenantRole === "owner" || actor.tenantRole === "supervisor";
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
      if (!canManageProducts(actor)) return [];
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
  };
}
