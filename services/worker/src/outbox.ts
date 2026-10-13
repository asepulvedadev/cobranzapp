import { execFile } from "node:child_process";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { Pool } from "pg";

export type ClaimedOutboxEvent = {
  id: string;
  tenantId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  attempts: number;
  maxAttempts: number;
  payload: Record<string, unknown>;
};

type OutboxRow = {
  id: string;
  tenant_id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  attempts: number;
  max_attempts: number;
  payload: Record<string, unknown>;
};

function toClaimedEvent(row: OutboxRow): ClaimedOutboxEvent {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    eventType: row.event_type,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    payload: row.payload,
  };
}

const execFileAsync = promisify(execFile);

type OcrFields = {
  fullName: string | null;
  documentNumber: string | null;
  country: string | null;
  documentType: string | null;
};

function deriveOcrKey(secret: string) {
  return createHash("sha256").update(`borrower-ocr\0${secret}`).digest();
}

function encryptOcrFields(secret: string, fields: OcrFields) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveOcrKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(fields), "utf8"), cipher.final()]);
  return `v1:${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${encrypted.toString("base64url")}`;
}

function safeObjectPath(root: string, objectKey: string) {
  const resolvedRoot = path.resolve(root);
  const resolvedObject = path.resolve(resolvedRoot, objectKey);
  if (resolvedObject !== resolvedRoot && !resolvedObject.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error("INVALID_DOCUMENT_OBJECT_KEY");
  }
  return resolvedObject;
}

function normalizeOcrText(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[|]/g, "I");
}

export function extractOcrFields(text: string): {
  fields: OcrFields;
  confidence: number;
  text: string;
} {
  const normalized = normalizeOcrText(text);
  const lines = normalized
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/[^A-Z0-9 .'-]/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
  const numberMatches = normalized.match(/\b\d(?:[ .]?\d){5,11}\b/g) ?? [];
  const documentNumber =
    numberMatches
      .map((value) => value.replace(/\D/g, ""))
      .find((value) => value.length >= 6 && value.length <= 10) ?? null;
  const labelledNames = lines
    .filter((line) => /\b(NOMBRES?|APELLIDOS?)\b/.test(line))
    .map((line) => line.replace(/\b(NOMBRES?|APELLIDOS?)\b[:-]?/g, "").trim())
    .filter((line) => line.length >= 3 && /[A-Z]/.test(line));
  const fullName = labelledNames.join(" ").trim() || null;
  const fields: OcrFields = {
    fullName: fullName?.slice(0, 160) ?? null,
    documentNumber,
    country: "CO",
    documentType: "CC",
  };
  const confidence = Math.min(
    0.99,
    Math.max(0.1, (documentNumber ? 0.65 : 0) + (fullName ? 0.3 : 0)),
  );
  return { fields, confidence, text };
}

async function recognizeImage(bytes: Buffer, mediaType: string) {
  if (!mediaType.startsWith("image/")) throw new Error("UNSUPPORTED_OCR_MEDIA_TYPE");
  const directory = await mkdtemp(path.join("/tmp", "cobranzapp-ocr-"));
  const inputPath = path.join(directory, "document.bin");
  try {
    await writeFile(inputPath, bytes, { mode: 0o600 });
    const result = await execFileAsync(
      "tesseract",
      [inputPath, "stdout", "--dpi", "300", "--psm", "6", "-l", "spa"],
      { maxBuffer: 1_000_000, timeout: 25_000 },
    );
    return extractOcrFields(result.stdout);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      throw new Error("OCR_ENGINE_UNAVAILABLE");
    }
    throw error;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function processBorrowerOcrEvent(
  pool: Pool,
  event: ClaimedOutboxEvent,
  workerId: string,
  documentsRoot: string,
  identitySecret: string,
): Promise<"ocr_ready" | "ocr_skipped" | "lost_lease"> {
  const extractionId =
    typeof event.payload.extractionId === "string" ? event.payload.extractionId : "";
  const borrowerId = typeof event.payload.borrowerId === "string" ? event.payload.borrowerId : "";
  const documentId =
    typeof event.payload.documentId === "string" ? event.payload.documentId : event.aggregateId;
  const objectKey = typeof event.payload.objectKey === "string" ? event.payload.objectKey : "";
  const mediaType = typeof event.payload.mediaType === "string" ? event.payload.mediaType : "";
  if (!extractionId || !borrowerId || !documentId || !objectKey || !mediaType) {
    throw new Error("INVALID_OCR_EVENT_PAYLOAD");
  }

  const begin = await pool.connect();
  try {
    await begin.query("BEGIN");
    const locked = await begin.query<OutboxRow>(
      `SELECT id, tenant_id, event_type, aggregate_type, aggregate_id, attempts, max_attempts, payload
         FROM outbox_events
        WHERE id = $1 AND status = 'processing' AND lease_owner = $2 AND lease_expires_at > now()
        FOR UPDATE`,
      [event.id, workerId],
    );
    const current = locked.rows[0];
    if (!current) {
      await begin.query("ROLLBACK");
      return "lost_lease";
    }
    const existing = await begin.query<{ status: string }>(
      `SELECT status FROM borrower_document_ocr_extractions
        WHERE tenant_id = $1 AND borrower_id = $2 AND id = $3 FOR UPDATE`,
      [current.tenant_id, borrowerId, extractionId],
    );
    if (!existing.rows[0]) throw new Error("OCR_EXTRACTION_NOT_FOUND");
    if (["ready", "confirmed", "rejected"].includes(existing.rows[0].status)) {
      await begin.query(
        `UPDATE outbox_events SET status = 'processed', processed_at = now(), lease_owner = NULL,
                lease_expires_at = NULL WHERE id = $1`,
        [event.id],
      );
      await begin.query("COMMIT");
      return "ocr_skipped";
    }
    await begin.query(
      `UPDATE borrower_document_ocr_extractions
          SET status = 'processing', error_code = NULL, updated_at = now()
        WHERE tenant_id = $1 AND borrower_id = $2 AND id = $3`,
      [current.tenant_id, borrowerId, extractionId],
    );
    await begin.query("COMMIT");
  } catch (error) {
    await begin.query("ROLLBACK");
    begin.release();
    throw error;
  }
  begin.release();

  let result: { fields: OcrFields; confidence: number; text: string };
  try {
    const bytes = await readFile(safeObjectPath(documentsRoot, objectKey));
    result = await recognizeImage(bytes, mediaType);
  } catch (error) {
    const failed = await pool.query(
      `UPDATE borrower_document_ocr_extractions
          SET status = 'failed', error_code = $4, updated_at = now()
        WHERE tenant_id = $1 AND borrower_id = $2 AND id = $3`,
      [event.tenantId, borrowerId, extractionId, safeErrorMessage(error).slice(0, 120)],
    );
    void failed;
    throw error;
  }

  const finish = await pool.connect();
  try {
    await finish.query("BEGIN");
    const locked = await finish.query<{ id: string }>(
      `SELECT id FROM outbox_events
        WHERE id = $1 AND status = 'processing' AND lease_owner = $2 AND lease_expires_at > now()
        FOR UPDATE`,
      [event.id, workerId],
    );
    if (!locked.rows[0]) {
      await finish.query("ROLLBACK");
      return "lost_lease";
    }
    await finish.query(
      `UPDATE borrower_document_ocr_extractions
          SET status = 'ready', fields_ciphertext = $4, text_hash = $5,
              confidence = $6, model_name = 'tesseract-spa-v1', error_code = NULL, updated_at = now()
        WHERE tenant_id = $1 AND borrower_id = $2 AND id = $3`,
      [
        event.tenantId,
        borrowerId,
        extractionId,
        encryptOcrFields(identitySecret, result.fields),
        createHash("sha256").update(result.text, "utf8").digest("hex"),
        result.confidence,
      ],
    );
    await finish.query(
      `UPDATE outbox_events
          SET status = 'processed', processed_at = now(), lease_owner = NULL, lease_expires_at = NULL
        WHERE id = $1`,
      [event.id],
    );
    await finish.query("COMMIT");
    return "ocr_ready";
  } catch (error) {
    await finish.query("ROLLBACK");
    throw error;
  } finally {
    finish.release();
  }
}

export function safeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown worker failure";
  return message.replaceAll(/[\r\n\t]+/g, " ").slice(0, 500);
}

export async function claimNextOutboxEvent(
  pool: Pool,
  workerId: string,
  leaseSeconds: number,
): Promise<ClaimedOutboxEvent | null> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE outbox_events
          SET status = 'dead',
              lease_owner = NULL,
              lease_expires_at = NULL,
              last_error = COALESCE(last_error, 'Worker lease expired after final attempt')
        WHERE status = 'processing'
          AND lease_expires_at <= now()
          AND attempts >= max_attempts`,
    );
    const result = await client.query<OutboxRow>(
      `WITH candidate AS (
         SELECT id
           FROM outbox_events
          WHERE (
              status = 'pending'
              AND available_at <= now()
              AND attempts < max_attempts
            ) OR (
              status = 'processing'
              AND lease_expires_at <= now()
              AND attempts < max_attempts
            )
          ORDER BY available_at, created_at, id
          FOR UPDATE SKIP LOCKED
          LIMIT 1
       )
       UPDATE outbox_events event
          SET status = 'processing',
              attempts = event.attempts + 1,
              lease_owner = $1,
              lease_expires_at = now() + make_interval(secs => $2),
              last_error = NULL
         FROM candidate
        WHERE event.id = candidate.id
       RETURNING event.id, event.tenant_id, event.event_type, event.aggregate_type,
                 event.aggregate_id, event.attempts, event.max_attempts, event.payload`,
      [workerId, leaseSeconds],
    );
    await client.query("COMMIT");
    return result.rows[0] ? toClaimedEvent(result.rows[0]) : null;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function processClaimedOutboxEvent(
  pool: Pool,
  event: ClaimedOutboxEvent,
  workerId: string,
  options: { documentsRoot?: string; identitySecret?: string } = {},
): Promise<"expired" | "skipped" | "lost_lease" | "ocr_ready" | "ocr_skipped"> {
  if (event.eventType === "borrower.document.ocr_requested") {
    if (!options.documentsRoot || !options.identitySecret) {
      throw new Error("OCR_WORKER_NOT_CONFIGURED");
    }
    return processBorrowerOcrEvent(
      pool,
      event,
      workerId,
      options.documentsRoot,
      options.identitySecret,
    );
  }
  if (event.eventType !== "support_access.expire") {
    throw new Error(`Unsupported outbox event type: ${event.eventType}`);
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query<OutboxRow>(
      `SELECT id, tenant_id, event_type, aggregate_type, aggregate_id, attempts, max_attempts, payload
         FROM outbox_events
        WHERE id = $1
          AND status = 'processing'
          AND lease_owner = $2
          AND lease_expires_at > now()
        FOR UPDATE`,
      [event.id, workerId],
    );
    const current = locked.rows[0];
    if (!current) {
      await client.query("ROLLBACK");
      return "lost_lease";
    }
    if (current.event_type !== "support_access.expire") {
      throw new Error(`Unsupported outbox event type: ${current.event_type}`);
    }
    const expired = await client.query(
      `UPDATE tenant_support_access_requests
          SET status = 'expired', updated_at = now()
        WHERE id = $1
          AND tenant_id = $2
          AND status = 'approved'
          AND approved_until <= now()`,
      [current.aggregate_id, current.tenant_id],
    );
    if (expired.rowCount) {
      await client.query(
        `INSERT INTO audit_events
           (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
         VALUES ($1, NULL, 'support_access.expired', 'support_access', $2, $3,
                 jsonb_build_object('outboxEventId', $4::text))`,
        [current.tenant_id, current.aggregate_id, `outbox:${current.id}`, current.id],
      );
    }
    await client.query(
      `UPDATE outbox_events
          SET status = 'processed', processed_at = now(), lease_owner = NULL, lease_expires_at = NULL
        WHERE id = $1`,
      [current.id],
    );
    await client.query("COMMIT");
    return expired.rowCount ? "expired" : "skipped";
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function recordOutboxFailure(
  pool: Pool,
  event: ClaimedOutboxEvent,
  workerId: string,
  error: unknown,
) {
  const result = await pool.query<{ status: "pending" | "dead" }>(
    `UPDATE outbox_events
        SET status = CASE WHEN attempts >= max_attempts THEN 'dead' ELSE 'pending' END,
            available_at = CASE
              WHEN attempts >= max_attempts THEN available_at
              ELSE now() + LEAST(interval '15 minutes', make_interval(secs => power(2, attempts)::integer))
            END,
            lease_owner = NULL,
            lease_expires_at = NULL,
            last_error = $3
      WHERE id = $1
        AND status = 'processing'
        AND lease_owner = $2
    RETURNING status`,
    [event.id, workerId, safeErrorMessage(error)],
  );
  return result.rows[0]?.status ?? null;
}
