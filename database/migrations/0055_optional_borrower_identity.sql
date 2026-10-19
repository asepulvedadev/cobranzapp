-- A borrower can be registered from the field before the identity image is
-- available. Keep the identity row for a stable relation, but allow all
-- document fields to remain NULL until the operator adds them later.
ALTER TABLE borrower_identities
  ALTER COLUMN country DROP NOT NULL,
  ALTER COLUMN document_type DROP NOT NULL,
  ALTER COLUMN document_number_ciphertext DROP NOT NULL,
  ALTER COLUMN document_lookup_hmac DROP NOT NULL,
  ALTER COLUMN document_last4 DROP NOT NULL;

ALTER TABLE borrower_identities
  ADD CONSTRAINT borrower_identity_document_fields_all_or_none CHECK (
    (country IS NULL AND document_type IS NULL AND document_number_ciphertext IS NULL
      AND document_lookup_hmac IS NULL AND document_last4 IS NULL)
    OR
    (country IS NOT NULL AND document_type IS NOT NULL AND document_number_ciphertext IS NOT NULL
      AND document_lookup_hmac IS NOT NULL AND document_last4 IS NOT NULL)
  );
