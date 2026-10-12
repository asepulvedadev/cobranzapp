ALTER TABLE users
  ADD COLUMN profile_phone text NULL,
  ADD COLUMN profile_home_address text NULL,
  ADD COLUMN profile_work_address text NULL,
  ADD COLUMN profile_photo_object_key text NULL;

ALTER TABLE users
  ADD CONSTRAINT users_profile_phone_length_check
    CHECK (profile_phone IS NULL OR char_length(profile_phone) <= 30),
  ADD CONSTRAINT users_profile_home_address_length_check
    CHECK (profile_home_address IS NULL OR char_length(profile_home_address) <= 240),
  ADD CONSTRAINT users_profile_work_address_length_check
    CHECK (profile_work_address IS NULL OR char_length(profile_work_address) <= 240),
  ADD CONSTRAINT users_profile_photo_key_check
    CHECK (
      profile_photo_object_key IS NULL
      OR profile_photo_object_key LIKE ('users/' || id::text || '/profile/%')
    );

CREATE INDEX users_profile_photo_idx
  ON users (id)
  WHERE profile_photo_object_key IS NOT NULL;

