ALTER TABLE users
  ADD COLUMN mfa_secret_encrypted text NULL,
  ADD COLUMN mfa_setup_expires_at timestamptz NULL,
  ADD COLUMN mfa_enabled_at timestamptz NULL,
  ADD COLUMN mfa_last_used_counter bigint NULL,
  ADD CONSTRAINT users_mfa_secret_required CHECK (
    mfa_enabled_at IS NULL OR mfa_secret_encrypted IS NOT NULL
  );

CREATE TABLE auth_mfa_recovery_codes (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash bytea NOT NULL,
  used_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, code_hash)
);

CREATE INDEX auth_mfa_recovery_codes_available_idx
  ON auth_mfa_recovery_codes (user_id)
  WHERE used_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON auth_mfa_recovery_codes TO {{APP_DATABASE_ROLE}};
