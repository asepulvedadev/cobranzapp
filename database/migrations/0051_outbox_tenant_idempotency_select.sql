CREATE POLICY outbox_app_tenant_select ON outbox_events
  FOR SELECT TO {{APP_DATABASE_ROLE}}
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );
