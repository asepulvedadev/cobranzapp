-- Turn owner memberships into an auditable subscription ledger managed from
-- the developer console. Existing subscriptions receive a one-month period
-- and the approved catalog price without changing their current assignment.

ALTER TABLE user_memberships
  DROP CONSTRAINT user_memberships_status_check;

ALTER TABLE user_memberships
  ADD CONSTRAINT user_memberships_status_check
    CHECK (status IN ('active', 'suspended', 'expired', 'cancelled')),
  ADD COLUMN billing_cycle text NOT NULL DEFAULT 'monthly'
    CHECK (billing_cycle IN ('monthly', 'yearly')),
  ADD COLUMN amount_cop bigint NOT NULL DEFAULT 150000
    CHECK (amount_cop >= 0 AND amount_cop <= 1000000000000),
  ADD COLUMN current_period_start date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN current_period_end date NOT NULL DEFAULT (CURRENT_DATE + 30),
  ADD COLUMN auto_renew boolean NOT NULL DEFAULT true,
  ADD COLUMN internal_notes text NULL
    CHECK (internal_notes IS NULL OR length(internal_notes) <= 500);

UPDATE user_memberships
   SET amount_cop = CASE membership_plan
     WHEN 'ultra' THEN 300000
     ELSE 150000
   END,
       current_period_start = activated_at::date,
       current_period_end = (activated_at::date + INTERVAL '1 month')::date;

ALTER TABLE user_memberships
  ADD CONSTRAINT user_memberships_billing_period_check
    CHECK (current_period_end >= current_period_start);

CREATE INDEX user_memberships_platform_directory_idx
  ON user_memberships (status, current_period_end, activated_at DESC);

CREATE INDEX user_memberships_consumed_tenant_idx
  ON user_memberships (consumed_tenant_id)
  WHERE consumed_tenant_id IS NOT NULL;

CREATE POLICY user_memberships_worker_lifecycle_select ON user_memberships
  FOR SELECT TO {{WORKER_DATABASE_ROLE}}
  USING (true);

CREATE POLICY user_memberships_worker_lifecycle_update ON user_memberships
  FOR UPDATE TO {{WORKER_DATABASE_ROLE}}
  USING (true)
  WITH CHECK (true);

CREATE POLICY tenants_subscription_worker_select ON tenants
  FOR SELECT TO {{WORKER_DATABASE_ROLE}}
  USING (
    EXISTS (
      SELECT 1 FROM user_memberships subscription
       WHERE subscription.consumed_tenant_id = tenants.id
    )
  );

CREATE POLICY tenants_subscription_worker_update ON tenants
  FOR UPDATE TO {{WORKER_DATABASE_ROLE}}
  USING (
    EXISTS (
      SELECT 1 FROM user_memberships subscription
       WHERE subscription.consumed_tenant_id = tenants.id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_memberships subscription
       WHERE subscription.consumed_tenant_id = tenants.id
    )
  );

CREATE POLICY audit_worker_subscription_insert ON audit_events
  FOR INSERT TO {{WORKER_DATABASE_ROLE}}
  WITH CHECK (
    actor_user_id IS NULL
    AND action IN ('subscription.renewed', 'subscription.expired')
    AND target_type = 'subscription'
  );

GRANT SELECT, UPDATE ON user_memberships TO {{WORKER_DATABASE_ROLE}};
GRANT SELECT, UPDATE ON tenants TO {{WORKER_DATABASE_ROLE}};
GRANT INSERT ON audit_events TO {{WORKER_DATABASE_ROLE}};
