ALTER TABLE tenants
  ADD COLUMN membership_plan text NULL CHECK (membership_plan IN ('pro', 'ultra'));

CREATE INDEX tenants_membership_plan_idx
  ON tenants (membership_plan, status);
