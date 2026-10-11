DROP POLICY memberships_platform_or_owner_write ON tenant_memberships;

CREATE POLICY memberships_platform_write ON tenant_memberships
  FOR ALL
  USING (current_setting('app.platform_role', true) = 'developer')
  WITH CHECK (current_setting('app.platform_role', true) = 'developer');

CREATE POLICY memberships_owner_update_non_owner ON tenant_memberships
  FOR UPDATE
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND current_setting('app.tenant_role', true) = 'owner'
    AND user_id <> NULLIF(current_setting('app.user_id', true), '')::uuid
    AND role <> 'owner'
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND current_setting('app.tenant_role', true) = 'owner'
    AND user_id <> NULLIF(current_setting('app.user_id', true), '')::uuid
    AND role <> 'owner'
  );
