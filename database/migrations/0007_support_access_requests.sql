CREATE TABLE tenant_support_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES users(id),
  purpose text NOT NULL CHECK (char_length(purpose) BETWEEN 12 AND 240),
  requested_duration_minutes integer NOT NULL CHECK (requested_duration_minutes BETWEEN 15 AND 480),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'revoked')),
  reviewed_by uuid NULL REFERENCES users(id),
  reviewed_at timestamptz NULL,
  approved_until timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL AND approved_until IS NULL)
    OR (status = 'approved' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND approved_until IS NOT NULL)
    OR (status IN ('denied', 'revoked') AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX tenant_support_access_pending_idx
  ON tenant_support_access_requests (tenant_id, requested_by)
  WHERE status = 'pending';

CREATE INDEX tenant_support_access_tenant_state_idx
  ON tenant_support_access_requests (tenant_id, status, created_at DESC);

CREATE INDEX tenant_support_access_requester_state_idx
  ON tenant_support_access_requests (requested_by, status, created_at DESC);

ALTER TABLE tenant_support_access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_support_access_requests FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_support_access_scoped_select ON tenant_support_access_requests
  FOR SELECT
  USING (
    current_setting('app.platform_role', true) = 'developer'
    OR (
      tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
      AND current_setting('app.tenant_role', true) = 'owner'
    )
  );

CREATE POLICY tenant_support_access_platform_insert ON tenant_support_access_requests
  FOR INSERT
  WITH CHECK (
    current_setting('app.platform_role', true) = 'developer'
    AND requested_by = NULLIF(current_setting('app.user_id', true), '')::uuid
  );

CREATE POLICY tenant_support_access_platform_or_owner_update ON tenant_support_access_requests
  FOR UPDATE
  USING (
    (
      current_setting('app.platform_role', true) = 'developer'
      AND requested_by = NULLIF(current_setting('app.user_id', true), '')::uuid
    )
    OR (
      tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
      AND current_setting('app.tenant_role', true) = 'owner'
    )
  )
  WITH CHECK (
    (
      current_setting('app.platform_role', true) = 'developer'
      AND requested_by = NULLIF(current_setting('app.user_id', true), '')::uuid
    )
    OR (
      tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
      AND current_setting('app.tenant_role', true) = 'owner'
    )
  );

GRANT SELECT, INSERT, UPDATE ON tenant_support_access_requests TO {{APP_DATABASE_ROLE}};
