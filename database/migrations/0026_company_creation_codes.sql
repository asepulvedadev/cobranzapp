CREATE TABLE company_creation_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash bytea NOT NULL UNIQUE,
  membership_plan text NOT NULL CHECK (membership_plan IN ('pro', 'ultra')),
  status text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'redeemed', 'revoked')),
  expires_at timestamptz NOT NULL,
  redeemed_at timestamptz NULL,
  redeemed_tenant_id uuid NULL REFERENCES tenants(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at),
  CHECK ((status = 'redeemed') = (redeemed_at IS NOT NULL AND redeemed_tenant_id IS NOT NULL))
);

CREATE INDEX company_creation_codes_owner_state_idx
  ON company_creation_codes (owner_user_id, status, expires_at DESC);

ALTER TABLE company_creation_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_creation_codes FORCE ROW LEVEL SECURITY;

CREATE POLICY company_creation_codes_platform_all ON company_creation_codes
  FOR ALL
  USING (current_setting('app.platform_role', true) = 'developer')
  WITH CHECK (current_setting('app.platform_role', true) = 'developer');

CREATE POLICY company_creation_codes_owner_select ON company_creation_codes
  FOR SELECT
  USING (
    owner_user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    AND status = 'issued'
  );

CREATE POLICY company_creation_codes_owner_redeem ON company_creation_codes
  FOR UPDATE
  USING (
    owner_user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    AND status = 'issued'
  )
  WITH CHECK (owner_user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);

