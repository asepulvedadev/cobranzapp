DROP INDEX IF EXISTS user_memberships_one_active_idx;

ALTER TABLE user_memberships
  ADD COLUMN consumed_at timestamptz NULL,
  ADD COLUMN consumed_tenant_id uuid NULL REFERENCES tenants(id) ON DELETE SET NULL,
  ADD CONSTRAINT user_memberships_consumption_pair_check
    CHECK ((consumed_at IS NULL AND consumed_tenant_id IS NULL)
        OR (consumed_at IS NOT NULL AND consumed_tenant_id IS NOT NULL));

CREATE INDEX user_memberships_available_idx
  ON user_memberships (user_id, activated_at ASC)
  WHERE status = 'active' AND consumed_at IS NULL;

CREATE POLICY user_memberships_owner_select ON user_memberships
  FOR SELECT
  USING (
    user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    AND status = 'active' AND consumed_at IS NULL
  );

CREATE POLICY user_memberships_owner_consume ON user_memberships
  FOR UPDATE
  USING (
    user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    AND status = 'active' AND consumed_at IS NULL
  )
  WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);
