-- Updating a subscription also evaluates SELECT visibility for the new row.
-- Keep consumed subscriptions visible to their owner so consumption can commit
-- while preserving the available-subscription filter in onboarding queries.
DROP POLICY user_memberships_owner_select ON user_memberships;

CREATE POLICY user_memberships_owner_select ON user_memberships
  FOR SELECT
  USING (
    user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    AND status = 'active'
  );
