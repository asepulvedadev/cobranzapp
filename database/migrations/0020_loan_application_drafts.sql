-- Controlled loan application drafts. Submission, approval, schedules and disbursement are later gates.

CREATE TABLE loan_applications (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  borrower_id uuid NOT NULL,
  loan_product_id uuid NOT NULL,
  requested_principal numeric(14, 2) NOT NULL CHECK (requested_principal > 0),
  requested_term_count integer NOT NULL CHECK (requested_term_count BETWEEN 1 AND 365),
  purpose text NULL CHECK (purpose IS NULL OR length(purpose) BETWEEN 3 AND 240),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'cancelled')),
  created_by uuid NOT NULL REFERENCES users(id),
  reviewed_by uuid NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz NULL,
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, borrower_id) REFERENCES borrowers(tenant_id, id),
  FOREIGN KEY (tenant_id, loan_product_id) REFERENCES loan_products(tenant_id, id)
);

CREATE INDEX loan_applications_directory_idx
  ON loan_applications (tenant_id, status, updated_at DESC);
CREATE INDEX loan_applications_borrower_idx
  ON loan_applications (tenant_id, borrower_id, updated_at DESC);

ALTER TABLE loan_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_applications FORCE ROW LEVEL SECURITY;

CREATE POLICY loan_applications_staff_access ON loan_applications
  FOR ALL
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND EXISTS (
      SELECT 1 FROM tenant_memberships membership
       WHERE membership.tenant_id = loan_applications.tenant_id
         AND membership.user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
         AND membership.status = 'active'
         AND membership.role IN ('owner', 'supervisor', 'collector')
    )
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );

GRANT SELECT, INSERT, UPDATE ON loan_applications TO {{APP_DATABASE_ROLE}};

-- Collectors may use products to prepare a request, but cannot edit the catalog.
CREATE POLICY loan_products_collector_read ON loan_products
  FOR SELECT
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND EXISTS (
      SELECT 1 FROM tenant_memberships membership
       WHERE membership.tenant_id = loan_products.tenant_id
         AND membership.user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
         AND membership.status = 'active'
         AND membership.role = 'collector'
    )
  );
