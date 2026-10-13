import { randomUUID } from "node:crypto";
import type { Borrower, BorrowerDocument, BorrowerOcrExtraction } from "@cobranzapp/contracts";
import type { Pool, PoolClient } from "pg";
import type { TenantActor } from "../tenancy/types.js";
import {
  borrowerDocumentLookupHmac,
  borrowerSharedDocumentLookupHmac,
  decryptBorrowerOcrFields,
  encryptBorrowerDocumentNumber,
  normalizeBorrowerAddress,
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
  home_address_status: Borrower["homeAddressStatus"];
  work_address_status: Borrower["workAddressStatus"];
  profile_photo_object_key: string | null;
  consent_version: string;
  country: string;
  document_type: string;
  document_last4: string;
  verification_state: Borrower["identity"]["verificationState"];
  created_at: Date;
};

type OcrRow = {
  id: string;
  document_id: string;
  category: BorrowerDocument["category"];
  side: BorrowerDocument["side"];
  status: BorrowerOcrExtraction["status"];
  fields_ciphertext: string | null;
  confidence: number | string | null;
  model_name: string;
  error_code: string | null;
  reviewed_at: Date | null;
  created_at: Date;
  updated_at: Date;
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
            borrower.home_address_status, borrower.work_address_status,
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
    homeAddressStatus: row.home_address_status,
    workAddressStatus: row.work_address_status,
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

function mapOcrRow(row: OcrRow, identitySecret: string): BorrowerOcrExtraction {
  let fields: BorrowerOcrExtraction["fields"] = null;
  if (row.fields_ciphertext) {
    try {
      fields = decryptBorrowerOcrFields(identitySecret, row.fields_ciphertext);
    } catch {
      fields = null;
    }
  }
  return {
    id: row.id,
    documentId: row.document_id,
    category: row.category,
    side: row.side,
    status: row.status,
    fields,
    confidence: row.confidence === null ? null : Number(row.confidence),
    modelName: row.model_name,
    errorCode: row.error_code,
    reviewedAt: row.reviewed_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
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

  async function enqueueDocumentOcr(
    client: Pick<PoolClient, "query">,
    input: {
      tenantId: string;
      borrowerId: string;
      documentId: string;
      objectKey: string;
      mediaType: string;
      category: BorrowerDocument["category"];
      side: BorrowerDocument["side"];
    },
  ) {
    if (input.category !== "identity") return;
    const extraction = await client.query<{ id: string }>(
      `INSERT INTO borrower_document_ocr_extractions
         (tenant_id, borrower_id, document_id, status, model_name)
       VALUES ($1, $2, $3, 'pending', 'tesseract-spa-v1')
       ON CONFLICT (tenant_id, borrower_id, document_id) DO UPDATE
         SET status = CASE
           WHEN borrower_document_ocr_extractions.status IN ('failed', 'rejected') THEN 'pending'
           ELSE borrower_document_ocr_extractions.status
         END,
         updated_at = now()
       RETURNING id`,
      [input.tenantId, input.borrowerId, input.documentId],
    );
    const extractionId = extraction.rows[0]?.id;
    if (!extractionId) return;
    await client.query(
      `INSERT INTO outbox_events
         (tenant_id, event_type, aggregate_type, aggregate_id, idempotency_key, payload)
       VALUES ($1, 'borrower.document.ocr_requested', 'borrower_document', $2, $3, $4::jsonb)
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [
        input.tenantId,
        input.documentId,
        `borrower-document-ocr:${input.tenantId}:${input.documentId}`,
        JSON.stringify({
          extractionId,
          borrowerId: input.borrowerId,
          documentId: input.documentId,
          objectKey: input.objectKey,
          mediaType: input.mediaType,
          category: input.category,
          side: input.side,
        }),
      ],
    );
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
                  borrower.home_address_status, borrower.work_address_status,
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
      const homeAddress = normalizeBorrowerAddress(input.homeAddress);
      const workAddress = normalizeBorrowerAddress(input.workAddress);
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
                home_address_status, work_address_status, home_address_confirmed_at,
                work_address_confirmed_at, home_address_confirmed_by, work_address_confirmed_by,
                profile_photo_object_key, consent_version, consent_evidence_ref, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7,
                     CASE WHEN $8 THEN 'confirmed' ELSE 'pending' END,
                     CASE WHEN $9 THEN 'confirmed' ELSE 'pending' END,
                     CASE WHEN $8 THEN now() ELSE NULL END,
                     CASE WHEN $9 THEN now() ELSE NULL END,
                     CASE WHEN $8 THEN $10 ELSE NULL END,
                     CASE WHEN $9 THEN $10 ELSE NULL END,
                     $11, $12, $13, $10)`,
              [
                tenantId,
                borrowerId,
                input.fullName,
                input.phone,
                input.whatsappPhone ?? input.phone,
                homeAddress,
                workAddress,
                input.homeAddressConfirmed ?? false,
                input.workAddressConfirmed ?? false,
                actor.userId,
                profileKey,
                input.consentVersion,
                input.consentEvidenceRef,
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
              const inserted = await client.query<{ id: string }>(
                `INSERT INTO borrower_documents
                 (tenant_id, borrower_id, category, side, object_key, media_type, size_bytes, sha256, created_by)
               VALUES ($1, $2, $3, $4, $5, $6, $7, lower($8), $9)
               RETURNING id`,
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
              const documentId = inserted.rows[0]?.id;
              if (documentId) {
                await enqueueDocumentOcr(client, {
                  tenantId,
                  borrowerId,
                  documentId,
                  objectKey: document.objectKey,
                  mediaType: document.mediaType,
                  category: document.category,
                  side: document.side,
                });
              }
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
          await enqueueDocumentOcr(client, {
            tenantId,
            borrowerId,
            documentId: row.id,
            objectKey: row.object_key,
            mediaType: row.media_type,
            category: row.category,
            side: row.side,
          });
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

    async listOcr(actor, tenantId, borrowerId) {
      return withTransaction(actor, tenantId, async (client) => {
        const result = await client.query<OcrRow>(
          `SELECT extraction.id, extraction.document_id, document.category, document.side,
                  extraction.status, extraction.fields_ciphertext, extraction.confidence,
                  extraction.model_name, extraction.error_code, extraction.reviewed_at,
                  extraction.created_at, extraction.updated_at
             FROM borrower_document_ocr_extractions extraction
             JOIN borrower_documents document
               ON document.tenant_id = extraction.tenant_id
              AND document.borrower_id = extraction.borrower_id
              AND document.id = extraction.document_id
            WHERE extraction.tenant_id = $1 AND extraction.borrower_id = $2
            ORDER BY extraction.created_at ASC, extraction.id ASC`,
          [tenantId, borrowerId],
        );
        return result.rows.map((row) => mapOcrRow(row, identitySecret));
      });
    },

    async confirmOcr(actor, tenantId, borrowerId, input) {
      if (!actor.tenantRole || !["owner", "supervisor", "collector"].includes(actor.tenantRole)) {
        return { status: "forbidden" };
      }
      return withTransaction(actor, tenantId, async (client) => {
        const extractionResult = await client.query<OcrRow>(
          `SELECT extraction.id, extraction.document_id, document.category, document.side,
                  extraction.status, extraction.fields_ciphertext, extraction.confidence,
                  extraction.model_name, extraction.error_code, extraction.reviewed_at,
                  extraction.created_at, extraction.updated_at
             FROM borrower_document_ocr_extractions extraction
             JOIN borrower_documents document
               ON document.tenant_id = extraction.tenant_id
              AND document.borrower_id = extraction.borrower_id
              AND document.id = extraction.document_id
            WHERE extraction.tenant_id = $1 AND extraction.borrower_id = $2 AND extraction.id = $3
            FOR UPDATE`,
          [tenantId, borrowerId, input.extractionId],
        );
        const extraction = extractionResult.rows[0];
        if (!extraction) return { status: "not_found" };
        if (!extraction.fields_ciphertext && !input.fullName && !input.documentNumber) {
          return { status: "invalid_extraction" };
        }
        const borrower = await client.query<{ id: string }>(
          `SELECT id FROM borrowers WHERE tenant_id = $1 AND id = $2 FOR UPDATE`,
          [tenantId, borrowerId],
        );
        if (!borrower.rows[0]) return { status: "not_found" };
        let candidate = extraction.fields_ciphertext
          ? decryptBorrowerOcrFields(identitySecret, extraction.fields_ciphertext)
          : { fullName: null, documentNumber: null, country: null, documentType: null };
        candidate = {
          ...candidate,
          fullName: input.fullName ?? candidate.fullName,
          documentNumber: input.documentNumber ?? candidate.documentNumber,
        };
        if (candidate.fullName) {
          await client.query(
            `UPDATE borrowers SET full_name = $3, updated_at = now()
               WHERE tenant_id = $1 AND id = $2`,
            [tenantId, borrowerId, candidate.fullName],
          );
        }
        if (candidate.documentNumber) {
          const normalized = normalizeBorrowerDocumentNumber(candidate.documentNumber);
          const identity = await client.query<{
            country: string;
            document_type: string;
          }>(
            `SELECT country, document_type FROM borrower_identities
              WHERE tenant_id = $1 AND borrower_id = $2 FOR UPDATE`,
            [tenantId, borrowerId],
          );
          const currentIdentity = identity.rows[0];
          if (!currentIdentity) return { status: "not_found" };
          const lookup = borrowerDocumentLookupHmac(identitySecret, {
            tenantId,
            country: currentIdentity.country,
            documentType: currentIdentity.document_type,
            documentNumber: normalized,
          });
          const sharedLookup = borrowerSharedDocumentLookupHmac(identitySecret, {
            country: currentIdentity.country,
            documentType: currentIdentity.document_type,
            documentNumber: normalized,
          });
          await client.query(
            `UPDATE borrower_identities
                SET document_number_ciphertext = $3,
                    document_lookup_hmac = $4,
                    shared_lookup_hmac = $5,
                    document_last4 = $6,
                    updated_at = now()
              WHERE tenant_id = $1 AND borrower_id = $2`,
            [
              tenantId,
              borrowerId,
              encryptBorrowerDocumentNumber(identitySecret, normalized),
              lookup,
              sharedLookup,
              normalized.slice(-4),
            ],
          );
        }
        await client.query(
          `UPDATE borrower_document_ocr_extractions
              SET status = 'confirmed', reviewed_by = $4, reviewed_at = now(), updated_at = now()
            WHERE tenant_id = $1 AND borrower_id = $2 AND id = $3`,
          [tenantId, borrowerId, input.extractionId, actor.userId],
        );
        await client.query(
          `INSERT INTO audit_events
             (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
           VALUES ($1, $2, 'borrower.ocr_confirmed', 'borrower', $3, $4, $5::jsonb)`,
          [
            tenantId,
            actor.userId,
            borrowerId,
            input.requestId,
            JSON.stringify({
              extractionId: input.extractionId,
              fields: [
                ...(candidate.fullName ? ["fullName"] : []),
                ...(candidate.documentNumber ? ["documentNumber"] : []),
              ],
            }),
          ],
        );
        const updatedBorrower = await loadBorrower(client, tenantId, borrowerId);
        if (!updatedBorrower) return { status: "not_found" };
        const updatedExtraction = await client.query<OcrRow>(
          `SELECT extraction.id, extraction.document_id, document.category, document.side,
                  extraction.status, extraction.fields_ciphertext, extraction.confidence,
                  extraction.model_name, extraction.error_code, extraction.reviewed_at,
                  extraction.created_at, extraction.updated_at
             FROM borrower_document_ocr_extractions extraction
             JOIN borrower_documents document
               ON document.tenant_id = extraction.tenant_id
              AND document.borrower_id = extraction.borrower_id
              AND document.id = extraction.document_id
            WHERE extraction.tenant_id = $1 AND extraction.borrower_id = $2 AND extraction.id = $3`,
          [tenantId, borrowerId, input.extractionId],
        );
        const updated = updatedExtraction.rows[0];
        if (!updated) return { status: "not_found" };
        return {
          status: "updated",
          borrower: updatedBorrower,
          extraction: mapOcrRow(updated, identitySecret),
        };
      });
    },

    async retryOcr(actor, tenantId, borrowerId, extractionId, requestId) {
      if (!actor.tenantRole || !["owner", "supervisor", "collector"].includes(actor.tenantRole)) {
        return { status: "forbidden" };
      }
      return withTransaction(actor, tenantId, async (client) => {
        const result = await client.query<OcrRow>(
          `SELECT extraction.id, extraction.document_id, document.category, document.side,
                  extraction.status, extraction.fields_ciphertext, extraction.confidence,
                  extraction.model_name, extraction.error_code, extraction.reviewed_at,
                  extraction.created_at, extraction.updated_at
             FROM borrower_document_ocr_extractions extraction
             JOIN borrower_documents document
               ON document.tenant_id = extraction.tenant_id
              AND document.borrower_id = extraction.borrower_id
              AND document.id = extraction.document_id
            WHERE extraction.tenant_id = $1 AND extraction.borrower_id = $2 AND extraction.id = $3
            FOR UPDATE`,
          [tenantId, borrowerId, extractionId],
        );
        const current = result.rows[0];
        if (!current) return { status: "not_found" };
        if (current.status !== "failed" && current.status !== "rejected") {
          return { status: "not_retryable" };
        }
        await client.query(
          `UPDATE borrower_document_ocr_extractions
              SET status = 'pending', fields_ciphertext = NULL, confidence = NULL,
                  error_code = NULL, reviewed_by = NULL, reviewed_at = NULL, updated_at = now()
            WHERE tenant_id = $1 AND borrower_id = $2 AND id = $3`,
          [tenantId, borrowerId, extractionId],
        );
        await client.query(
          `INSERT INTO outbox_events
             (tenant_id, event_type, aggregate_type, aggregate_id, idempotency_key, payload)
           SELECT $1, 'borrower.document.ocr_requested', 'borrower_document', document.id,
                  $4, jsonb_build_object(
                    'extractionId', $3::text,
                    'borrowerId', $2::text,
                    'documentId', document.id::text,
                    'objectKey', document.object_key,
                    'mediaType', document.media_type,
                    'category', document.category,
                    'side', document.side
                  )
             FROM borrower_documents document
            WHERE document.tenant_id = $1 AND document.borrower_id = $2 AND document.id = $5`,
          [
            tenantId,
            borrowerId,
            extractionId,
            `borrower-document-ocr-retry:${tenantId}:${extractionId}:${randomUUID()}`,
            current.document_id,
          ],
        );
        await client.query(
          `INSERT INTO audit_events
             (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
           VALUES ($1, $2, 'borrower.ocr_retry_requested', 'borrower_document', $3, $4, '{}'::jsonb)`,
          [tenantId, actor.userId, current.document_id, requestId],
        );
        const updated = await client.query<OcrRow>(
          `SELECT extraction.id, extraction.document_id, document.category, document.side,
                  extraction.status, extraction.fields_ciphertext, extraction.confidence,
                  extraction.model_name, extraction.error_code, extraction.reviewed_at,
                  extraction.created_at, extraction.updated_at
             FROM borrower_document_ocr_extractions extraction
             JOIN borrower_documents document
               ON document.tenant_id = extraction.tenant_id
              AND document.borrower_id = extraction.borrower_id
              AND document.id = extraction.document_id
            WHERE extraction.tenant_id = $1 AND extraction.borrower_id = $2 AND extraction.id = $3`,
          [tenantId, borrowerId, extractionId],
        );
        const refreshed = updated.rows[0];
        return refreshed
          ? { status: "queued", extraction: mapOcrRow(refreshed, identitySecret) }
          : { status: "not_found" };
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
