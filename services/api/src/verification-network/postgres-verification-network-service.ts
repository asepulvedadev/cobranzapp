import { createHash, randomBytes } from "node:crypto";
import type {
  VerificationNetworkAssertionRequest,
  VerificationNetworkConsentRequest,
  VerificationNetworkQueryResponse,
} from "@cobranzapp/contracts";
import type { Pool, PoolClient } from "pg";
import type { TenantActor } from "../tenancy/types.js";
import { verificationIdentityKey } from "./identity-key.js";
import type {
  VerificationNetworkAssertionResult,
  VerificationNetworkConsentResult,
  VerificationNetworkCorrectionResult,
  VerificationNetworkService,
} from "./types.js";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest();
}

function consentToken() {
  return randomBytes(32).toString("base64url");
}

async function setActorContext(client: PoolClient, actor: TenantActor, tenantId: string) {
  await client.query("SELECT set_config('app.user_id', $1, true)", [actor.userId]);
  await client.query("SELECT set_config('app.platform_role', $1, true)", [
    actor.platformRole ?? "",
  ]);
  await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
  await client.query("SELECT set_config('app.tenant_role', $1, true)", [actor.tenantRole ?? ""]);
}

function parseIdentity(
  input: {
    country: string;
    documentType: string;
    documentNumber: string;
  },
  secret: string,
) {
  return verificationIdentityKey(
    {
      country: input.country,
      documentType: input.documentType,
      documentNumber: input.documentNumber,
    },
    secret,
  );
}

export function createPostgresVerificationNetworkService(
  pool: Pool,
  hmacSecret: string | undefined,
): VerificationNetworkService | undefined {
  if (!hmacSecret) return undefined;

  async function withTransaction<T>(
    actor: TenantActor,
    tenantId: string,
    work: (client: PoolClient) => Promise<T>,
  ) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await setActorContext(client, actor, tenantId);
      const value = await work(client);
      await client.query("COMMIT");
      return value;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  return {
    async createConsent(actor, tenantId, input) {
      const key = parseIdentity(input, hmacSecret);
      const token = consentToken();
      const result = await withTransaction(actor, tenantId, async (client) => {
        const subject = await client.query<{ id: string }>(
          `INSERT INTO verification_network_subjects (identity_key)
           VALUES ($1)
           ON CONFLICT (identity_key) DO UPDATE SET identity_key = EXCLUDED.identity_key
           RETURNING id`,
          [key],
        );
        const subjectId = subject.rows[0]?.id;
        if (!subjectId) throw new Error("VERIFICATION_SUBJECT_NOT_CREATED");
        const consent = await client.query<{
          id: string;
          expires_at: Date;
          purpose: VerificationNetworkConsentRequest["purpose"];
          policy_version: string;
        }>(
          `INSERT INTO verification_network_consents
             (subject_id, tenant_id, granted_by, token_hash, purpose, policy_version, evidence_ref, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (subject_id, tenant_id) DO UPDATE SET
             granted_by = EXCLUDED.granted_by,
             token_hash = EXCLUDED.token_hash,
             purpose = EXCLUDED.purpose,
             policy_version = EXCLUDED.policy_version,
             evidence_ref = EXCLUDED.evidence_ref,
             granted_at = now(),
             expires_at = EXCLUDED.expires_at,
             revoked_at = NULL
           RETURNING id, expires_at, purpose, policy_version`,
          [
            subjectId,
            tenantId,
            actor.userId,
            hashToken(token),
            input.purpose,
            input.policyVersion,
            input.evidenceRef,
            input.expiresAt,
          ],
        );
        const row = consent.rows[0];
        if (!row) throw new Error("VERIFICATION_CONSENT_NOT_CREATED");
        await client.query(
          `INSERT INTO audit_events (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
           VALUES ($1, $2, 'verification.consent_granted', 'verification_network_consent', $3, $4,
                   jsonb_build_object('purpose', $5::text, 'policyVersion', $6::text))`,
          [tenantId, actor.userId, row.id, input.requestId, input.purpose, input.policyVersion],
        );
        return {
          id: row.id,
          expiresAt: row.expires_at.toISOString(),
          policyVersion: row.policy_version,
          purpose: row.purpose,
          consentToken: token,
        } satisfies VerificationNetworkConsentResult;
      });
      return { status: "ok", value: result };
    },

    async revokeConsent(actor, tenantId, consentId, requestId) {
      const result = await withTransaction(actor, tenantId, async (client) => {
        const revoked = await client.query<{ id: string }>(
          `UPDATE verification_network_consents
              SET revoked_at = now()
            WHERE id = $1 AND tenant_id = $2 AND revoked_at IS NULL
            RETURNING id`,
          [consentId, tenantId],
        );
        const row = revoked.rows[0];
        if (!row) return false;
        await client.query(
          `INSERT INTO audit_events (tenant_id, actor_user_id, action, target_type, target_id, request_id)
           VALUES ($1, $2, 'verification.consent_revoked', 'verification_network_consent', $3, $4)`,
          [tenantId, actor.userId, row.id, requestId],
        );
        return true;
      });
      return result ? { status: "ok", value: null } : { status: "not_found" };
    },

    async query(actor, tenantId, input) {
      const key = parseIdentity(input, hmacSecret);
      const result = await withTransaction(actor, tenantId, async (client) => {
        const consent = await client.query<{ id: string; subject_id: string }>(
          `SELECT consent.id, consent.subject_id
             FROM verification_network_consents consent
             JOIN verification_network_subjects subject ON subject.id = consent.subject_id
            WHERE consent.tenant_id = $1
              AND subject.identity_key = $2
              AND consent.token_hash = $3
              AND consent.revoked_at IS NULL
              AND consent.expires_at > now()`,
          [tenantId, key, hashToken(input.consentToken)],
        );
        const consentRow = consent.rows[0];
        if (!consentRow) {
          await client.query(
            `INSERT INTO verification_network_queries
             (requester_tenant_id, requester_user_id, purpose, result_state)
             VALUES ($1, $2, $3, 'no_consent')`,
            [tenantId, actor.userId, input.purpose],
          );
          return {
            result: "no_consent",
            categories: [] as VerificationNetworkQueryResponse["categories"],
            activeObservations: 0,
            lastUpdatedAt: null,
            correctionAvailable: false,
          } satisfies VerificationNetworkQueryResponse;
        }
        const assertions = await client.query<{
          category: "late_payment" | "payment_default";
          status: "active" | "disputed";
          created_at: Date;
        }>(
          `SELECT category, status, created_at
             FROM verification_network_assertions
            WHERE subject_id = $1
              AND status IN ('active', 'disputed')
              AND expires_at > now()
            ORDER BY created_at DESC`,
          [consentRow.subject_id],
        );
        const rows = assertions.rows;
        const categories = [...new Set(rows.map((row) => row.category))];
        const resultState = rows.some((row) => row.status === "disputed")
          ? "disputed"
          : rows.length
            ? "reported"
            : "no_observation";
        await client.query(
          `INSERT INTO verification_network_queries
           (subject_id, requester_tenant_id, requester_user_id, consent_id, purpose, result_state)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            consentRow.subject_id,
            tenantId,
            actor.userId,
            consentRow.id,
            input.purpose,
            resultState,
          ],
        );
        return {
          result: resultState,
          categories,
          activeObservations: rows.length,
          lastUpdatedAt: rows[0]?.created_at.toISOString() ?? null,
          correctionAvailable: true,
        } satisfies VerificationNetworkQueryResponse;
      });
      return { status: "ok", value: result };
    },

    async publishAssertion(actor, tenantId, input) {
      const key = parseIdentity(input, hmacSecret);
      const result = await withTransaction(actor, tenantId, async (client) => {
        const consent = await client.query<{ subject_id: string }>(
          `SELECT consent.subject_id
             FROM verification_network_consents consent
             JOIN verification_network_subjects subject ON subject.id = consent.subject_id
            WHERE consent.tenant_id = $1
              AND subject.identity_key = $2
              AND consent.token_hash = $3
              AND consent.revoked_at IS NULL
              AND consent.expires_at > now()`,
          [tenantId, key, hashToken(input.consentToken)],
        );
        const subjectId = consent.rows[0]?.subject_id;
        if (!subjectId) return null;
        const assertion = await client.query<{
          id: string;
          category: VerificationNetworkAssertionRequest["category"];
          expires_at: Date;
        }>(
          `INSERT INTO verification_network_assertions
             (subject_id, source_tenant_id, published_by, category, observed_from, observed_to, evidence_ref, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id, category, expires_at`,
          [
            subjectId,
            tenantId,
            actor.userId,
            input.category,
            input.observedFrom,
            input.observedTo,
            input.evidenceRef,
            input.expiresAt,
          ],
        );
        const row = assertion.rows[0];
        if (!row) throw new Error("VERIFICATION_ASSERTION_NOT_CREATED");
        await client.query(
          `INSERT INTO audit_events (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
           VALUES ($1, $2, 'verification.assertion_published', 'verification_network_assertion', $3, $4,
                   jsonb_build_object('category', $5::text))`,
          [tenantId, actor.userId, row.id, input.requestId, row.category],
        );
        return {
          id: row.id,
          category: row.category,
          status: "active",
          expiresAt: row.expires_at.toISOString(),
        } satisfies VerificationNetworkAssertionResult;
      });
      if (!result) return { status: "no_consent" };
      return { status: "ok", value: result };
    },

    async createCorrection(actor, tenantId, input) {
      const key = parseIdentity(input, hmacSecret);
      const result = await withTransaction(actor, tenantId, async (client) => {
        const consent = await client.query<{ subject_id: string }>(
          `SELECT consent.subject_id
             FROM verification_network_consents consent
             JOIN verification_network_subjects subject ON subject.id = consent.subject_id
            WHERE consent.tenant_id = $1
              AND subject.identity_key = $2
              AND consent.token_hash = $3
              AND consent.revoked_at IS NULL
              AND consent.expires_at > now()`,
          [tenantId, key, hashToken(input.consentToken)],
        );
        const subjectId = consent.rows[0]?.subject_id;
        if (!subjectId) return null;
        const correction = await client.query<{ id: string }>(
          `INSERT INTO verification_network_corrections
             (subject_id, assertion_id, requester_tenant_id, message)
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
          [subjectId, input.assertionId, tenantId, input.message],
        );
        const row = correction.rows[0];
        if (!row) throw new Error("VERIFICATION_CORRECTION_NOT_CREATED");
        await client.query(
          `INSERT INTO audit_events (tenant_id, actor_user_id, action, target_type, target_id, request_id)
           VALUES ($1, $2, 'verification.correction_opened', 'verification_network_correction', $3, $4)`,
          [tenantId, actor.userId, row.id, input.requestId],
        );
        return { id: row.id, status: "open" } satisfies VerificationNetworkCorrectionResult;
      });
      if (!result) return { status: "no_consent" };
      return { status: "ok", value: result };
    },
  };
}
