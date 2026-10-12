-- Manual, auditable borrower identity review. No automated authenticity claim is made.

CREATE TABLE borrower_identity_reviews (
  tenant_id uuid NOT NULL,
  borrower_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  reviewer_user_id uuid NOT NULL REFERENCES users(id),
  decision text NOT NULL CHECK (decision IN ('reviewed', 'rejected')),
  notes text NOT NULL CHECK (length(notes) BETWEEN 10 AND 500),
  checklist jsonb NOT NULL CHECK (jsonb_typeof(checklist) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, borrower_id, id),
  FOREIGN KEY (tenant_id, borrower_id) REFERENCES borrowers(tenant_id, id) ON DELETE CASCADE
);

CREATE INDEX borrower_identity_reviews_latest_idx
  ON borrower_identity_reviews (tenant_id, borrower_id, created_at DESC);

ALTER TABLE borrower_identity_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE borrower_identity_reviews FORCE ROW LEVEL SECURITY;

CREATE POLICY borrower_identity_reviews_staff_access ON borrower_identity_reviews
  FOR ALL
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND EXISTS (
      SELECT 1
        FROM tenant_memberships membership
       WHERE membership.tenant_id = borrower_identity_reviews.tenant_id
         AND membership.user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
         AND membership.status = 'active'
         AND membership.role IN ('owner', 'supervisor')
    )
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND reviewer_user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
  );

GRANT SELECT, INSERT ON borrower_identity_reviews TO {{APP_DATABASE_ROLE}};
