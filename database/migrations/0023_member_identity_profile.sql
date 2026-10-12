-- Staff identity fields are tenant-scoped and protected like borrower identity.
-- The full document number is never returned by the API; only an encrypted
-- recovery value and a keyed lookup are stored.

ALTER TABLE tenant_member_profiles
  ADD COLUMN country char(2) NOT NULL DEFAULT 'CO',
  ADD COLUMN document_type text NULL,
  ADD COLUMN document_number_ciphertext text NULL,
  ADD COLUMN document_lookup_hmac bytea NULL,
  ADD COLUMN document_last4 text NULL,
  ADD COLUMN document_key_version text NOT NULL DEFAULT 'v1',
  ADD COLUMN document_verification_state text NOT NULL DEFAULT 'manual_pending';

ALTER TABLE tenant_member_profiles
  ADD CONSTRAINT tenant_member_profiles_country_check
    CHECK (country = upper(country) AND length(country) = 2),
  ADD CONSTRAINT tenant_member_profiles_document_state_check
    CHECK (document_verification_state IN ('manual_pending', 'reviewed', 'rejected')),
  ADD CONSTRAINT tenant_member_profiles_document_fields_check
    CHECK (
      (document_type IS NULL
       AND document_number_ciphertext IS NULL
       AND document_lookup_hmac IS NULL
       AND document_last4 IS NULL)
      OR
      (document_type IS NOT NULL
       AND document_number_ciphertext IS NOT NULL
       AND document_lookup_hmac IS NOT NULL
       AND document_last4 IS NOT NULL
       AND length(document_type) BETWEEN 2 AND 30
       AND length(document_last4) BETWEEN 2 AND 4)
    );

CREATE UNIQUE INDEX tenant_member_profiles_identity_lookup_idx
  ON tenant_member_profiles (tenant_id, document_lookup_hmac)
  WHERE document_lookup_hmac IS NOT NULL;

CREATE INDEX tenant_member_profiles_identity_state_idx
  ON tenant_member_profiles (tenant_id, document_verification_state)
  WHERE document_type IS NOT NULL;
