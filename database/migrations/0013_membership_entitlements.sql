ALTER TABLE tenants
  ADD COLUMN additional_employee_seats integer NOT NULL DEFAULT 0
    CHECK (additional_employee_seats BETWEEN 0 AND 1000),
  ADD COLUMN membership_entitlement_version integer NOT NULL DEFAULT 1
    CHECK (membership_entitlement_version > 0);

CREATE TABLE tenant_membership_entitlement_versions (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version > 0),
  membership_plan text NOT NULL CHECK (membership_plan IN ('pro', 'ultra')),
  included_employee_seats integer NOT NULL CHECK (included_employee_seats >= 0),
  additional_employee_seats integer NOT NULL CHECK (additional_employee_seats >= 0),
  client_limit integer NOT NULL CHECK (client_limit > 0),
  priority_support boolean NOT NULL,
  catalog_version integer NOT NULL CHECK (catalog_version > 0),
  changed_by uuid NOT NULL REFERENCES users(id),
  request_id text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, version)
);

INSERT INTO tenant_membership_entitlement_versions (
  tenant_id, version, membership_plan, included_employee_seats,
  additional_employee_seats, client_limit, priority_support,
  catalog_version, changed_by, request_id
)
SELECT
  tenant.id,
  1,
  tenant.membership_plan,
  CASE tenant.membership_plan WHEN 'pro' THEN 5 ELSE 50 END,
  0,
  CASE tenant.membership_plan WHEN 'pro' THEN 100 ELSE 200 END,
  tenant.membership_plan = 'ultra',
  1,
  tenant.created_by,
  'migration:0013-membership-entitlements'
FROM tenants tenant
WHERE tenant.membership_plan IS NOT NULL;

ALTER TABLE tenant_membership_entitlement_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_membership_entitlement_versions FORCE ROW LEVEL SECURITY;

CREATE POLICY membership_entitlement_versions_scoped_select
  ON tenant_membership_entitlement_versions
  FOR SELECT
  USING (
    current_setting('app.platform_role', true) = 'developer'
    OR (
      tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
      AND NULLIF(current_setting('app.tenant_role', true), '') IN ('owner', 'supervisor')
    )
  );

CREATE POLICY membership_entitlement_versions_platform_insert
  ON tenant_membership_entitlement_versions
  FOR INSERT
  WITH CHECK (current_setting('app.platform_role', true) = 'developer');

CREATE FUNCTION tenant_active_employee_seat_count(target_tenant_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT (
    current_setting('app.platform_role', true) = 'developer'
    OR target_tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    OR target_tenant_id = NULLIF(current_setting('app.invitation_tenant_id', true), '')::uuid
  ) THEN
    RAISE EXCEPTION 'tenant context required' USING ERRCODE = '42501';
  END IF;

  RETURN (
    SELECT count(*)::integer
      FROM public.tenant_memberships membership
     WHERE membership.tenant_id = target_tenant_id
       AND membership.status = 'active'
       AND membership.role IN ('supervisor', 'collector')
  );
END;
$$;

REVOKE ALL ON FUNCTION tenant_active_employee_seat_count(uuid) FROM PUBLIC;

GRANT SELECT, INSERT ON tenant_membership_entitlement_versions TO {{APP_DATABASE_ROLE}};
GRANT EXECUTE ON FUNCTION tenant_active_employee_seat_count(uuid) TO {{APP_DATABASE_ROLE}};
