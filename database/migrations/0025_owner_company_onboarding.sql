CREATE POLICY tenants_owner_self_create ON tenants
  FOR INSERT
  WITH CHECK (
    created_by = NULLIF(current_setting('app.user_id', true), '')::uuid
    AND status = 'draft'
  );

CREATE POLICY memberships_owner_self_create ON tenant_memberships
  FOR INSERT
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    AND role = 'owner'
    AND status = 'active'
    AND EXISTS (
      SELECT 1 FROM tenants tenant
       WHERE tenant.id = tenant_memberships.tenant_id
         AND tenant.created_by = NULLIF(current_setting('app.user_id', true), '')::uuid
    )
  );

CREATE POLICY membership_entitlement_owner_self_insert
  ON tenant_membership_entitlement_versions
  FOR INSERT
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND current_setting('app.tenant_role', true) = 'owner'
    AND EXISTS (
      SELECT 1 FROM tenants tenant
       WHERE tenant.id = tenant_membership_entitlement_versions.tenant_id
         AND tenant.created_by = NULLIF(current_setting('app.user_id', true), '')::uuid
    )
  );
