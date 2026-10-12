-- Consent-gated, minimal shared verification network.
-- This migration intentionally stores no document number or full identity document.
-- The application stores a keyed HMAC of the normalized identity instead.

CREATE TABLE verification_network_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_key bytea NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE verification_network_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES verification_network_subjects(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  granted_by uuid NOT NULL REFERENCES users(id),
  token_hash bytea NOT NULL UNIQUE,
  purpose text NOT NULL CHECK (purpose IN ('credit_evaluation', 'portfolio_management', 'customer_request')),
  policy_version text NOT NULL CHECK (length(policy_version) BETWEEN 1 AND 40),
  evidence_ref text NOT NULL CHECK (length(evidence_ref) BETWEEN 1 AND 240),
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz NULL,
  UNIQUE (subject_id, tenant_id)
);

CREATE INDEX verification_network_consents_tenant_idx
  ON verification_network_consents (tenant_id, subject_id)
  WHERE revoked_at IS NULL;

CREATE TABLE verification_network_assertions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES verification_network_subjects(id) ON DELETE CASCADE,
  source_tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  published_by uuid NOT NULL REFERENCES users(id),
  category text NOT NULL CHECK (category IN ('late_payment', 'payment_default')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'withdrawn', 'disputed', 'expired')),
  observed_from date NOT NULL,
  observed_to date NULL,
  evidence_ref text NOT NULL CHECK (length(evidence_ref) BETWEEN 1 AND 240),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CHECK (observed_to IS NULL OR observed_to >= observed_from),
  CHECK (expires_at > created_at)
);

CREATE INDEX verification_network_assertions_lookup_idx
  ON verification_network_assertions (subject_id, status, expires_at);

CREATE TABLE verification_network_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NULL REFERENCES verification_network_subjects(id) ON DELETE SET NULL,
  requester_tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  requester_user_id uuid NOT NULL REFERENCES users(id),
  consent_id uuid NULL REFERENCES verification_network_consents(id) ON DELETE SET NULL,
  purpose text NOT NULL CHECK (purpose IN ('credit_evaluation', 'portfolio_management', 'customer_request')),
  result_state text NOT NULL CHECK (result_state IN ('not_found', 'no_observation', 'reported', 'disputed', 'no_consent')),
  happened_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE verification_network_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES verification_network_subjects(id) ON DELETE CASCADE,
  assertion_id uuid NULL REFERENCES verification_network_assertions(id) ON DELETE SET NULL,
  requester_tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  message text NOT NULL CHECK (length(message) BETWEEN 10 AND 1000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'resolved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz NULL
);

-- A profile photo is a designated profile image, not a selfie or identity proof.
-- Employee health data is optional and separately scoped; it is never required for access.
CREATE TABLE tenant_member_profiles (
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  phone text NULL,
  home_address text NULL,
  work_address text NULL,
  profile_photo_object_key text NULL,
  blood_type text NULL CHECK (blood_type IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  blood_type_consent_version text NULL CHECK (blood_type IS NULL OR length(blood_type_consent_version) BETWEEN 1 AND 40),
  blood_type_consented_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id),
  FOREIGN KEY (tenant_id, user_id) REFERENCES tenant_memberships(tenant_id, user_id) ON DELETE CASCADE
);

CREATE TABLE tenant_member_emergency_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  full_name text NOT NULL CHECK (length(full_name) BETWEEN 2 AND 120),
  relationship text NOT NULL CHECK (length(relationship) BETWEEN 2 AND 80),
  phone text NOT NULL CHECK (length(phone) BETWEEN 7 AND 30),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, user_id) REFERENCES tenant_memberships(tenant_id, user_id) ON DELETE CASCADE
);

CREATE INDEX tenant_member_emergency_contacts_member_idx
  ON tenant_member_emergency_contacts (tenant_id, user_id);

ALTER TABLE verification_network_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_network_subjects FORCE ROW LEVEL SECURITY;
ALTER TABLE verification_network_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_network_consents FORCE ROW LEVEL SECURITY;
ALTER TABLE verification_network_assertions ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_network_assertions FORCE ROW LEVEL SECURITY;
ALTER TABLE verification_network_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_network_queries FORCE ROW LEVEL SECURITY;
ALTER TABLE verification_network_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_network_corrections FORCE ROW LEVEL SECURITY;
ALTER TABLE tenant_member_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_member_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE tenant_member_emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_member_emergency_contacts FORCE ROW LEVEL SECURITY;

CREATE POLICY verification_subjects_insert ON verification_network_subjects
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenant_memberships membership
      WHERE membership.tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
        AND membership.user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
        AND membership.status = 'active'
        AND membership.role IN ('owner', 'supervisor')
    )
  );

CREATE POLICY verification_subjects_select ON verification_network_subjects
  FOR SELECT
  USING (
    current_setting('app.tenant_role', true) IN ('owner', 'supervisor')
    OR EXISTS (
      SELECT 1 FROM verification_network_consents consent
      WHERE consent.subject_id = verification_network_subjects.id
        AND consent.tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
        AND consent.revoked_at IS NULL
        AND consent.expires_at > now()
    )
  );

CREATE POLICY verification_consents_tenant_access ON verification_network_consents
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND granted_by = NULLIF(current_setting('app.user_id', true), '')::uuid
  );

CREATE POLICY verification_assertions_source_insert ON verification_network_assertions
  FOR INSERT
  WITH CHECK (
    source_tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND published_by = NULLIF(current_setting('app.user_id', true), '')::uuid
    AND EXISTS (
      SELECT 1 FROM verification_network_consents consent
      WHERE consent.subject_id = verification_network_assertions.subject_id
        AND consent.tenant_id = verification_network_assertions.source_tenant_id
        AND consent.revoked_at IS NULL
        AND consent.expires_at > now()
    )
  );

CREATE POLICY verification_assertions_consented_select ON verification_network_assertions
  FOR SELECT
  USING (
    source_tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    OR EXISTS (
      SELECT 1 FROM verification_network_consents consent
      WHERE consent.subject_id = verification_network_assertions.subject_id
        AND consent.tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
        AND consent.revoked_at IS NULL
        AND consent.expires_at > now()
    )
  );

CREATE POLICY verification_queries_tenant_access ON verification_network_queries
  FOR ALL
  USING (requester_tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (
    requester_tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND requester_user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
  );

CREATE POLICY verification_corrections_tenant_access ON verification_network_corrections
  FOR ALL
  USING (requester_tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (requester_tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY member_profiles_tenant_access ON tenant_member_profiles
  FOR ALL
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND (
      user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
      OR current_setting('app.tenant_role', true) IN ('owner', 'supervisor')
    )
  )
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY member_emergency_contacts_tenant_access ON tenant_member_emergency_contacts
  FOR ALL
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND (
      user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
      OR current_setting('app.tenant_role', true) IN ('owner', 'supervisor')
    )
  )
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON verification_network_subjects TO {{APP_DATABASE_ROLE}};
GRANT SELECT, INSERT, UPDATE, DELETE ON verification_network_consents TO {{APP_DATABASE_ROLE}};
GRANT SELECT, INSERT, UPDATE, DELETE ON verification_network_assertions TO {{APP_DATABASE_ROLE}};
GRANT SELECT, INSERT, UPDATE, DELETE ON verification_network_queries TO {{APP_DATABASE_ROLE}};
GRANT SELECT, INSERT, UPDATE, DELETE ON verification_network_corrections TO {{APP_DATABASE_ROLE}};
GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_member_profiles TO {{APP_DATABASE_ROLE}};
GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_member_emergency_contacts TO {{APP_DATABASE_ROLE}};
