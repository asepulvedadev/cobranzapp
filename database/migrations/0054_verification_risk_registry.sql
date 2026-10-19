-- Minimal risk registry for identities that are not yet borrower profiles.
-- Full document numbers are encrypted and each tenant gets a distinct keyed lookup HMAC.

CREATE TABLE verification_risk_entries (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  document_lookup_hmac bytea NOT NULL,
  document_number_ciphertext text NOT NULL,
  document_last4 text NOT NULL CHECK (document_last4 ~ '^[A-Z0-9]{4}$'),
  category text NOT NULL CHECK (
    category IN ('repeated_late_payment', 'payment_default', 'unreachable')
  ),
  note text NOT NULL CHECK (length(note) BETWEEN 10 AND 500),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'expired')),
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '2 years'),
  resolved_by uuid NULL REFERENCES users(id),
  resolved_at timestamptz NULL,
  PRIMARY KEY (tenant_id, id),
  CHECK (
    (status IN ('active', 'expired') AND resolved_by IS NULL AND resolved_at IS NULL)
    OR (status = 'resolved' AND resolved_by IS NOT NULL AND resolved_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX verification_risk_entries_active_identity_idx
  ON verification_risk_entries (tenant_id, document_lookup_hmac)
  WHERE status = 'active';

CREATE INDEX verification_risk_entries_tenant_timeline_idx
  ON verification_risk_entries (tenant_id, created_at DESC, id DESC);

CREATE INDEX verification_risk_entries_shared_lookup_idx
  ON verification_risk_entries (document_lookup_hmac, created_at DESC)
  WHERE status = 'active';

ALTER TABLE verification_risk_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_risk_entries FORCE ROW LEVEL SECURITY;

CREATE POLICY verification_risk_entries_manager_select ON verification_risk_entries
  FOR SELECT
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND current_setting('app.tenant_role', true) IN ('owner', 'supervisor')
  );

CREATE POLICY verification_risk_entries_manager_insert ON verification_risk_entries
  FOR INSERT
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND created_by = NULLIF(current_setting('app.user_id', true), '')::uuid
    AND current_setting('app.tenant_role', true) IN ('owner', 'supervisor')
  );

CREATE POLICY verification_risk_entries_manager_update ON verification_risk_entries
  FOR UPDATE
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND current_setting('app.tenant_role', true) IN ('owner', 'supervisor')
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND current_setting('app.tenant_role', true) IN ('owner', 'supervisor')
  );

GRANT SELECT, INSERT, UPDATE ON verification_risk_entries TO {{APP_DATABASE_ROLE}};

CREATE OR REPLACE FUNCTION tenant_verification_risk_summary(target_lookup_hmac bytea)
RETURNS TABLE (
  report_count bigint,
  last_reported_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  current_tenant uuid;
  current_user_id uuid;
BEGIN
  current_tenant := NULLIF(current_setting('app.tenant_id', true), '')::uuid;
  current_user_id := NULLIF(current_setting('app.user_id', true), '')::uuid;

  IF NOT EXISTS (
    SELECT 1
      FROM public.tenant_memberships membership
     WHERE membership.tenant_id = current_tenant
       AND membership.user_id = current_user_id
       AND membership.status = 'active'
       AND membership.role IN ('owner', 'supervisor', 'collector')
  ) THEN
    RAISE EXCEPTION 'tenant context required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT count(*)::bigint, max(entry.created_at)
   FROM public.verification_risk_entries entry
   WHERE entry.tenant_id = current_tenant
     AND entry.document_lookup_hmac = target_lookup_hmac
     AND entry.status = 'active'
     AND entry.expires_at > now();
END;
$$;

REVOKE ALL ON FUNCTION tenant_verification_risk_summary(bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tenant_verification_risk_summary(bytea) TO {{APP_DATABASE_ROLE}};
