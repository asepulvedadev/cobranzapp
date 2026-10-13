-- Owners create employee accounts directly from the tenant panel.
-- Keep platform writes restricted while allowing an owner to add only
-- supervisor/collector memberships in the active tenant.

CREATE POLICY memberships_owner_employee_insert ON tenant_memberships
  FOR INSERT
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND current_setting('app.tenant_role', true) = 'owner'
    AND user_id <> NULLIF(current_setting('app.user_id', true), '')::uuid
    AND role IN ('supervisor', 'collector')
    AND status = 'active'
    AND created_by = NULLIF(current_setting('app.user_id', true), '')::uuid
  );
