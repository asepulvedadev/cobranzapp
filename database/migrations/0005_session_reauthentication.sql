ALTER TABLE auth_sessions
  ADD COLUMN reauthenticated_at timestamptz NULL;

DROP POLICY audit_platform_or_tenant_select ON audit_events;
CREATE POLICY audit_platform_or_tenant_select ON audit_events
  FOR SELECT
  USING (
    current_setting('app.platform_role', true) = 'developer'
    OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    OR (
      tenant_id IS NULL
      AND actor_user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    )
  );

DROP POLICY audit_platform_or_tenant_insert ON audit_events;
CREATE POLICY audit_platform_or_tenant_insert ON audit_events
  FOR INSERT
  WITH CHECK (
    current_setting('app.platform_role', true) = 'developer'
    OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    OR (
      tenant_id IS NULL
      AND actor_user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    )
  );
