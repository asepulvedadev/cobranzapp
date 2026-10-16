-- Make credit activation depend on the creator's tenant role and preserve
-- explicit approval evidence on the application itself.

ALTER TABLE loan_applications
  ADD COLUMN created_by_role text NOT NULL DEFAULT 'legacy'
    CHECK (created_by_role IN ('owner', 'supervisor', 'collector', 'legacy')),
  ADD COLUMN approved_by uuid NULL REFERENCES users(id),
  ADD COLUMN approved_at timestamptz NULL,
  ADD COLUMN approval_mode text NULL
    CHECK (approval_mode IN ('role_auto', 'owner_review', 'supervisor_review', 'renewal', 'legacy'));

UPDATE loan_applications
   SET approved_by = COALESCE(reviewed_by, created_by),
       approved_at = COALESCE(updated_at, created_at),
       approval_mode = 'legacy'
 WHERE status IN ('active', 'paid');

ALTER TABLE loan_applications
  ADD CONSTRAINT loan_applications_approval_evidence_check
  CHECK (
    (approved_by IS NULL AND approved_at IS NULL AND approval_mode IS NULL)
    OR
    (approved_by IS NOT NULL AND approved_at IS NOT NULL AND approval_mode IS NOT NULL)
  );

CREATE INDEX loan_applications_pending_approval_idx
  ON loan_applications (tenant_id, submitted_at, created_at)
  WHERE status IN ('submitted', 'under_review');
