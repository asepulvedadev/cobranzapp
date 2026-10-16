-- Assign each borrower to one collector and generate auditable, date-specific
-- collection routes without exposing names or addresses to the route model.

ALTER TABLE borrowers
  ADD COLUMN assigned_collector_id uuid NULL;

ALTER TABLE borrowers
  ADD CONSTRAINT borrowers_assigned_collector_fk
  FOREIGN KEY (tenant_id, assigned_collector_id)
  REFERENCES tenant_memberships (tenant_id, user_id);

UPDATE borrowers borrower
   SET assigned_collector_id = borrower.created_by
 WHERE borrower.created_by_role = 'collector'
   AND EXISTS (
     SELECT 1
       FROM tenant_memberships membership
      WHERE membership.tenant_id = borrower.tenant_id
        AND membership.user_id = borrower.created_by
        AND membership.role = 'collector'
        AND membership.status = 'active'
   );

CREATE INDEX borrowers_assigned_collector_idx
  ON borrowers (tenant_id, assigned_collector_id, status)
  WHERE assigned_collector_id IS NOT NULL;

ALTER TABLE collection_routes
  ADD COLUMN service_date date NULL,
  ADD COLUMN generation_mode text NOT NULL DEFAULT 'manual'
    CHECK (generation_mode IN ('manual', 'automatic')),
  ADD COLUMN generated_at timestamptz NULL;

ALTER TABLE collection_routes
  ADD CONSTRAINT collection_routes_generation_metadata_check CHECK (
    (generation_mode = 'manual' AND generated_at IS NULL)
    OR
    (generation_mode = 'automatic' AND service_date IS NOT NULL AND generated_at IS NOT NULL
      AND assigned_collector_id IS NOT NULL)
  );

CREATE UNIQUE INDEX collection_routes_automatic_day_unique_idx
  ON collection_routes (tenant_id, assigned_collector_id, service_date)
  WHERE generation_mode = 'automatic';

ALTER TABLE collection_route_stops
  DROP CONSTRAINT collection_route_stops_visit_status_check;

UPDATE collection_route_stops
   SET visit_status = 'not_home'
 WHERE visit_status = 'skipped';

ALTER TABLE collection_route_stops
  ADD CONSTRAINT collection_route_stops_visit_status_check
    CHECK (visit_status IN ('pending', 'visited', 'not_home'));

CREATE TABLE collection_route_generation_runs (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_date date NOT NULL,
  status text NOT NULL CHECK (status IN ('processing', 'completed', 'failed')),
  route_count integer NOT NULL DEFAULT 0 CHECK (route_count >= 0),
  stop_count integer NOT NULL DEFAULT 0 CHECK (stop_count >= 0),
  planner text NULL CHECK (planner IS NULL OR planner IN ('agent', 'fallback')),
  error_code text NULL CHECK (error_code IS NULL OR length(error_code) <= 120),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL,
  PRIMARY KEY (tenant_id, service_date)
);

ALTER TABLE collection_route_generation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_route_generation_runs FORCE ROW LEVEL SECURITY;

CREATE POLICY route_generation_worker_access ON collection_route_generation_runs
  FOR ALL TO {{WORKER_DATABASE_ROLE}}
  USING (true)
  WITH CHECK (true);

CREATE POLICY tenants_route_worker_select ON tenants
  FOR SELECT TO {{WORKER_DATABASE_ROLE}}
  USING (status = 'active');

CREATE POLICY memberships_route_worker_select ON tenant_memberships
  FOR SELECT TO {{WORKER_DATABASE_ROLE}}
  USING (role = 'collector' AND status = 'active');

CREATE POLICY users_route_worker_select ON users
  FOR SELECT TO {{WORKER_DATABASE_ROLE}}
  USING (status = 'active');

CREATE POLICY borrowers_route_worker_select ON borrowers
  FOR SELECT TO {{WORKER_DATABASE_ROLE}}
  USING (status = 'active' AND assigned_collector_id IS NOT NULL);

CREATE POLICY borrower_identities_route_worker_select ON borrower_identities
  FOR SELECT TO {{WORKER_DATABASE_ROLE}}
  USING (verification_state = 'reviewed');

CREATE POLICY borrower_locations_route_worker_select ON borrower_address_locations
  FOR SELECT TO {{WORKER_DATABASE_ROLE}}
  USING (true);

CREATE POLICY loan_applications_route_worker_select ON loan_applications
  FOR SELECT TO {{WORKER_DATABASE_ROLE}}
  USING (status = 'active');

CREATE POLICY collection_routes_worker_insert ON collection_routes
  FOR INSERT TO {{WORKER_DATABASE_ROLE}}
  WITH CHECK (generation_mode = 'automatic' AND assigned_collector_id IS NOT NULL);

CREATE POLICY collection_route_stops_worker_insert ON collection_route_stops
  FOR INSERT TO {{WORKER_DATABASE_ROLE}}
  WITH CHECK (true);

CREATE POLICY collection_routes_assigned_collector_update ON collection_routes
  FOR UPDATE TO {{APP_DATABASE_ROLE}}
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND assigned_collector_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    AND current_setting('app.tenant_role', true) = 'collector'
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND assigned_collector_id = NULLIF(current_setting('app.user_id', true), '')::uuid
  );

CREATE POLICY collection_route_stops_staff_update ON collection_route_stops
  FOR UPDATE TO {{APP_DATABASE_ROLE}}
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND (
      current_setting('app.tenant_role', true) IN ('owner', 'supervisor')
      OR (
        current_setting('app.tenant_role', true) = 'collector'
        AND EXISTS (
          SELECT 1
            FROM collection_routes route
           WHERE route.tenant_id = collection_route_stops.tenant_id
             AND route.id = collection_route_stops.route_id
             AND route.assigned_collector_id = NULLIF(current_setting('app.user_id', true), '')::uuid
        )
      )
    )
  )
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY audit_worker_route_insert ON audit_events
  FOR INSERT TO {{WORKER_DATABASE_ROLE}}
  WITH CHECK (
    tenant_id IS NOT NULL
    AND actor_user_id IS NULL
    AND action = 'collection_route.generated'
    AND target_type = 'collection_route'
  );

GRANT SELECT ON tenants, tenant_memberships, users, borrowers, borrower_identities,
  borrower_address_locations, loan_applications TO {{WORKER_DATABASE_ROLE}};
GRANT EXECUTE ON FUNCTION loan_installment_due_date(date, text, integer)
  TO {{WORKER_DATABASE_ROLE}};
GRANT SELECT, INSERT, UPDATE ON collection_route_generation_runs TO {{WORKER_DATABASE_ROLE}};
GRANT INSERT ON collection_routes, collection_route_stops TO {{WORKER_DATABASE_ROLE}};
