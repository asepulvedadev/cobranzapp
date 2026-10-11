CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username citext NOT NULL UNIQUE,
  email citext NOT NULL UNIQUE,
  display_name text NOT NULL,
  password_hash text NOT NULL,
  platform_role text NULL CHECK (platform_role IN ('developer')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  must_change_password boolean NOT NULL DEFAULT true,
  password_changed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (username = lower(username::text)),
  CHECK (email = lower(email::text))
);

CREATE TABLE auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash bytea NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz NULL,
  user_agent text NULL,
  ip_hash bytea NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX auth_sessions_user_active_idx
  ON auth_sessions (user_id, expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug citext NOT NULL UNIQUE,
  display_name text NOT NULL,
  legal_name text NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'suspended', 'archived')),
  locale text NOT NULL DEFAULT 'es-CO',
  timezone text NOT NULL DEFAULT 'America/Bogota',
  currency char(3) NOT NULL DEFAULT 'COP',
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (slug = lower(slug::text)),
  CHECK (slug::text ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE TABLE tenant_memberships (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  user_id uuid NOT NULL REFERENCES users(id),
  role text NOT NULL CHECK (role IN ('owner', 'supervisor', 'collector', 'customer')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('invited', 'active', 'suspended', 'revoked')),
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id)
);

CREATE INDEX tenant_memberships_user_idx ON tenant_memberships (user_id, status);

CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NULL REFERENCES tenants(id),
  actor_user_id uuid NULL REFERENCES users(id),
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid NULL,
  request_id text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  happened_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_events_tenant_target_idx
  ON audit_events (tenant_id, target_type, target_id, happened_at DESC);

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
ALTER TABLE tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;

CREATE POLICY tenants_platform_or_member_select ON tenants
  FOR SELECT
  USING (
    current_setting('app.platform_role', true) = 'developer'
    OR EXISTS (
      SELECT 1
      FROM tenant_memberships membership
      WHERE membership.tenant_id = tenants.id
        AND membership.user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
        AND membership.status = 'active'
    )
  );

CREATE POLICY tenants_platform_write ON tenants
  FOR ALL
  USING (current_setting('app.platform_role', true) = 'developer')
  WITH CHECK (current_setting('app.platform_role', true) = 'developer');

CREATE POLICY memberships_platform_or_self_select ON tenant_memberships
  FOR SELECT
  USING (
    current_setting('app.platform_role', true) = 'developer'
    OR user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
  );

CREATE POLICY memberships_platform_write ON tenant_memberships
  FOR ALL
  USING (current_setting('app.platform_role', true) = 'developer')
  WITH CHECK (current_setting('app.platform_role', true) = 'developer');

CREATE POLICY audit_platform_or_tenant_select ON audit_events
  FOR SELECT
  USING (
    current_setting('app.platform_role', true) = 'developer'
    OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );

CREATE POLICY audit_platform_or_tenant_insert ON audit_events
  FOR INSERT
  WITH CHECK (
    current_setting('app.platform_role', true) = 'developer'
    OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );

GRANT USAGE ON SCHEMA public TO {{APP_DATABASE_ROLE}};
GRANT SELECT, INSERT, UPDATE, DELETE ON users, auth_sessions, tenants, tenant_memberships, audit_events TO {{APP_DATABASE_ROLE}};

