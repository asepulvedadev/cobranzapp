CREATE INDEX audit_events_time_idx
  ON audit_events (happened_at DESC, id DESC);

CREATE INDEX audit_events_tenant_time_idx
  ON audit_events (tenant_id, happened_at DESC, id DESC);
