-- Operational loan ledger: each credit keeps its collection frequency and payment progress.

ALTER TABLE loan_applications
  ADD COLUMN payment_frequency text NOT NULL DEFAULT 'daily'
    CHECK (payment_frequency IN ('daily', 'weekly', 'fortnightly', 'monthly')),
  ADD COLUMN paid_installments integer NOT NULL DEFAULT 0
    CHECK (paid_installments >= 0 AND paid_installments <= requested_term_count),
  ADD COLUMN last_payment_at timestamptz NULL,
  ADD COLUMN renewed_from_id uuid NULL;

ALTER TABLE loan_applications
  ADD CONSTRAINT loan_applications_renewed_from_fk
  FOREIGN KEY (tenant_id, renewed_from_id)
  REFERENCES loan_applications (tenant_id, id);

CREATE INDEX loan_applications_renewed_from_idx
  ON loan_applications (tenant_id, renewed_from_id)
  WHERE renewed_from_id IS NOT NULL;

CREATE TABLE loan_payments (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL,
  installment_number integer NOT NULL CHECK (installment_number >= 1),
  amount numeric(14, 2) NOT NULL CHECK (amount > 0),
  paid_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid NOT NULL REFERENCES users(id),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, application_id, installment_number),
  FOREIGN KEY (tenant_id, application_id)
    REFERENCES loan_applications (tenant_id, id)
    ON DELETE CASCADE
);

CREATE INDEX loan_payments_application_idx
  ON loan_payments (tenant_id, application_id, installment_number);

ALTER TABLE loan_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_payments FORCE ROW LEVEL SECURITY;

CREATE POLICY loan_payments_staff_access ON loan_payments
  FOR ALL
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND EXISTS (
      SELECT 1 FROM tenant_memberships membership
       WHERE membership.tenant_id = loan_payments.tenant_id
         AND membership.user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
         AND membership.status = 'active'
         AND membership.role IN ('owner', 'supervisor', 'collector')
    )
  )
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT ON loan_payments TO {{APP_DATABASE_ROLE}};
