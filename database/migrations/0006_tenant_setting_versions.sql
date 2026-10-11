CREATE TABLE tenant_setting_versions (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version > 0),
  primary_color text NOT NULL CHECK (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  accent_color text NOT NULL CHECK (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  contact_email citext NULL,
  contact_phone text NULL,
  address text NULL,
  changed_by uuid NOT NULL REFERENCES users(id),
  changed_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, version)
);

INSERT INTO tenant_setting_versions (
  tenant_id,
  version,
  primary_color,
  accent_color,
  contact_email,
  contact_phone,
  address,
  changed_by,
  changed_at
)
SELECT
  tenant_id,
  version,
  primary_color,
  accent_color,
  contact_email,
  contact_phone,
  address,
  updated_by,
  updated_at
FROM tenant_settings;

ALTER TABLE tenant_setting_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_setting_versions FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_setting_versions_scoped_select ON tenant_setting_versions
  FOR SELECT
  USING (
    current_setting('app.platform_role', true) = 'developer'
    OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );

CREATE POLICY tenant_setting_versions_platform_or_owner_insert ON tenant_setting_versions
  FOR INSERT
  WITH CHECK (
    current_setting('app.platform_role', true) = 'developer'
    OR (
      tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
      AND current_setting('app.tenant_role', true) = 'owner'
    )
  );

GRANT SELECT, INSERT ON tenant_setting_versions TO {{APP_DATABASE_ROLE}};
