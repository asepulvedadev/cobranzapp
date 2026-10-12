-- The owner onboarding insert uses RETURNING to hydrate the new tenant.
-- Allow the creator to see its draft row before the owner membership exists.
CREATE POLICY tenants_owner_self_select ON tenants
  FOR SELECT
  USING (
    created_by = NULLIF(current_setting('app.user_id', true), '')::uuid
    AND status = 'draft'
  );
