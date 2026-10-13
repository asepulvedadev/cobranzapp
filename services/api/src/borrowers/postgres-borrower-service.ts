import { randomUUID } from "node:crypto";
import type { Borrower, BorrowerDocument } from "@cobranzapp/contracts";
import type { Pool, PoolClient } from "pg";
import type { TenantActor } from "../tenancy/types.js";
import {
  borrowerDocumentLookupHmac,
  borrowerSharedDocumentLookupHmac,
  encryptBorrowerDocumentNumber,
  normalizeBorrowerDocumentNumber,
} from "./identity.js";
import type {
  BorrowerCreateInput,
  BorrowerCreateResult,
  BorrowerDocumentInput,
  BorrowerDocumentResult,
  BorrowerReviewInput,
  BorrowerReviewResult,
  BorrowerService,
  SharedClientVerification,
} from "./types.js";

type BorrowerRow = {
  id: string;
  full_name: string;
  status: Borrower["status"];
  phone: string;
  whatsapp_phone: string | null;
  home_address: string;
  work_address: string;
  profile_photo_object_key: string | null;
  consent_version: string;
  country: string;
  document_type: string;
  document_last4: string;
  verification_state: Borrower["identity"]["verificationState"];
  created_at: Date;
};

class DuplicateBorrowerIdentityError extends Error {
  constructor() {
    super("DUPLICATE_BORROWER_IDENTITY");
  }
}

async function loadBorrower(
  client: Pick<PoolClient, "query">,
  tenantId: string,
  borrowerId: string,
): Promise<Borrower | null> {
  const result = await client.query<BorrowerRow>(
    `SELECT borrower.id, borrower.full_name, borrower.status,
            borrower.phone, borrower.whatsapp_phone, borrower.home_address, borrower.work_address,
            borrower.profile_photo_object_key, borrower.consent_version,
            identity.country, identity.document_type, identity.document_last4,
            identity.verification_state, borrower.created_at
       FROM borrowers borrower
       JOIN borrower_identities identity
         ON identity.tenant_id = borrower.tenant_id AND identity.borrower_id = borrower.id
      WHERE borrower.tenant_id = $1 AND borrower.id = $2`,
    [tenantId, borrowerId],
  );
  const row = result.rows[0];
  if (!row) return null;
  const contacts = await client.query<{
    id: string;
    full_name: string;
    relationship: string;
    phone: string;
  }>(
    `SELECT id, full_name, relationship, phone
       FROM borrower_emergency_contacts
      WHERE tenant_id = $1 AND borrower_id = $2
      ORDER BY created_at ASC, id ASC`,
    [tenantId, borrowerId],
  );
  const documents = await client.query<{
    id: string;
    category: BorrowerDocument["category"];
    side: BorrowerDocument["side"];
    object_key: string;
    media_type: string;
    size_bytes: number;
    sha256: string;
    scan_status: BorrowerDocument["scanStatus"];
    created_at: Date;
  }>(
    `SELECT id, category, side, object_key, media_type, size_bytes, sha256, scan_status, created_at
       FROM borrower_documents
      WHERE tenant_id = $1 AND borrower_id = $2
      ORDER BY category ASC, side ASC NULLS LAST, created_at ASC`,
    [tenantId, borrowerId],
  );
  return {
    id: row.id,
    fullName: row.full_name,
    status: row.status,
    phone: row.phone,
    whatsappPhone: row.whatsapp_phone,
    homeAddress: row.home_address,
    workAddress: row.work_address,
    profilePhotoObjectKey: row.profile_photo_object_key,
    consentVersion: row.consent_version,
    identity: {
      country: row.country,
      documentType: row.document_type,
      documentLast4: row.document_last4,
      verificationState: row.verification_state,
    },
    emergencyContacts: contacts.rows.map((contact) => ({
      id: contact.id,
      fullName: contact.full_name,
      relationship: contact.relationship,
      phone: contact.phone,
    })),
    documents: documents.rows.map((document) => ({
      id: document.id,
      category: document.category,
      side: document.side,
      objectKey: document.object_key,
      mediaType: document.media_type,
      sizeBytes: document.size_bytes,
      sha256: document.sha256,
      scanStatus: document.scan_status,
      createdAt: document.created_at.toISOString(),
    })),
    createdAt: row.created_at.toISOString(),
  };
}

export function createPostgresBorrowerService(pool: Pool, identitySecret: string): BorrowerService {
  async function setActorContext(client: PoolClient, actor: TenantActor, tenantId: string) {
    await client.query("SELECT set_config('app.user_id', $1, true)", [actor.userId]);
    await client.query("SELECT set_config('app.platform_role', $1, true)", [
      actor.platformRole ?? "",
    ]);
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
    await client.query("SELECT set_config('app.tenant_role', $1, true)", [actor.tenantRole ?? ""]);
  }

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
    async list(actor, tenantId, query) {
      return withTransaction(actor, tenantId, async (client) => {
        const filter = `$1::text IS NULL OR borrower.full_name ILIKE '%' || $1 || '%' OR identity.document_last4 ILIKE '%' || $1 || '%'`;
        const count = await client.query<{ total: string }>(
          `SELECT count(*) AS total
             FROM borrowers borrower
             JOIN borrower_identities identity
               ON identity.tenant_id = borrower.tenant_id AND identity.borrower_id = borrower.id
            WHERE borrower.tenant_id = $2 AND (${filter})`,
          [query.search, tenantId],
        );
        const total = Number(count.rows[0]?.total ?? 0);
        const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
        const page = Math.min(query.page, totalPages);
        const summaryRows = await client.query<{
          verification_state: Borrower["identity"]["verificationState"];
          total: string;
        }>(
          `SELECT identity.verification_state, count(*) AS total
             FROM borrowers borrower
             JOIN borrower_identities identity
               ON identity.tenant_id = borrower.tenant_id AND identity.borrower_id = borrower.id
            WHERE borrower.tenant_id = $2 AND (${filter})
            GROUP BY identity.verification_state`,
          [query.search, tenantId],
        );
        const identitySummary = { pending: 0, reviewed: 0, rejected: 0 };
        for (const row of summaryRows.rows) {
          const key =
            row.verification_state === "manual_pending"
              ? "pending"
              : row.verification_state === "reviewed"
                ? "reviewed"
                : "rejected";
          identitySummary[key] = Number(row.total);
        }
        const statusRows = await client.query<{
          status: Borrower["status"];
          total: string;
        }>(
          `SELECT borrower.status, count(*) AS total
             FROM borrowers borrower
             JOIN borrower_identities identity
               ON identity.tenant_id = borrower.tenant_id AND identity.borrower_id = borrower.id
            WHERE borrower.tenant_id = $2 AND (${filter})
            GROUP BY borrower.status`,
          [query.search, tenantId],
        );
        const borrowerSummary = { active: 0, archived: 0 };
        for (const row of statusRows.rows) borrowerSummary[row.status] = Number(row.total);
        const rows = await client.query<BorrowerRow>(
          `SELECT borrower.id, borrower.full_name, borrower.status,
                  borrower.phone, borrower.whatsapp_phone, borrower.home_address, borrower.work_address,
                  borrower.profile_photo_object_key, borrower.consent_version,
                  identity.country, identity.document_type, identity.document_last4,
                  identity.verification_state, borrower.created_at
             FROM borrowers borrower
             JOIN borrower_identities identity
               ON identity.tenant_id = borrower.tenant_id AND identity.borrower_id = borrower.id
            WHERE borrower.tenant_id = $2 AND (${filter})
            ORDER BY borrower.created_at DESC, borrower.id DESC
            LIMIT $3 OFFSET $4`,
          [query.search, tenantId, query.pageSize, (page - 1) * query.pageSize],
        );
        const borrowers = await Promise.all(
          rows.rows.map((row) => loadBorrower(client, tenantId, row.id)),
        );
        return {
          borrowers: borrowers.filter((borrower): borrower is Borrower => borrower !== null),
          pagination: { page, pageSize: query.pageSize, total, totalPages },
          identitySummary,
          borrowerSummary,
        };
      });
    },

    async get(actor, tenantId, borrowerId) {
      return withTransaction(actor, tenantId, (client) =>
        loadBorrower(client, tenantId, borrowerId),
      );
    },

    async create(actor, tenantId, input: BorrowerCreateInput): Promise<BorrowerCreateResult> {
      const normalizedNumber = normalizeBorrowerDocumentNumber(input.documentNumber);
      try {
        return await withTransaction(actor, tenantId, async (client) => {
          const borrowerId = randomUUID();
          const profileKey = input.profilePhotoObjectKey;
          if (
            profileKey &&
            !profileKey.startsWith(`tenant/${tenantId}/borrowers/${borrowerId}/profile/`)
          ) {
            return { status: "invalid_object_key" };
          }
          for (const document of input.documents) {
            const expectedPrefix = `tenant/${tenantId}/borrowers/${borrowerId}/documents/`;
            if (!document.objectKey.startsWith(expectedPrefix)) {
              return { status: "invalid_object_key" };
            }
            if (document.category === "identity" && !document.side) {
              return { status: "invalid_object_key" };
            }
            if (document.category === "profile_photo" && document.side) {
              return { status: "invalid_object_key" };
            }
          }
          const identityHmac = borrowerDocumentLookupHmac(identitySecret, {
            tenantId,
            country: input.country,
            documentType: input.documentType,
            documentNumber: normalizedNumber,
          });
          const sharedLookupHmac = borrowerSharedDocumentLookupHmac(identitySecret, {
            country: input.country,
            documentType: input.documentType,
            documentNumber: normalizedNumber,
          });
          try {
            await client.query(
              `INSERT INTO borrowers
               (tenant_id, id, full_name, phone, whatsapp_phone, home_address, work_address,
                profile_photo_object_key, consent_version, consent_evidence_ref, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
              [
                tenantId,
                borrowerId,
                input.fullName,
                input.phone,
                input.whatsappPhone ?? input.phone,
                input.homeAddress,
                input.workAddress,
                profileKey,
                input.consentVersion,
                input.consentEvidenceRef,
                actor.userId,
              ],
            );
            await client.query(
              `INSERT INTO borrower_identities
               (tenant_id, borrower_id, country, document_type, document_number_ciphertext,
                document_lookup_hmac, shared_lookup_hmac, document_last4)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [
                tenantId,
                borrowerId,
                input.country.toUpperCase(),
                input.documentType.toUpperCase(),
                encryptBorrowerDocumentNumber(identitySecret, normalizedNumber),
                identityHmac,
                sharedLookupHmac,
                normalizedNumber.slice(-4),
              ],
            );
            for (const contact of input.emergencyContacts) {
              await client.query(
                `INSERT INTO borrower_emergency_contacts
                 (tenant_id, borrower_id, full_name, relationship, phone)
               VALUES ($1, $2, $3, $4, $5)`,
                [tenantId, borrowerId, contact.fullName, contact.relationship, contact.phone],
              );
            }
            for (const document of input.documents) {
              await client.query(
                `INSERT INTO borrower_documents
                 (tenant_id, borrower_id, category, side, object_key, media_type, size_bytes, sha256, created_by)
               VALUES ($1, $2, $3, $4, $5, $6, $7, lower($8), $9)`,
                [
                  tenantId,
                  borrowerId,
                  document.category,
                  document.side,
                  document.objectKey,
                  document.mediaType,
                  document.sizeBytes,
                  document.sha256,
                  actor.userId,
                ],
              );
            }
            await client.query(
              `INSERT INTO audit_events
               (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
             VALUES ($1, $2, 'borrower.created', 'borrower', $3, $4, $5::jsonb)`,
              [
                tenantId,
                actor.userId,
                borrowerId,
                input.requestId,
                JSON.stringify({
                  documentType: input.documentType,
                  country: input.country,
                  documentSides: input.documents.filter(
                    (document) => document.category === "identity",
                  ).length,
                  emergencyContactCount: input.emergencyContacts.length,
                }),
              ],
            );
          } catch (error) {
            if (error && typeof error === "object" && "code" in error && error.code === "23505") {
              throw new DuplicateBorrowerIdentityError();
            }
            throw error;
          }
          const borrower = await loadBorrower(client, tenantId, borrowerId);
          if (!borrower) return { status: "not_found" };
          return { status: "created", borrower };
        });
      } catch (error) {
        if (error instanceof DuplicateBorrowerIdentityError)
          return { status: "duplicate_identity" };
        throw error;
      }
    },

    async review(
      actor,
      tenantId,
      borrowerId,
      input: BorrowerReviewInput,
    ): Promise<BorrowerReviewResult> {
      if (actor.tenantRole !== "owner" && actor.tenantRole !== "supervisor") {
        return { status: "forbidden" };
      }
      return withTransaction(actor, tenantId, async (client) => {
        const borrower = await client.query<{ id: string }>(
          `SELECT id FROM borrowers WHERE tenant_id = $1 AND id = $2`,
          [tenantId, borrowerId],
        );
        if (!borrower.rows[0]) return { status: "not_found" };

        const acceptedDocuments = await client.query<{
          identity_front: boolean;
          identity_back: boolean;
          profile_photo: boolean;
        }>(
          `SELECT
             COALESCE(bool_or(category = 'identity' AND side = 'front' AND scan_status = 'accepted'), false) AS identity_front,
             COALESCE(bool_or(category = 'identity' AND side = 'back' AND scan_status = 'accepted'), false) AS identity_back,
             COALESCE(bool_or(category = 'profile_photo' AND scan_status = 'accepted'), false) AS profile_photo
             FROM borrower_documents
            WHERE tenant_id = $1 AND borrower_id = $2`,
          [tenantId, borrowerId],
        );
        const accepted = acceptedDocuments.rows[0] ?? {
          identity_front: false,
          identity_back: false,
          profile_photo: false,
        };
        const missing: Array<"identity_front" | "identity_back" | "profile_photo"> = [];
        if (input.decision === "reviewed") {
          if (!accepted.identity_front || !input.identityFrontConfirmed)
            missing.push("identity_front");
          if (!accepted.identity_back || !input.identityBackConfirmed)
            missing.push("identity_back");
          if (!accepted.profile_photo || !input.profilePhotoConfirmed)
            missing.push("profile_photo");
          if (missing.length) return { status: "missing_documents", missing };
          if (!input.legalNameConfirmed) return { status: "missing_documents", missing: [] };
        }

        await client.query(
          `UPDATE borrower_identities
              SET verification_state = $3, updated_at = now()
            WHERE tenant_id = $1 AND borrower_id = $2`,
          [tenantId, borrowerId, input.decision],
        );
        await client.query(
          `INSERT INTO borrower_identity_reviews
             (tenant_id, borrower_id, reviewer_user_id, decision, notes, checklist)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
          [
            tenantId,
            borrowerId,
            actor.userId,
            input.decision,
            input.notes,
            JSON.stringify({
              legalNameConfirmed: input.legalNameConfirmed,
              identityFrontConfirmed: input.identityFrontConfirmed,
              identityBackConfirmed: input.identityBackConfirmed,
              profilePhotoConfirmed: input.profilePhotoConfirmed,
            }),
          ],
        );
        await client.query(
          `INSERT INTO audit_events
             (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
           VALUES ($1, $2, 'borrower.identity_reviewed', 'borrower', $3, $4, $5::jsonb)`,
          [
            tenantId,
            actor.userId,
            borrowerId,
            input.requestId,
            JSON.stringify({ decision: input.decision }),
          ],
        );
        const updated = await loadBorrower(client, tenantId, borrowerId);
        return updated ? { status: "updated", borrower: updated } : { status: "not_found" };
      });
    },

    async addDocument(
      actor,
      tenantId,
      borrowerId,
      input: BorrowerDocumentInput,
    ): Promise<BorrowerDocumentResult> {
      if (!actor.tenantRole || !["owner", "supervisor", "collector"].includes(actor.tenantRole)) {
        return { status: "forbidden" };
      }
      const expectedPrefix = `tenant/${tenantId}/borrowers/${borrowerId}/quarantine/`;
      if (!input.objectKey.startsWith(expectedPrefix)) return { status: "invalid_object_key" };
      return withTransaction(actor, tenantId, async (client) => {
        const borrower = await client.query<{ id: string }>(
          `SELECT id FROM borrowers WHERE tenant_id = $1 AND id = $2`,
          [tenantId, borrowerId],
        );
        if (!borrower.rows[0]) return { status: "not_found" };
        try {
          const inserted = await client.query<{
            id: string;
            category: Borrower["documents"][number]["category"];
            side: Borrower["documents"][number]["side"];
            object_key: string;
            media_type: string;
            size_bytes: number;
            sha256: string;
            scan_status: Borrower["documents"][number]["scanStatus"];
            created_at: Date;
          }>(
            `INSERT INTO borrower_documents
               (tenant_id, borrower_id, category, side, object_key, media_type, size_bytes, sha256, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, lower($8), $9)
             RETURNING id, category, side, object_key, media_type, size_bytes, sha256, scan_status, created_at`,
            [
              tenantId,
              borrowerId,
              input.category,
              input.side,
              input.objectKey,
              input.mediaType,
              input.sizeBytes,
              input.sha256,
              actor.userId,
            ],
          );
          const row = inserted.rows[0];
          if (!row) return { status: "not_found" };
          if (input.category === "profile_photo") {
            await client.query(
              `UPDATE borrowers SET profile_photo_object_key = $3, updated_at = now()
                 WHERE tenant_id = $1 AND id = $2`,
              [tenantId, borrowerId, input.objectKey],
            );
          }
          await client.query(
            `INSERT INTO audit_events
               (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
             VALUES ($1, $2, 'borrower.document_quarantined', 'borrower_document', $3, $4, $5::jsonb)`,
            [
              tenantId,
              actor.userId,
              row.id,
              input.requestId,
              JSON.stringify({ category: input.category, side: input.side, scanStatus: "pending" }),
            ],
          );
          return {
            status: "created",
            document: {
              id: row.id,
              category: row.category,
              side: row.side,
              objectKey: row.object_key,
              mediaType: row.media_type,
              sizeBytes: row.size_bytes,
              sha256: row.sha256,
              scanStatus: row.scan_status,
              createdAt: row.created_at.toISOString(),
            },
          };
        } catch (error) {
          if (error && typeof error === "object" && "code" in error && error.code === "23505") {
            return { status: "duplicate" };
          }
          throw error;
        }
      });
    },

    async verifyShared(
      actor,
      tenantId,
      documentNumber,
      requestId,
    ): Promise<SharedClientVerification> {
      const sharedLookupHmac = borrowerSharedDocumentLookupHmac(identitySecret, {
        country: "CO",
        documentType: "CC",
        documentNumber,
      });
      return withTransaction(actor, tenantId, async (client) => {
        const result = await client.query<{
          full_name: string | null;
          active_credit_count: number;
          payer_rating: SharedClientVerification["payerRating"];
          negative_report: boolean;
        }>("SELECT * FROM shared_client_verification($1)", [sharedLookupHmac]);
        const row = result.rows[0];
        const verification: SharedClientVerification = row
          ? {
              registered: true,
              fullName: row.full_name,
              activeCreditCount: Number(row.active_credit_count),
              payerRating: row.payer_rating,
              negativeReport: row.negative_report,
            }
          : {
              registered: false,
              fullName: null,
              activeCreditCount: 0,
              payerRating: "no_data",
              negativeReport: false,
            };
        await client.query(
          `INSERT INTO audit_events
             (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
           VALUES ($1, $2, 'borrower.shared_verification_searched', 'borrower_identity', NULL, $3, $4::jsonb)`,
          [
            tenantId,
            actor.userId,
            requestId,
            JSON.stringify({ registered: verification.registered }),
          ],
        );
        return verification;
      });
    },
  };
}
