-- Private identity-document evidence for supervisors and collectors.
-- Files remain opaque storage references and are never exposed as public URLs.

ALTER TABLE tenant_member_profiles
  ADD COLUMN identity_front_object_key text NULL,
  ADD COLUMN identity_back_object_key text NULL;

ALTER TABLE tenant_member_profiles
  ADD CONSTRAINT tenant_member_profiles_identity_front_key_check
    CHECK (identity_front_object_key IS NULL OR identity_front_object_key LIKE 'tenant/%/members/%/identity/%'),
  ADD CONSTRAINT tenant_member_profiles_identity_back_key_check
    CHECK (identity_back_object_key IS NULL OR identity_back_object_key LIKE 'tenant/%/members/%/identity/%');
