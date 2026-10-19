-- Distinguish a new dossier from a legacy customer whose original record
-- predates the selfie/document requirements.
ALTER TABLE borrowers
  ADD COLUMN registration_type text CHECK (registration_type IN ('new', 'legacy'));

-- Rows that predate this distinction are legacy dossiers. New registrations
-- default to the stricter new-client flow.
UPDATE borrowers SET registration_type = 'legacy' WHERE registration_type IS NULL;

ALTER TABLE borrowers
  ALTER COLUMN registration_type SET DEFAULT 'new',
  ALTER COLUMN registration_type SET NOT NULL;
