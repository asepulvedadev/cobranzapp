-- Assign route templates to one active collector without enabling payment capture or offline work.

ALTER TABLE collection_routes
  ADD COLUMN assigned_collector_id uuid NULL;

ALTER TABLE collection_routes
  ADD CONSTRAINT collection_routes_assigned_collector_fk
  FOREIGN KEY (tenant_id, assigned_collector_id)
  REFERENCES tenant_memberships (tenant_id, user_id);

CREATE INDEX collection_routes_assigned_collector_idx
  ON collection_routes (tenant_id, assigned_collector_id)
  WHERE assigned_collector_id IS NOT NULL;

