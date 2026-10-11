ALTER TABLE tenant_support_access_requests
  DROP CONSTRAINT tenant_support_access_requests_status_check,
  DROP CONSTRAINT tenant_support_access_requests_check;

ALTER TABLE tenant_support_access_requests
  ADD CONSTRAINT tenant_support_access_requests_status_check
    CHECK (status IN ('pending', 'approved', 'denied', 'revoked', 'expired')),
  ADD CONSTRAINT tenant_support_access_requests_state_check CHECK (
    (status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL AND approved_until IS NULL)
    OR (status = 'approved' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND approved_until IS NOT NULL)
    OR (status IN ('denied', 'revoked') AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
    OR (status = 'expired' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND approved_until IS NOT NULL)
  );

CREATE TABLE outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type ~ '^[a-z][a-z0-9_.]{2,99}$'),
  aggregate_type text NOT NULL CHECK (aggregate_type ~ '^[a-z][a-z0-9_]{1,49}$'),
  aggregate_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE CHECK (char_length(idempotency_key) BETWEEN 8 AND 200),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'processed', 'dead')),
  available_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL DEFAULT 5 CHECK (max_attempts BETWEEN 1 AND 20),
  lease_owner text NULL,
  lease_expires_at timestamptz NULL,
  last_error text NULL CHECK (last_error IS NULL OR char_length(last_error) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz NULL,
  CHECK (
    (status = 'pending' AND lease_owner IS NULL AND lease_expires_at IS NULL AND processed_at IS NULL)
    OR (status = 'processing' AND lease_owner IS NOT NULL AND lease_expires_at IS NOT NULL AND processed_at IS NULL)
    OR (status = 'processed' AND lease_owner IS NULL AND lease_expires_at IS NULL AND processed_at IS NOT NULL)
    OR (status = 'dead' AND lease_owner IS NULL AND lease_expires_at IS NULL AND processed_at IS NULL)
  )
);

CREATE INDEX outbox_events_claim_idx
  ON outbox_events (available_at, created_at, id)
  WHERE status = 'pending';

CREATE INDEX outbox_events_expired_lease_idx
  ON outbox_events (lease_expires_at, id)
  WHERE status = 'processing';

CREATE INDEX outbox_events_tenant_state_idx
  ON outbox_events (tenant_id, status, created_at DESC);

ALTER TABLE outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_events FORCE ROW LEVEL SECURITY;

CREATE POLICY outbox_app_insert ON outbox_events
  FOR INSERT TO {{APP_DATABASE_ROLE}}
  WITH CHECK (
    current_setting('app.platform_role', true) = 'developer'
    OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );

CREATE POLICY outbox_platform_select ON outbox_events
  FOR SELECT TO {{APP_DATABASE_ROLE}}
  USING (current_setting('app.platform_role', true) = 'developer');

CREATE POLICY outbox_worker_select ON outbox_events
  FOR SELECT TO {{WORKER_DATABASE_ROLE}}
  USING (true);

CREATE POLICY outbox_worker_update ON outbox_events
  FOR UPDATE TO {{WORKER_DATABASE_ROLE}}
  USING (true)
  WITH CHECK (true);

CREATE POLICY support_access_worker_expiry_update ON tenant_support_access_requests
  FOR UPDATE TO {{WORKER_DATABASE_ROLE}}
  USING (status = 'approved' AND approved_until <= now())
  WITH CHECK (status = 'expired' AND approved_until <= now());

CREATE POLICY support_access_worker_expiry_select ON tenant_support_access_requests
  FOR SELECT TO {{WORKER_DATABASE_ROLE}}
  USING (status IN ('approved', 'expired') AND approved_until <= now());

CREATE POLICY audit_worker_expiry_insert ON audit_events
  FOR INSERT TO {{WORKER_DATABASE_ROLE}}
  WITH CHECK (
    tenant_id IS NOT NULL
    AND actor_user_id IS NULL
    AND action = 'support_access.expired'
    AND target_type = 'support_access'
  );

REVOKE ALL ON outbox_events FROM PUBLIC, {{APP_DATABASE_ROLE}}, {{WORKER_DATABASE_ROLE}};
GRANT INSERT, SELECT ON outbox_events TO {{APP_DATABASE_ROLE}};
GRANT SELECT, UPDATE ON outbox_events TO {{WORKER_DATABASE_ROLE}};
GRANT SELECT, UPDATE ON tenant_support_access_requests TO {{WORKER_DATABASE_ROLE}};
GRANT INSERT ON audit_events TO {{WORKER_DATABASE_ROLE}};
