-- Draft-only loan product catalog. Financial approval and disbursement remain separate gates.

CREATE TABLE loan_products (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(name) BETWEEN 2 AND 120),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'under_review', 'approved', 'retired')),
  currency char(3) NOT NULL DEFAULT 'COP' CHECK (currency = 'COP'),
  principal_min numeric(14, 2) NOT NULL CHECK (principal_min > 0),
  principal_max numeric(14, 2) NOT NULL CHECK (principal_max >= principal_min),
  term_count integer NOT NULL CHECK (term_count BETWEEN 1 AND 365),
  payment_frequency text NOT NULL
    CHECK (payment_frequency IN ('daily', 'weekly', 'fortnightly', 'monthly')),
  rate_basis text NOT NULL
    CHECK (rate_basis IN ('flat_total', 'periodic_simple', 'effective_annual')),
  nominal_rate numeric(12, 8) NOT NULL CHECK (nominal_rate >= 0),
  documentation_fee_rate numeric(12, 8) NOT NULL DEFAULT 0
    CHECK (documentation_fee_rate >= 0),
  compliance_status text NOT NULL DEFAULT 'pending'
    CHECK (compliance_status IN ('pending', 'approved', 'expired')),
  compliance_source_ref text NULL CHECK (compliance_source_ref IS NULL OR length(compliance_source_ref) BETWEEN 3 AND 240),
  created_by uuid NOT NULL REFERENCES users(id),
  reviewed_by uuid NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  CHECK (status <> 'approved' OR compliance_status = 'approved')
);

CREATE UNIQUE INDEX loan_products_name_idx ON loan_products (tenant_id, lower(name));
CREATE INDEX loan_products_status_idx ON loan_products (tenant_id, status, updated_at DESC);

ALTER TABLE loan_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_products FORCE ROW LEVEL SECURITY;

CREATE POLICY loan_products_owner_supervisor_access ON loan_products
  FOR ALL
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND EXISTS (
      SELECT 1 FROM tenant_memberships membership
       WHERE membership.tenant_id = loan_products.tenant_id
         AND membership.user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
         AND membership.status = 'active'
         AND membership.role IN ('owner', 'supervisor')
    )
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );

GRANT SELECT, INSERT, UPDATE ON loan_products TO {{APP_DATABASE_ROLE}};
