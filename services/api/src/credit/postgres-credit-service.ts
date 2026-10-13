import type { LoanApplication, LoanProduct } from "@cobranzapp/contracts";
import { buildSchedulePreview } from "@cobranzapp/financial";
import type { Pool, PoolClient } from "pg";
import type { TenantActor } from "../tenancy/types.js";
import type {
  CreditService,
  LoanApplicationResult,
  LoanApplicationReviewResult,
  LoanApplicationReviewStartResult,
  LoanPaymentResult,
  LoanProductResult,
  LoanProductReviewResult,
  LoanProductSchedulePreviewResult,
  LoanProductUpdateResult,
  LoanRenewalResult,
} from "./types.js";

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
  payment_frequency: LoanApplication["paymentFrequency"];
  requested_term_count: number;
  paid_installments: number;
  purpose: string | null;
  status: LoanApplication["status"];
  created_at: Date;
  updated_at: Date;
};

function canManageProducts(actor: TenantActor) {
  return actor.tenantRole === "owner";
}

function canReadProducts(actor: TenantActor) {
  return ["owner", "supervisor", "collector"].includes(actor.tenantRole ?? "");
}

function canManageApplications(actor: TenantActor) {
  return ["owner", "supervisor", "collector"].includes(actor.tenantRole ?? "");
}

function canReviewApplications(actor: TenantActor) {
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

function mapApplication(row: LoanApplicationRow): LoanApplication {
  const operationalState = operationalPaymentState(row);
  return {
    id: row.id,
    borrowerId: row.borrower_id,
    borrowerName: row.borrower_name,
    loanProductId: row.loan_product_id,
    loanProductName: row.loan_product_name,
    requestedPrincipal: row.requested_principal,
    paymentFrequency: row.payment_frequency,
    requestedTermCount: row.requested_term_count,
    paidInstallments: row.paid_installments,
    ...operationalState,
    purpose: row.purpose,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

const allowedTerms: Record<LoanApplication["paymentFrequency"], number[]> = {
  daily: [30, 35],
  weekly: [4, 5],
  // A standard month has two fortnightly installments. Three would create a
  // six-week term, which is outside the one-month/exceptional-five-week rule.
  fortnightly: [2],
  monthly: [1],
};

function parseCents(value: string) {
  const [integer, fraction = ""] = value.split(".");
  return BigInt(integer ?? "0") * 100n + BigInt(fraction.padEnd(2, "0").slice(0, 2));
}

function formatCents(value: bigint) {
  return `${value / 100n}.${(value % 100n).toString().padStart(2, "0")}`;
}

function addMonths(date: Date, months: number) {
  const result = new Date(date.getTime());
  const originalDay = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(originalDay, lastDay));
  return result;
}

function dueDateFor(
  startDate: Date,
  frequency: LoanApplication["paymentFrequency"],
  period: number,
) {
  const result = new Date(startDate.getTime());
  if (frequency === "daily") result.setUTCDate(result.getUTCDate() + period);
  if (frequency === "weekly") result.setUTCDate(result.getUTCDate() + period * 7);
  if (frequency === "fortnightly") result.setUTCDate(result.getUTCDate() + period * 14);
  if (frequency === "monthly") return addMonths(startDate, period);
  return result;
}

function operationalPaymentState(row: LoanApplicationRow) {
  if (row.status !== "active" || row.paid_installments >= row.requested_term_count) {
    return { nextDueDate: null, overdueInstallments: 0 };
  }
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const nextPeriod = row.paid_installments + 1;
  let overdueInstallments = 0;
  for (let period = nextPeriod; period <= row.requested_term_count; period += 1) {
    if (dueDateFor(row.created_at, row.payment_frequency, period).getTime() < today.getTime()) {
      overdueInstallments += 1;
    }
  }
  return {
    nextDueDate: dueDateFor(row.created_at, row.payment_frequency, nextPeriod)
      .toISOString()
      .slice(0, 10),
    overdueInstallments,
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

    async updateProduct(actor, tenantId, productId, input): Promise<LoanProductUpdateResult> {
      if (!canManageProducts(actor)) return { status: "forbidden" };
      return withTransaction(actor, tenantId, async (client) => {
        const currentResult = await client.query<LoanProductRow>(
          `SELECT id, name, status, currency, principal_min, principal_max,
                  term_count, payment_frequency, rate_basis, nominal_rate,
                  documentation_fee_rate, compliance_status, compliance_source_ref,
                  created_at, updated_at
             FROM loan_products
            WHERE tenant_id = $1 AND id = $2
            FOR UPDATE`,
          [tenantId, productId],
        );
        const current = currentResult.rows[0];
        if (!current) return { status: "not_found" };
        if (current.status !== "draft") return { status: "invalid_state" };
        try {
          const updated = await client.query<LoanProductRow>(
            `UPDATE loan_products
                SET name = $3,
                    principal_min = $4::numeric,
                    principal_max = $5::numeric,
                    term_count = $6,
                    payment_frequency = $7,
                    rate_basis = $8,
                    nominal_rate = $9::numeric,
                    documentation_fee_rate = $10::numeric,
                    compliance_source_ref = $11,
                    compliance_status = 'pending',
                    reviewed_by = NULL,
                    updated_at = now()
              WHERE tenant_id = $1 AND id = $2
              RETURNING id, name, status, currency, principal_min, principal_max,
                        term_count, payment_frequency, rate_basis, nominal_rate,
                        documentation_fee_rate, compliance_status, compliance_source_ref,
                        created_at, updated_at`,
            [
              tenantId,
              productId,
              input.name,
              input.principalMin,
              input.principalMax,
              input.termCount,
              input.paymentFrequency,
              input.rateBasis,
              input.nominalRate,
              input.documentationFeeRate,
              input.complianceSourceRef,
            ],
          );
          const row = updated.rows[0];
          if (!row) throw new Error("LOAN_PRODUCT_UPDATE_FAILED");
          await client.query(
            `INSERT INTO audit_events
               (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
             VALUES ($1, $2, 'loan_product.draft_updated', 'loan_product', $3, $4,
                     jsonb_build_object('status', 'draft', 'rateBasis', $5,
                       'paymentFrequency', $6))`,
            [
              tenantId,
              actor.userId,
              productId,
              input.requestId,
              input.rateBasis,
              input.paymentFrequency,
            ],
          );
          return { status: "updated", product: mapProduct(row) };
        } catch (error) {
          if (error && typeof error === "object" && "code" in error && error.code === "23505") {
            return { status: "duplicate" };
          }
          throw error;
        }
      });
    },

    async submitProductForReview(
      actor,
      tenantId,
      productId,
      requestId,
    ): Promise<LoanProductReviewResult> {
      if (!canManageProducts(actor)) return { status: "forbidden" };
      return withTransaction(actor, tenantId, async (client) => {
        const productResult = await client.query<LoanProductRow>(
          `SELECT id, name, status, currency, principal_min, principal_max,
                  term_count, payment_frequency, rate_basis, nominal_rate,
                  documentation_fee_rate, compliance_status, compliance_source_ref,
                  created_at, updated_at
             FROM loan_products
            WHERE tenant_id = $1 AND id = $2
            FOR UPDATE`,
          [tenantId, productId],
        );
        const product = productResult.rows[0];
        if (!product) return { status: "not_found" };
        if (product.status !== "draft") return { status: "invalid_state" };
        if (!product.compliance_source_ref || product.compliance_status === "expired") {
          return { status: "missing_evidence" };
        }
        const updated = await client.query<LoanProductRow>(
          `UPDATE loan_products
              SET status = 'under_review', reviewed_by = $3, updated_at = now()
            WHERE tenant_id = $1 AND id = $2
            RETURNING id, name, status, currency, principal_min, principal_max,
                      term_count, payment_frequency, rate_basis, nominal_rate,
                      documentation_fee_rate, compliance_status, compliance_source_ref,
                      created_at, updated_at`,
          [tenantId, productId, actor.userId],
        );
        const row = updated.rows[0];
        if (!row) throw new Error("LOAN_PRODUCT_REVIEW_NOT_CREATED");
        await client.query(
          `INSERT INTO audit_events
             (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
           VALUES ($1, $2, 'loan_product.submitted_for_review', 'loan_product', $3, $4,
                   jsonb_build_object('status', 'under_review', 'complianceSourceRef', $5))`,
          [tenantId, actor.userId, productId, requestId, product.compliance_source_ref],
        );
        return { status: "submitted", product: mapProduct(row) };
      });
    },

    async previewSchedule(
      actor,
      tenantId,
      productId,
      input,
    ): Promise<LoanProductSchedulePreviewResult> {
      if (!canReadProducts(actor)) return { status: "forbidden" };
      return withTransaction(actor, tenantId, async (client) => {
        const result = await client.query<LoanProductRow>(
          `SELECT id, name, status, currency, principal_min, principal_max,
                  term_count, payment_frequency, rate_basis, nominal_rate,
                  documentation_fee_rate, compliance_status, compliance_source_ref,
                  created_at, updated_at
             FROM loan_products
            WHERE tenant_id = $1 AND id = $2`,
          [tenantId, productId],
        );
        const product = result.rows[0];
        if (!product) return { status: "not_found" };
        if (input.termCount > product.term_count) return { status: "invalid_parameters" };
        try {
          const preview = buildSchedulePreview({
            principal: input.principal,
            termCount: input.termCount,
            paymentFrequency: input.paymentFrequency ?? product.payment_frequency,
            rateBasis: product.rate_basis,
            nominalRate: product.nominal_rate,
            documentationFeeRate: product.documentation_fee_rate,
            startDate: input.startDate,
          });
          const amountCheck = await client.query<{ out_of_range: boolean }>(
            `SELECT ($3::numeric < $1::numeric OR $3::numeric > $2::numeric) AS out_of_range`,
            [product.principal_min, product.principal_max, input.principal],
          );
          if (amountCheck.rows[0]?.out_of_range) return { status: "invalid_parameters" };
          return { status: "previewed", preview };
        } catch {
          return { status: "invalid_parameters" };
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
                  application.payment_frequency,
                  application.requested_term_count,
                  application.paid_installments,
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
          rate_basis: LoanProduct["rateBasis"];
          nominal_rate: string;
          documentation_fee_rate: string;
        }>(
          `SELECT id, name, status, principal_min, principal_max, term_count,
                  rate_basis, nominal_rate, documentation_fee_rate
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
        if (!allowedTerms[input.paymentFrequency]?.includes(input.requestedTermCount)) {
          return { status: "term_out_of_range" };
        }

        const inserted = await client.query<{ id: string }>(
          `INSERT INTO loan_applications
             (tenant_id, borrower_id, loan_product_id, requested_principal,
              payment_frequency, requested_term_count, purpose, status, created_by,
              rate_basis, nominal_rate, documentation_fee_rate)
           VALUES ($1, $2, $3, $4::numeric, $5, $6, $7, 'active', $8, $9, $10::numeric, $11::numeric)
           RETURNING id`,
          [
            tenantId,
            input.borrowerId,
            input.loanProductId,
            input.requestedPrincipal,
            input.paymentFrequency,
            input.requestedTermCount,
            input.purpose,
            actor.userId,
            product.rate_basis,
            product.nominal_rate,
            product.documentation_fee_rate,
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
                  application.payment_frequency,
                  application.requested_term_count,
                  application.paid_installments,
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
             VALUES ($1, $2, 'loan_application.created_active', 'loan_application', $3, $4,
                   jsonb_build_object('status', 'active', 'borrowerId', $5, 'loanProductId', $6,
                     'paymentFrequency', $7, 'termCount', $8))`,
          [
            tenantId,
            actor.userId,
            applicationId,
            input.requestId,
            input.borrowerId,
            input.loanProductId,
            input.paymentFrequency,
            input.requestedTermCount,
          ],
        );
        return { status: "created", application: mapApplication(row) };
      });
    },

    async recordPayment(actor, tenantId, applicationId, input): Promise<LoanPaymentResult> {
      if (!canManageApplications(actor)) return { status: "forbidden" };
      return withTransaction(actor, tenantId, async (client) => {
        const current = await client.query<{
          id: string;
          borrower_id: string;
          borrower_name: string;
          loan_product_id: string;
          loan_product_name: string;
          requested_principal: string;
          payment_frequency: LoanApplication["paymentFrequency"];
          requested_term_count: number;
          paid_installments: number;
          purpose: string | null;
          status: LoanApplication["status"];
          created_at: Date;
          updated_at: Date;
          rate_basis: LoanProduct["rateBasis"];
          nominal_rate: string;
          documentation_fee_rate: string;
        }>(
          `SELECT application.id,
                  application.borrower_id,
                  borrower.full_name AS borrower_name,
                  application.loan_product_id,
                  product.name AS loan_product_name,
                  application.requested_principal,
                  application.payment_frequency,
                  application.requested_term_count,
                  application.paid_installments,
                  application.purpose,
                  application.status,
                  application.created_at,
                  application.updated_at,
                  application.rate_basis,
                  application.nominal_rate,
                  application.documentation_fee_rate
             FROM loan_applications application
             JOIN borrowers borrower
               ON borrower.tenant_id = application.tenant_id
              AND borrower.id = application.borrower_id
             JOIN loan_products product
               ON product.tenant_id = application.tenant_id
              AND product.id = application.loan_product_id
            WHERE application.tenant_id = $1 AND application.id = $2
            FOR UPDATE OF application`,
          [tenantId, applicationId],
        );
        const state = current.rows[0];
        if (!state) return { status: "not_found" };
        if (state.status !== "active") return { status: "invalid_state" };
        if (input.installmentNumber <= state.paid_installments) return { status: "already_paid" };
        if (
          input.installmentNumber !== state.paid_installments + 1 ||
          input.installmentNumber > state.requested_term_count
        ) {
          return { status: "invalid_installment" };
        }
        const preview = buildSchedulePreview({
          principal: state.requested_principal,
          termCount: state.requested_term_count,
          paymentFrequency: state.payment_frequency,
          rateBasis: state.rate_basis,
          nominalRate: state.nominal_rate,
          documentationFeeRate: state.documentation_fee_rate,
          startDate: state.created_at.toISOString().slice(0, 10),
        });
        const period = preview.periods[input.installmentNumber - 1];
        if (!period) return { status: "invalid_installment" };
        await client.query(
          `INSERT INTO loan_payments
             (tenant_id, application_id, installment_number, amount, recorded_by)
           VALUES ($1, $2, $3, $4::numeric, $5)`,
          [tenantId, applicationId, input.installmentNumber, period.installment, actor.userId],
        );
        const nextPaid = state.paid_installments + 1;
        const nextStatus = nextPaid >= state.requested_term_count ? "paid" : "active";
        await client.query(
          `UPDATE loan_applications
              SET paid_installments = $3,
                  last_payment_at = now(),
                  status = $4,
                  updated_at = now()
            WHERE tenant_id = $1 AND id = $2`,
          [tenantId, applicationId, nextPaid, nextStatus],
        );
        const complete = await client.query<LoanApplicationRow>(
          `SELECT application.id,
                  application.borrower_id,
                  borrower.full_name AS borrower_name,
                  application.loan_product_id,
                  product.name AS loan_product_name,
                  application.requested_principal,
                  application.payment_frequency,
                  application.requested_term_count,
                  application.paid_installments,
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
        const application = complete.rows[0];
        if (!application) throw new Error("LOAN_APPLICATION_NOT_FOUND_AFTER_PAYMENT");
        await client.query(
          `INSERT INTO audit_events
             (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
           VALUES ($1, $2, 'loan_payment.recorded', 'loan_application', $3, $4,
                   jsonb_build_object('installmentNumber', $5, 'amount', $6, 'status', $7))`,
          [
            tenantId,
            actor.userId,
            applicationId,
            input.requestId,
            input.installmentNumber,
            period.installment,
            nextStatus,
          ],
        );
        return {
          status: "recorded",
          application: mapApplication(application),
          amount: period.installment,
        };
      });
    },

    async renewApplication(actor, tenantId, applicationId, input): Promise<LoanRenewalResult> {
      if (!canManageApplications(actor)) return { status: "forbidden" };
      return withTransaction(actor, tenantId, async (client) => {
        const current = await client.query<{
          id: string;
          borrower_id: string;
          loan_product_id: string;
          requested_principal: string;
          payment_frequency: LoanApplication["paymentFrequency"];
          requested_term_count: number;
          paid_installments: number;
          purpose: string | null;
          status: LoanApplication["status"];
          created_at: Date;
          rate_basis: LoanProduct["rateBasis"];
          nominal_rate: string;
          documentation_fee_rate: string;
          principal_min: string;
          principal_max: string;
        }>(
          `SELECT application.id,
                  application.borrower_id,
                  application.loan_product_id,
                  application.requested_principal,
                  application.payment_frequency,
                  application.requested_term_count,
                  application.paid_installments,
                  application.purpose,
                  application.status,
                  application.created_at,
                  application.rate_basis,
                  application.nominal_rate,
                  application.documentation_fee_rate,
                  product.principal_min,
                  product.principal_max
             FROM loan_applications application
             JOIN loan_products product
               ON product.tenant_id = application.tenant_id
              AND product.id = application.loan_product_id
            WHERE application.tenant_id = $1 AND application.id = $2
            FOR UPDATE OF application`,
          [tenantId, applicationId],
        );
        const state = current.rows[0];
        if (!state) return { status: "not_found" };
        if (state.status !== "active" || state.paid_installments < 2) {
          return { status: "invalid_state" };
        }
        const preview = buildSchedulePreview({
          principal: state.requested_principal,
          termCount: state.requested_term_count,
          paymentFrequency: state.payment_frequency,
          rateBasis: state.rate_basis,
          nominalRate: state.nominal_rate,
          documentationFeeRate: state.documentation_fee_rate,
          startDate: state.created_at.toISOString().slice(0, 10),
        });
        const outstanding = preview.periods
          .slice(state.paid_installments)
          .reduce((sum, period) => sum + parseCents(period.principal), 0n);
        const excess = parseCents(input.excessAmount);
        const renewedPrincipal = formatCents(outstanding + excess);
        const amountCheck = await client.query<{ out_of_range: boolean }>(
          `SELECT ($3::numeric < $1::numeric OR $3::numeric > $2::numeric) AS out_of_range`,
          [state.principal_min, state.principal_max, renewedPrincipal],
        );
        if (amountCheck.rows[0]?.out_of_range) return { status: "amount_out_of_range" };
        const inserted = await client.query<{ id: string }>(
          `INSERT INTO loan_applications
             (tenant_id, borrower_id, loan_product_id, requested_principal,
              payment_frequency, requested_term_count, purpose, status, created_by, renewed_from_id,
              rate_basis, nominal_rate, documentation_fee_rate)
           VALUES ($1, $2, $3, $4::numeric, $5, $6, $7, 'active', $8, $9, $10, $11::numeric, $12::numeric)
           RETURNING id`,
          [
            tenantId,
            state.borrower_id,
            state.loan_product_id,
            renewedPrincipal,
            state.payment_frequency,
            state.requested_term_count,
            state.purpose,
            actor.userId,
            applicationId,
            state.rate_basis,
            state.nominal_rate,
            state.documentation_fee_rate,
          ],
        );
        const newId = inserted.rows[0]?.id;
        if (!newId) throw new Error("LOAN_RENEWAL_NOT_CREATED");
        await client.query(
          `UPDATE loan_applications
              SET status = 'paid', updated_at = now()
            WHERE tenant_id = $1 AND id = $2`,
          [tenantId, applicationId],
        );
        const complete = await client.query<LoanApplicationRow>(
          `SELECT application.id,
                  application.borrower_id,
                  borrower.full_name AS borrower_name,
                  application.loan_product_id,
                  product.name AS loan_product_name,
                  application.requested_principal,
                  application.payment_frequency,
                  application.requested_term_count,
                  application.paid_installments,
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
          [tenantId, newId],
        );
        const application = complete.rows[0];
        if (!application) throw new Error("LOAN_RENEWAL_NOT_FOUND_AFTER_INSERT");
        await client.query(
          `INSERT INTO audit_events
             (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
           VALUES ($1, $2, 'loan_application.renewed', 'loan_application', $3, $4,
                   jsonb_build_object('renewedFromId', $5, 'outstanding', $6,
                     'excessAmount', $7, 'renewedPrincipal', $8))`,
          [
            tenantId,
            actor.userId,
            newId,
            input.requestId,
            applicationId,
            formatCents(outstanding),
            input.excessAmount,
            renewedPrincipal,
          ],
        );
        return {
          status: "created",
          application: mapApplication(application),
          renewedPrincipal,
          excessAmount: input.excessAmount,
        };
      });
    },

    async submitApplicationForReview(
      actor,
      tenantId,
      applicationId,
      requestId,
    ): Promise<LoanApplicationReviewResult> {
      if (!canManageApplications(actor)) return { status: "forbidden" };
      return withTransaction(actor, tenantId, async (client) => {
        const current = await client.query<{
          status: LoanApplication["status"];
          borrower_verification_state: "manual_pending" | "reviewed" | "rejected";
          product_status: LoanProduct["status"];
        }>(
          `SELECT application.status,
                  identity.verification_state AS borrower_verification_state,
                  product.status AS product_status
             FROM loan_applications application
             JOIN borrower_identities identity
               ON identity.tenant_id = application.tenant_id
              AND identity.borrower_id = application.borrower_id
             JOIN loan_products product
               ON product.tenant_id = application.tenant_id
              AND product.id = application.loan_product_id
            WHERE application.tenant_id = $1 AND application.id = $2
            FOR UPDATE`,
          [tenantId, applicationId],
        );
        const state = current.rows[0];
        if (!state) return { status: "not_found" };
        if (state.status !== "draft") return { status: "invalid_state" };
        if (state.borrower_verification_state !== "reviewed") {
          return { status: "borrower_not_verified" };
        }
        if (!["under_review", "approved"].includes(state.product_status)) {
          return { status: "product_not_reviewed" };
        }
        const updated = await client.query<LoanApplicationRow>(
          `UPDATE loan_applications
              SET status = 'submitted', submitted_at = now(), updated_at = now()
            WHERE tenant_id = $1 AND id = $2
            RETURNING id, borrower_id, requested_principal, requested_term_count, purpose,
                      status, created_at, updated_at`,
          [tenantId, applicationId],
        );
        const row = updated.rows[0];
        if (!row) throw new Error("LOAN_APPLICATION_SUBMISSION_FAILED");
        const complete = await client.query<LoanApplicationRow>(
          `SELECT application.id,
                  application.borrower_id,
                  borrower.full_name AS borrower_name,
                  application.loan_product_id,
                  product.name AS loan_product_name,
                  application.requested_principal,
                  application.payment_frequency,
                  application.requested_term_count,
                  application.paid_installments,
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
        const application = complete.rows[0];
        if (!application) throw new Error("LOAN_APPLICATION_NOT_FOUND_AFTER_SUBMISSION");
        await client.query(
          `INSERT INTO audit_events
             (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
           VALUES ($1, $2, 'loan_application.submitted_for_review', 'loan_application', $3, $4,
                   jsonb_build_object('status', 'submitted'))`,
          [tenantId, actor.userId, applicationId, requestId],
        );
        return { status: "submitted", application: mapApplication(application) };
      });
    },

    async startApplicationReview(
      actor,
      tenantId,
      applicationId,
      requestId,
    ): Promise<LoanApplicationReviewStartResult> {
      if (!canReviewApplications(actor)) return { status: "forbidden" };
      return withTransaction(actor, tenantId, async (client) => {
        const current = await client.query<{ status: LoanApplication["status"] }>(
          `SELECT status
             FROM loan_applications
            WHERE tenant_id = $1 AND id = $2
            FOR UPDATE`,
          [tenantId, applicationId],
        );
        const state = current.rows[0];
        if (!state) return { status: "not_found" };
        if (state.status !== "submitted") return { status: "invalid_state" };
        await client.query(
          `UPDATE loan_applications
              SET status = 'under_review', reviewed_by = $3, updated_at = now()
            WHERE tenant_id = $1 AND id = $2`,
          [tenantId, applicationId, actor.userId],
        );
        const complete = await client.query<LoanApplicationRow>(
          `SELECT application.id,
                  application.borrower_id,
                  borrower.full_name AS borrower_name,
                  application.loan_product_id,
                  product.name AS loan_product_name,
                  application.requested_principal,
                  application.payment_frequency,
                  application.requested_term_count,
                  application.paid_installments,
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
        const application = complete.rows[0];
        if (!application) throw new Error("LOAN_APPLICATION_NOT_FOUND_AFTER_REVIEW_START");
        await client.query(
          `INSERT INTO audit_events
             (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
           VALUES ($1, $2, 'loan_application.review_started', 'loan_application', $3, $4,
                   jsonb_build_object('status', 'under_review'))`,
          [tenantId, actor.userId, applicationId, requestId],
        );
        return { status: "review_started", application: mapApplication(application) };
      });
    },
  };
}
