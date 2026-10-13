-- Optional geocoding cache for the two verified borrower addresses. The exact
-- address text remains the source of truth; coordinates only aid routing.

CREATE TABLE borrower_address_locations (
  tenant_id uuid NOT NULL,
  borrower_id uuid NOT NULL,
  address_kind text NOT NULL CHECK (address_kind IN ('home', 'work')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'ready', 'failed')),
  latitude numeric(9, 6) NULL CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
  longitude numeric(9, 6) NULL CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180)),
  formatted_address text NULL CHECK (formatted_address IS NULL OR length(formatted_address) BETWEEN 3 AND 500),
  provider text NULL CHECK (provider IS NULL OR length(provider) BETWEEN 2 AND 80),
  precision text NULL CHECK (precision IS NULL OR length(precision) BETWEEN 2 AND 80),
  error_code text NULL CHECK (error_code IS NULL OR length(error_code) BETWEEN 1 AND 120),
  geocoded_at timestamptz NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, borrower_id, address_kind),
  FOREIGN KEY (tenant_id, borrower_id) REFERENCES borrowers(tenant_id, id) ON DELETE CASCADE
);

INSERT INTO borrower_address_locations (tenant_id, borrower_id, address_kind)
SELECT tenant_id, id, address_kind
FROM borrowers
CROSS JOIN (VALUES ('home'::text), ('work'::text)) AS kinds(address_kind)
ON CONFLICT (tenant_id, borrower_id, address_kind) DO NOTHING;

CREATE INDEX borrower_address_locations_status_idx
  ON borrower_address_locations (tenant_id, status, updated_at DESC);

ALTER TABLE borrower_address_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE borrower_address_locations FORCE ROW LEVEL SECURITY;

CREATE POLICY borrower_address_locations_staff_select ON borrower_address_locations
  FOR SELECT TO {{APP_DATABASE_ROLE}}
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND EXISTS (
      SELECT 1 FROM tenant_memberships membership
       WHERE membership.tenant_id = borrower_address_locations.tenant_id
         AND membership.user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
         AND membership.status = 'active'
         AND membership.role IN ('owner', 'supervisor', 'collector')
    )
  );

CREATE POLICY borrower_address_locations_staff_write ON borrower_address_locations
  FOR ALL TO {{APP_DATABASE_ROLE}}
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE ON borrower_address_locations TO {{APP_DATABASE_ROLE}};
