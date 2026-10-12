CREATE POLICY membership_entitlement_versions_owner_insert
  ON tenant_membership_entitlement_versions
  FOR INSERT
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND NULLIF(current_setting('app.tenant_role', true), '') = 'owner'
    AND changed_by = NULLIF(current_setting('app.user_id', true), '')::uuid
  );
