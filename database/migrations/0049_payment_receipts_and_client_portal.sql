-- Confirmed payment evidence, shareable receipts, and revocable passwordless client access.

ALTER TABLE loan_payments
  ADD COLUMN payment_method text NOT NULL DEFAULT 'cash'
    CHECK (payment_method IN ('cash', 'transfer')),
  ADD COLUMN transfer_proof_object_key text NULL,
  ADD COLUMN transfer_proof_media_type text NULL,
  ADD COLUMN transfer_proof_size_bytes integer NULL,
  ADD COLUMN transfer_proof_sha256 text NULL,
  ADD COLUMN receipt_number text NULL,
  ADD COLUMN remaining_amount numeric(14, 2) NULL CHECK (remaining_amount >= 0);

UPDATE loan_payments
   SET receipt_number = 'REC-' || to_char(paid_at AT TIME ZONE 'UTC', 'YYYYMMDD') || '-' ||
                        upper(substr(replace(id::text, '-', ''), 1, 8));

ALTER TABLE loan_payments
  ALTER COLUMN receipt_number SET NOT NULL,
  ADD CONSTRAINT loan_payments_transfer_proof_complete CHECK (
    (transfer_proof_object_key IS NULL
      AND transfer_proof_media_type IS NULL
      AND transfer_proof_size_bytes IS NULL
      AND transfer_proof_sha256 IS NULL)
    OR
    (payment_method = 'transfer'
      AND transfer_proof_object_key IS NOT NULL
      AND transfer_proof_media_type IN ('image/jpeg', 'image/png', 'image/webp')
      AND transfer_proof_size_bytes BETWEEN 1 AND 10485760
      AND length(transfer_proof_sha256) = 64)
  );

CREATE UNIQUE INDEX loan_payments_receipt_number_idx
  ON loan_payments (tenant_id, receipt_number);

CREATE TABLE borrower_portal_links (
  tenant_id uuid NOT NULL,
  borrower_id uuid NOT NULL,
  nonce uuid NOT NULL DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  rotated_at timestamptz NULL,
  revoked_at timestamptz NULL,
  PRIMARY KEY (tenant_id, borrower_id),
  UNIQUE (borrower_id, nonce),
  FOREIGN KEY (tenant_id, borrower_id)
    REFERENCES borrowers (tenant_id, id)
    ON DELETE CASCADE
);

ALTER TABLE borrower_portal_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE borrower_portal_links FORCE ROW LEVEL SECURITY;

CREATE POLICY borrower_portal_links_staff_access ON borrower_portal_links
  FOR ALL
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND EXISTS (
      SELECT 1
        FROM tenant_memberships membership
       WHERE membership.tenant_id = borrower_portal_links.tenant_id
         AND membership.user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
         AND membership.status = 'active'
         AND membership.role IN ('owner', 'supervisor', 'collector')
    )
  )
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE ON borrower_portal_links TO {{APP_DATABASE_ROLE}};

CREATE OR REPLACE FUNCTION public.borrower_portal_snapshot(
  p_borrower_id uuid,
  p_nonce uuid
) RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT jsonb_build_object(
    'company', jsonb_build_object(
      'name', tenant.display_name,
      'phone', settings.contact_phone,
      'primaryColor', COALESCE(settings.primary_color, '#173B2E'),
      'accentColor', COALESCE(settings.accent_color, '#D7B66C')
    ),
    'borrower', jsonb_build_object(
      'id', borrower.id,
      'fullName', borrower.full_name,
      'phone', borrower.phone,
      'whatsappPhone', borrower.whatsapp_phone,
      'documentType', identity.document_type,
      'documentLast4', identity.document_last4
    ),
    'applications', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', application.id,
          'productName', product.name,
          'requestedPrincipal', application.requested_principal::text,
          'paymentFrequency', application.payment_frequency,
          'requestedTermCount', application.requested_term_count,
          'paidInstallments', application.paid_installments,
          'rateBasis', application.rate_basis,
          'nominalRate', application.nominal_rate::text,
          'documentationFeeRate', application.documentation_fee_rate::text,
          'status', application.status,
          'createdAt', application.created_at
        ) ORDER BY application.created_at DESC
      )
        FROM loan_applications application
        JOIN loan_products product
          ON product.tenant_id = application.tenant_id
         AND product.id = application.loan_product_id
       WHERE application.tenant_id = borrower.tenant_id
         AND application.borrower_id = borrower.id
         AND application.status IN ('active', 'paid')
    ), '[]'::jsonb),
    'payments', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', payment.id,
          'applicationId', payment.application_id,
          'installmentNumber', payment.installment_number,
          'amount', payment.amount::text,
          'paymentMethod', payment.payment_method,
          'paidAt', payment.paid_at,
          'receiptNumber', payment.receipt_number,
          'remainingAmount', payment.remaining_amount::text
        ) ORDER BY payment.paid_at DESC
      )
        FROM loan_payments payment
        JOIN loan_applications application
          ON application.tenant_id = payment.tenant_id
         AND application.id = payment.application_id
       WHERE application.tenant_id = borrower.tenant_id
         AND application.borrower_id = borrower.id
    ), '[]'::jsonb)
  )
    FROM borrower_portal_links link
    JOIN borrowers borrower
      ON borrower.tenant_id = link.tenant_id
     AND borrower.id = link.borrower_id
    JOIN borrower_identities identity
      ON identity.tenant_id = borrower.tenant_id
     AND identity.borrower_id = borrower.id
    JOIN tenants tenant ON tenant.id = borrower.tenant_id
    LEFT JOIN tenant_settings settings ON settings.tenant_id = tenant.id
   WHERE link.borrower_id = p_borrower_id
     AND link.nonce = p_nonce
     AND link.revoked_at IS NULL
     AND borrower.status = 'active';
$$;

CREATE OR REPLACE FUNCTION public.loan_payment_receipt_snapshot(
  p_payment_id uuid
) RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT jsonb_build_object(
    'company', jsonb_build_object(
      'name', tenant.display_name,
      'phone', settings.contact_phone,
      'address', settings.address,
      'primaryColor', COALESCE(settings.primary_color, '#173B2E'),
      'accentColor', COALESCE(settings.accent_color, '#D7B66C')
    ),
    'borrower', jsonb_build_object(
      'fullName', borrower.full_name,
      'phone', borrower.phone,
      'whatsappPhone', borrower.whatsapp_phone,
      'documentType', identity.document_type,
      'documentLast4', identity.document_last4
    ),
    'payment', jsonb_build_object(
      'id', payment.id,
      'receiptNumber', payment.receipt_number,
      'installmentNumber', payment.installment_number,
      'amount', payment.amount::text,
      'paymentMethod', payment.payment_method,
      'paidAt', payment.paid_at,
      'remainingAmount', payment.remaining_amount::text,
      'paidThroughReceipt', (
        SELECT COALESCE(sum(prior.amount), 0)::text
          FROM loan_payments prior
         WHERE prior.tenant_id = payment.tenant_id
           AND prior.application_id = payment.application_id
           AND (prior.paid_at, prior.id) <= (payment.paid_at, payment.id)
      ),
      'recordedBy', recorder.display_name
    ),
    'credit', jsonb_build_object(
      'productName', product.name,
      'requestedPrincipal', application.requested_principal::text,
      'requestedTermCount', application.requested_term_count,
      'paymentFrequency', application.payment_frequency,
      'rateBasis', application.rate_basis,
      'nominalRate', application.nominal_rate::text,
      'documentationFeeRate', application.documentation_fee_rate::text,
      'createdAt', application.created_at
    )
  )
    FROM loan_payments payment
    JOIN loan_applications application
      ON application.tenant_id = payment.tenant_id
     AND application.id = payment.application_id
    JOIN borrowers borrower
      ON borrower.tenant_id = application.tenant_id
     AND borrower.id = application.borrower_id
    JOIN borrower_identities identity
      ON identity.tenant_id = borrower.tenant_id
     AND identity.borrower_id = borrower.id
    JOIN loan_products product
      ON product.tenant_id = application.tenant_id
     AND product.id = application.loan_product_id
    JOIN tenants tenant ON tenant.id = payment.tenant_id
    LEFT JOIN tenant_settings settings ON settings.tenant_id = tenant.id
    JOIN users recorder ON recorder.id = payment.recorded_by
   WHERE payment.id = p_payment_id;
$$;

REVOKE ALL ON FUNCTION public.borrower_portal_snapshot(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.loan_payment_receipt_snapshot(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.borrower_portal_snapshot(uuid, uuid) TO {{APP_DATABASE_ROLE}};
GRANT EXECUTE ON FUNCTION public.loan_payment_receipt_snapshot(uuid) TO {{APP_DATABASE_ROLE}};
