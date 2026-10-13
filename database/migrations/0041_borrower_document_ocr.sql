-- OCR suggestions are never the source of truth. A staff member must confirm
-- the extracted fields before they are copied into the borrower identity.

CREATE TABLE borrower_document_ocr_extractions (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  borrower_id uuid NOT NULL,
  document_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'ready', 'confirmed', 'rejected', 'failed')),
  fields_ciphertext text NULL,
  text_hash text NULL CHECK (text_hash IS NULL OR length(text_hash) = 64),
  confidence numeric(5, 4) NULL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  model_name text NOT NULL DEFAULT 'tesseract-spa-v1',
  error_code text NULL,
  reviewed_by uuid NULL REFERENCES users(id),
  reviewed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, borrower_id, document_id)
    REFERENCES borrower_documents (tenant_id, borrower_id, id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX borrower_document_ocr_document_idx
  ON borrower_document_ocr_extractions (tenant_id, borrower_id, document_id);
CREATE INDEX borrower_document_ocr_borrower_idx
  ON borrower_document_ocr_extractions (tenant_id, borrower_id, created_at DESC);

ALTER TABLE borrower_document_ocr_extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE borrower_document_ocr_extractions FORCE ROW LEVEL SECURITY;

CREATE POLICY borrower_document_ocr_staff_select ON borrower_document_ocr_extractions
  FOR SELECT TO {{APP_DATABASE_ROLE}}
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND EXISTS (
      SELECT 1 FROM tenant_memberships membership
       WHERE membership.tenant_id = borrower_document_ocr_extractions.tenant_id
         AND membership.user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
         AND membership.status = 'active'
         AND membership.role IN ('owner', 'supervisor', 'collector')
    )
  );

CREATE POLICY borrower_document_ocr_staff_insert ON borrower_document_ocr_extractions
  FOR INSERT TO {{APP_DATABASE_ROLE}}
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY borrower_document_ocr_staff_update ON borrower_document_ocr_extractions
  FOR UPDATE TO {{APP_DATABASE_ROLE}}
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY borrower_document_ocr_worker_select ON borrower_document_ocr_extractions
  FOR SELECT TO {{WORKER_DATABASE_ROLE}}
  USING (true);

CREATE POLICY borrower_document_ocr_worker_update ON borrower_document_ocr_extractions
  FOR UPDATE TO {{WORKER_DATABASE_ROLE}}
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON borrower_document_ocr_extractions TO {{APP_DATABASE_ROLE}};
GRANT SELECT, UPDATE ON borrower_document_ocr_extractions TO {{WORKER_DATABASE_ROLE}};
