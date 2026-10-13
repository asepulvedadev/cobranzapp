-- Operational visit status for route stops. This does not capture GPS or
-- payment data; it only records the collector's disposition and audit time.

ALTER TABLE collection_route_stops
  ADD COLUMN visit_status text NOT NULL DEFAULT 'pending'
    CHECK (visit_status IN ('pending', 'visited', 'skipped')),
  ADD COLUMN visited_at timestamptz NULL,
  ADD COLUMN visited_by uuid NULL REFERENCES users(id),
  ADD COLUMN visit_notes text NULL CHECK (visit_notes IS NULL OR length(visit_notes) BETWEEN 1 AND 500);

CREATE INDEX collection_route_stops_visit_idx
  ON collection_route_stops (tenant_id, route_id, visit_status, position);
