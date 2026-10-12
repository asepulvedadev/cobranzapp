DROP POLICY branches_scoped_select ON branches;
CREATE POLICY branches_scoped_select ON branches
  FOR SELECT
  USING (
    current_setting('app.platform_role', true) = 'developer'
    OR (
      tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
      AND (
        current_setting('app.tenant_role', true) IN ('owner', 'supervisor')
        OR (
          current_setting('app.tenant_role', true) = 'collector'
          AND EXISTS (
            SELECT 1
              FROM teams scoped_team
              JOIN team_memberships scoped_membership
                ON scoped_membership.tenant_id = scoped_team.tenant_id
               AND scoped_membership.team_id = scoped_team.id
             WHERE scoped_team.tenant_id = branches.tenant_id
               AND scoped_team.branch_id = branches.id
               AND scoped_membership.user_id = NULLIF(
                 current_setting('app.user_id', true),
                 ''
               )::uuid
          )
        )
      )
    )
  );

DROP POLICY teams_scoped_select ON teams;
CREATE POLICY teams_scoped_select ON teams
  FOR SELECT
  USING (
    current_setting('app.platform_role', true) = 'developer'
    OR (
      tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
      AND (
        current_setting('app.tenant_role', true) IN ('owner', 'supervisor')
        OR (
          current_setting('app.tenant_role', true) = 'collector'
          AND EXISTS (
            SELECT 1
              FROM team_memberships scoped_membership
             WHERE scoped_membership.tenant_id = teams.tenant_id
               AND scoped_membership.team_id = teams.id
               AND scoped_membership.user_id = NULLIF(
                 current_setting('app.user_id', true),
                 ''
               )::uuid
          )
        )
      )
    )
  );

DROP POLICY team_memberships_scoped_select ON team_memberships;
CREATE POLICY team_memberships_scoped_select ON team_memberships
  FOR SELECT
  USING (
    current_setting('app.platform_role', true) = 'developer'
    OR (
      tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
      AND (
        current_setting('app.tenant_role', true) IN ('owner', 'supervisor')
        OR user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
      )
    )
  );
