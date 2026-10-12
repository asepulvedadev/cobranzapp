ALTER TABLE tenant_settings
  ADD COLUMN logo_object_key text NULL;

ALTER TABLE tenant_settings
  ADD CONSTRAINT tenant_settings_logo_object_key_check
    CHECK (
      logo_object_key IS NULL
      OR logo_object_key LIKE ('tenant/' || tenant_id::text || '/brand/%')
    );
