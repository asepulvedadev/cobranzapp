-- Draftable collection route templates. This migration does not authorize cash collection,
-- payment capture, offline operation, or geolocation tracking.

CREATE TABLE collection_routes (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(name) BETWEEN 2 AND 120),
  description text NULL CHECK (description IS NULL OR length(description) BETWEEN 1 AND 240),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  branch_id uuid NULL,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (tenant_id, branch_id) REFERENCES branches(tenant_id, id)
);

CREATE UNIQUE INDEX collection_routes_name_unique_idx
  ON collection_routes (tenant_id, lower(name));

CREATE TABLE collection_route_stops (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL,
  borrower_id uuid NOT NULL,
  address_kind text NOT NULL CHECK (address_kind IN ('home', 'work')),
  position integer NOT NULL CHECK (position > 0),
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, route_id) REFERENCES collection_routes(tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, borrower_id) REFERENCES borrowers(tenant_id, id)
);

CREATE UNIQUE INDEX collection_route_stops_borrower_unique_idx
  ON collection_route_stops (tenant_id, route_id, borrower_id);
CREATE INDEX collection_route_stops_order_idx
  ON collection_route_stops (tenant_id, route_id, position, id);

ALTER TABLE collection_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_routes FORCE ROW LEVEL SECURITY;
ALTER TABLE collection_route_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_route_stops FORCE ROW LEVEL SECURITY;

CREATE POLICY collection_routes_staff_select ON collection_routes
  FOR SELECT
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND EXISTS (
      SELECT 1 FROM tenant_memberships membership
       WHERE membership.tenant_id = collection_routes.tenant_id
         AND membership.user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
         AND membership.status = 'active'
         AND membership.role IN ('owner', 'supervisor', 'collector')
    )
  );

CREATE POLICY collection_routes_manager_write ON collection_routes
  FOR INSERT
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND EXISTS (
      SELECT 1 FROM tenant_memberships membership
       WHERE membership.tenant_id = collection_routes.tenant_id
         AND membership.user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
         AND membership.status = 'active'
         AND membership.role IN ('owner', 'supervisor')
    )
  );

CREATE POLICY collection_routes_manager_update ON collection_routes
  FOR UPDATE
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND EXISTS (
      SELECT 1 FROM tenant_memberships membership
       WHERE membership.tenant_id = collection_routes.tenant_id
         AND membership.user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
         AND membership.status = 'active'
         AND membership.role IN ('owner', 'supervisor')
    )
  )
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY collection_route_stops_staff_select ON collection_route_stops
  FOR SELECT
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND EXISTS (
      SELECT 1 FROM tenant_memberships membership
       WHERE membership.tenant_id = collection_route_stops.tenant_id
         AND membership.user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
         AND membership.status = 'active'
         AND membership.role IN ('owner', 'supervisor', 'collector')
    )
  );

CREATE POLICY collection_route_stops_manager_write ON collection_route_stops
  FOR INSERT
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND EXISTS (
      SELECT 1 FROM tenant_memberships membership
       WHERE membership.tenant_id = collection_route_stops.tenant_id
         AND membership.user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
         AND membership.status = 'active'
         AND membership.role IN ('owner', 'supervisor')
    )
  );

GRANT SELECT, INSERT, UPDATE ON collection_routes, collection_route_stops TO {{APP_DATABASE_ROLE}};
