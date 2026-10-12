-- Tenant-scoped borrower dossier foundation.
-- Identity numbers are encrypted for authorized recovery and indexed only by a
-- tenant-keyed HMAC. Document objects remain private opaque storage references.

CREATE TABLE borrowers (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  full_name text NOT NULL CHECK (length(full_name) BETWEEN 2 AND 160),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  phone text NOT NULL CHECK (length(phone) BETWEEN 7 AND 30),
  home_address text NOT NULL CHECK (length(home_address) BETWEEN 3 AND 240),
  work_address text NOT NULL CHECK (length(work_address) BETWEEN 3 AND 240),
  profile_photo_object_key text NULL,
  consent_version text NOT NULL CHECK (length(consent_version) BETWEEN 1 AND 40),
  consent_evidence_ref text NOT NULL CHECK (length(consent_evidence_ref) BETWEEN 1 AND 240),
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE borrower_identities (
  tenant_id uuid NOT NULL,
  borrower_id uuid NOT NULL,
  country char(2) NOT NULL CHECK (country = upper(country)),
  document_type text NOT NULL CHECK (length(document_type) BETWEEN 2 AND 30),
  document_number_ciphertext text NOT NULL,
  document_lookup_hmac bytea NOT NULL,
  document_last4 text NOT NULL CHECK (length(document_last4) BETWEEN 2 AND 4),
  key_version text NOT NULL DEFAULT 'v1' CHECK (length(key_version) BETWEEN 1 AND 20),
  verification_state text NOT NULL DEFAULT 'manual_pending'
    CHECK (verification_state IN ('manual_pending', 'reviewed', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, borrower_id),
  UNIQUE (tenant_id, document_lookup_hmac),
  FOREIGN KEY (tenant_id, borrower_id) REFERENCES borrowers(tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE borrower_emergency_contacts (
  tenant_id uuid NOT NULL,
  borrower_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  full_name text NOT NULL CHECK (length(full_name) BETWEEN 2 AND 120),
  relationship text NOT NULL CHECK (length(relationship) BETWEEN 2 AND 80),
  phone text NOT NULL CHECK (length(phone) BETWEEN 7 AND 30),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, borrower_id, id),
  FOREIGN KEY (tenant_id, borrower_id) REFERENCES borrowers(tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE borrower_documents (
  tenant_id uuid NOT NULL,
  borrower_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('identity', 'profile_photo')),
  side text NULL CHECK (side IN ('front', 'back')),
  object_key text NOT NULL CHECK (length(object_key) BETWEEN 1 AND 500),
  media_type text NOT NULL CHECK (length(media_type) BETWEEN 3 AND 120),
  size_bytes integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  sha256 text NOT NULL CHECK (length(sha256) = 64),
  scan_status text NOT NULL DEFAULT 'pending'
    CHECK (scan_status IN ('pending', 'accepted', 'rejected')),
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, borrower_id, id),
  FOREIGN KEY (tenant_id, borrower_id) REFERENCES borrowers(tenant_id, id) ON DELETE CASCADE,
  CHECK ((category = 'identity' AND side IS NOT NULL) OR (category = 'profile_photo' AND side IS NULL))
);

CREATE UNIQUE INDEX borrower_identity_side_idx
  ON borrower_documents (tenant_id, borrower_id, category, side)
  WHERE category = 'identity';

CREATE INDEX borrowers_directory_idx ON borrowers (tenant_id, created_at DESC, id);
CREATE INDEX borrower_documents_member_idx ON borrower_documents (tenant_id, borrower_id, created_at DESC);

ALTER TABLE borrowers ENABLE ROW LEVEL SECURITY;
ALTER TABLE borrowers FORCE ROW LEVEL SECURITY;
ALTER TABLE borrower_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE borrower_identities FORCE ROW LEVEL SECURITY;
ALTER TABLE borrower_emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE borrower_emergency_contacts FORCE ROW LEVEL SECURITY;
ALTER TABLE borrower_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE borrower_documents FORCE ROW LEVEL SECURITY;

CREATE POLICY borrowers_staff_access ON borrowers
  FOR ALL
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND EXISTS (
      SELECT 1 FROM tenant_memberships membership
      WHERE membership.tenant_id = borrowers.tenant_id
        AND membership.user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
        AND membership.status = 'active'
        AND membership.role IN ('owner', 'supervisor', 'collector')
    )
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );

CREATE POLICY borrower_identities_staff_access ON borrower_identities
  FOR ALL
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND EXISTS (
      SELECT 1 FROM tenant_memberships membership
      WHERE membership.tenant_id = borrower_identities.tenant_id
        AND membership.user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
        AND membership.status = 'active'
        AND membership.role IN ('owner', 'supervisor', 'collector')
    )
  )
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY borrower_contacts_staff_access ON borrower_emergency_contacts
  FOR ALL
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND EXISTS (
      SELECT 1 FROM tenant_memberships membership
      WHERE membership.tenant_id = borrower_emergency_contacts.tenant_id
        AND membership.user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
        AND membership.status = 'active'
        AND membership.role IN ('owner', 'supervisor', 'collector')
    )
  )
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY borrower_documents_staff_access ON borrower_documents
  FOR ALL
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND EXISTS (
      SELECT 1 FROM tenant_memberships membership
      WHERE membership.tenant_id = borrower_documents.tenant_id
        AND membership.user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
        AND membership.status = 'active'
        AND membership.role IN ('owner', 'supervisor', 'collector')
    )
  )
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON borrowers TO {{APP_DATABASE_ROLE}};
GRANT SELECT, INSERT, UPDATE, DELETE ON borrower_identities TO {{APP_DATABASE_ROLE}};
GRANT SELECT, INSERT, UPDATE, DELETE ON borrower_emergency_contacts TO {{APP_DATABASE_ROLE}};
GRANT SELECT, INSERT, UPDATE, DELETE ON borrower_documents TO {{APP_DATABASE_ROLE}};
