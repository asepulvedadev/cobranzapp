-- Keep an explicit audit trail that the operator checked the full home/work
-- address before using it for collections or navigation.

ALTER TABLE borrowers
  ADD COLUMN home_address_status text NOT NULL DEFAULT 'pending'
    CHECK (home_address_status IN ('pending', 'confirmed')),
  ADD COLUMN work_address_status text NOT NULL DEFAULT 'pending'
    CHECK (work_address_status IN ('pending', 'confirmed')),
  ADD COLUMN home_address_confirmed_at timestamptz NULL,
  ADD COLUMN work_address_confirmed_at timestamptz NULL,
  ADD COLUMN home_address_confirmed_by uuid NULL REFERENCES users(id),
  ADD COLUMN work_address_confirmed_by uuid NULL REFERENCES users(id);

CREATE INDEX borrowers_address_confirmation_idx
  ON borrowers (tenant_id, home_address_status, work_address_status);
