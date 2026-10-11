CREATE TABLE tenant_settings (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  primary_color text NOT NULL DEFAULT '#171717' CHECK (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  accent_color text NOT NULL DEFAULT '#FBBF24' CHECK (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  contact_email citext NULL,
  contact_phone text NULL,
  address text NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_by uuid NOT NULL REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE branches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code citext NOT NULL,
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, code),
  CHECK (code = lower(code::text)),
  CHECK (code::text ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE TABLE teams (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id uuid NULL,
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, branch_id) REFERENCES branches(tenant_id, id)
);

CREATE TABLE team_memberships (
  tenant_id uuid NOT NULL,
  team_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, team_id, user_id),
  FOREIGN KEY (tenant_id, team_id) REFERENCES teams(tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, user_id) REFERENCES tenant_memberships(tenant_id, user_id) ON DELETE CASCADE
);

CREATE TABLE tenant_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email citext NOT NULL,
  role text NOT NULL CHECK (role IN ('owner', 'supervisor', 'collector', 'customer')),
  token_hash bytea NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz NULL,
  revoked_at timestamptz NULL,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (email = lower(email::text)),
  CHECK (expires_at > created_at)
);

CREATE UNIQUE INDEX tenant_invitations_pending_email_idx
  ON tenant_invitations (tenant_id, email)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

CREATE INDEX tenant_invitations_tenant_state_idx
  ON tenant_invitations (tenant_id, expires_at DESC)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches FORCE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams FORCE ROW LEVEL SECURITY;
ALTER TABLE team_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE tenant_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_invitations FORCE ROW LEVEL SECURITY;

DROP POLICY memberships_platform_or_self_select ON tenant_memberships;
CREATE POLICY memberships_platform_tenant_or_self_select ON tenant_memberships
  FOR SELECT
  USING (
    current_setting('app.platform_role', true) = 'developer'
    OR user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    OR (
      tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
      AND current_setting('app.tenant_role', true) IN ('owner', 'supervisor')
    )
  );

CREATE POLICY tenants_invitation_select ON tenants
  FOR SELECT
  USING (id = NULLIF(current_setting('app.invitation_tenant_id', true), '')::uuid);

DROP POLICY memberships_platform_write ON tenant_memberships;
CREATE POLICY memberships_platform_or_owner_write ON tenant_memberships
  FOR ALL
  USING (
    current_setting('app.platform_role', true) = 'developer'
    OR (
      tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
      AND current_setting('app.tenant_role', true) = 'owner'
    )
  )
  WITH CHECK (
    current_setting('app.platform_role', true) = 'developer'
    OR (
      tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
      AND current_setting('app.tenant_role', true) = 'owner'
    )
  );

CREATE POLICY memberships_invitation_insert ON tenant_memberships
  FOR INSERT
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.invitation_tenant_id', true), '')::uuid
    AND user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    AND role = current_setting('app.invitation_role', true)
  );

CREATE POLICY tenant_settings_scoped_select ON tenant_settings
  FOR SELECT
  USING (
    current_setting('app.platform_role', true) = 'developer'
    OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );

CREATE POLICY tenant_settings_platform_or_owner_write ON tenant_settings
  FOR ALL
  USING (
    current_setting('app.platform_role', true) = 'developer'
    OR (
      tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
      AND current_setting('app.tenant_role', true) = 'owner'
    )
  )
  WITH CHECK (
    current_setting('app.platform_role', true) = 'developer'
    OR (
      tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
      AND current_setting('app.tenant_role', true) = 'owner'
    )
  );

CREATE POLICY branches_scoped_select ON branches
  FOR SELECT
  USING (
    current_setting('app.platform_role', true) = 'developer'
    OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );

CREATE POLICY branches_manager_write ON branches
  FOR ALL
  USING (
    current_setting('app.platform_role', true) = 'developer'
    OR (
      tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
      AND current_setting('app.tenant_role', true) IN ('owner', 'supervisor')
    )
  )
  WITH CHECK (
    current_setting('app.platform_role', true) = 'developer'
    OR (
      tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
      AND current_setting('app.tenant_role', true) IN ('owner', 'supervisor')
    )
  );

CREATE POLICY teams_scoped_select ON teams
  FOR SELECT
  USING (
    current_setting('app.platform_role', true) = 'developer'
    OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );

CREATE POLICY teams_manager_write ON teams
  FOR ALL
  USING (
    current_setting('app.platform_role', true) = 'developer'
    OR (
      tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
      AND current_setting('app.tenant_role', true) IN ('owner', 'supervisor')
    )
  )
  WITH CHECK (
    current_setting('app.platform_role', true) = 'developer'
    OR (
      tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
      AND current_setting('app.tenant_role', true) IN ('owner', 'supervisor')
    )
  );

CREATE POLICY team_memberships_scoped_select ON team_memberships
  FOR SELECT
  USING (
    current_setting('app.platform_role', true) = 'developer'
    OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );

CREATE POLICY team_memberships_manager_write ON team_memberships
  FOR ALL
  USING (
    current_setting('app.platform_role', true) = 'developer'
    OR (
      tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
      AND current_setting('app.tenant_role', true) IN ('owner', 'supervisor')
    )
  )
  WITH CHECK (
    current_setting('app.platform_role', true) = 'developer'
    OR (
      tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
      AND current_setting('app.tenant_role', true) IN ('owner', 'supervisor')
    )
  );

CREATE POLICY tenant_invitations_administrator_select ON tenant_invitations
  FOR SELECT
  USING (
    current_setting('app.platform_role', true) = 'developer'
    OR (
      tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
      AND current_setting('app.tenant_role', true) = 'owner'
    )
  );

CREATE POLICY tenant_invitations_administrator_write ON tenant_invitations
  FOR ALL
  USING (
    current_setting('app.platform_role', true) = 'developer'
    OR (
      tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
      AND current_setting('app.tenant_role', true) = 'owner'
    )
  )
  WITH CHECK (
    current_setting('app.platform_role', true) = 'developer'
    OR (
      tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
      AND current_setting('app.tenant_role', true) = 'owner'
    )
  );

CREATE POLICY tenant_invitations_token_select ON tenant_invitations
  FOR SELECT
  USING (encode(token_hash, 'hex') = current_setting('app.invitation_token_hash', true));

CREATE POLICY tenant_invitations_token_update ON tenant_invitations
  FOR UPDATE
  USING (encode(token_hash, 'hex') = current_setting('app.invitation_token_hash', true))
  WITH CHECK (encode(token_hash, 'hex') = current_setting('app.invitation_token_hash', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON
  tenant_settings, branches, teams, team_memberships, tenant_invitations
TO {{APP_DATABASE_ROLE}};
