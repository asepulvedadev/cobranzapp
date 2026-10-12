CREATE TABLE user_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  membership_plan text NOT NULL CHECK (membership_plan IN ('pro', 'ultra')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'expired')),
  activated_at timestamptz NOT NULL DEFAULT now(),
  deactivated_at timestamptz NULL,
  assigned_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'active' AND deactivated_at IS NULL) OR (status <> 'active'))
);

CREATE UNIQUE INDEX user_memberships_one_active_idx
  ON user_memberships (user_id)
  WHERE status = 'active';

CREATE INDEX user_memberships_user_history_idx
  ON user_memberships (user_id, activated_at DESC);

ALTER TABLE user_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_memberships FORCE ROW LEVEL SECURITY;

CREATE POLICY user_memberships_platform_all ON user_memberships
  FOR ALL
  USING (current_setting('app.platform_role', true) = 'developer')
  WITH CHECK (current_setting('app.platform_role', true) = 'developer');

GRANT SELECT, INSERT, UPDATE, DELETE ON user_memberships TO {{APP_DATABASE_ROLE}};
