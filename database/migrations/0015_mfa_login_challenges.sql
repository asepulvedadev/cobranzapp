CREATE TABLE auth_mfa_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash bytea NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  attempts smallint NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  used_at timestamptz NULL,
  user_agent text NULL,
  ip_hash bytea NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX auth_mfa_challenges_active_idx
  ON auth_mfa_challenges (user_id, expires_at)
  WHERE used_at IS NULL;

CREATE POLICY audit_self_auth_select ON audit_events
  FOR SELECT
  USING (
    tenant_id IS NULL
    AND actor_user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    AND action LIKE 'auth.%'
  );

CREATE POLICY audit_self_auth_insert ON audit_events
  FOR INSERT
  WITH CHECK (
    tenant_id IS NULL
    AND actor_user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    AND action LIKE 'auth.%'
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON auth_mfa_challenges TO {{APP_DATABASE_ROLE}};
