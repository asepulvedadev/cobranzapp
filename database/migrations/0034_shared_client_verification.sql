-- Minimal cross-company client verification.
-- The lookup key is a keyed HMAC; the database never receives the cedula in clear text.

ALTER TABLE borrower_identities
  ADD COLUMN shared_lookup_hmac bytea NULL;

CREATE INDEX borrower_shared_lookup_idx
  ON borrower_identities (shared_lookup_hmac)
  WHERE shared_lookup_hmac IS NOT NULL;

CREATE FUNCTION shared_client_verification(target_lookup_hmac bytea)
RETURNS TABLE (
  full_name text,
  active_credit_count bigint,
  payer_rating text,
  negative_report boolean
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

  IF NOT EXISTS (
    SELECT 1
      FROM public.borrowers borrower
      JOIN public.borrower_identities identity
        ON identity.tenant_id = borrower.tenant_id AND identity.borrower_id = borrower.id
     WHERE identity.shared_lookup_hmac = target_lookup_hmac
       AND borrower.status = 'active'
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH matches AS (
    SELECT borrower.tenant_id, borrower.id, borrower.full_name
      FROM public.borrowers borrower
      JOIN public.borrower_identities identity
        ON identity.tenant_id = borrower.tenant_id AND identity.borrower_id = borrower.id
     WHERE identity.shared_lookup_hmac = target_lookup_hmac
       AND borrower.status = 'active'
  ),
  flags AS (
    SELECT
      EXISTS (
        SELECT 1
          FROM public.borrower_identity_reviews review
          JOIN matches match ON match.tenant_id = review.tenant_id AND match.id = review.borrower_id
         WHERE review.decision = 'rejected'
      ) AS has_negative,
      EXISTS (
        SELECT 1
          FROM public.borrower_identity_reviews review
          JOIN matches match ON match.tenant_id = review.tenant_id AND match.id = review.borrower_id
         WHERE review.decision = 'reviewed'
      ) AS has_reviewed,
      (
        SELECT count(*)::bigint
          FROM public.loan_applications application
          JOIN matches match
            ON match.tenant_id = application.tenant_id AND match.id = application.borrower_id
         WHERE application.status = 'approved'
      ) AS credits
  )
  SELECT
    (SELECT max(match.full_name) FROM matches match),
    flags.credits,
    CASE
      WHEN flags.has_negative THEN 'low'
      WHEN flags.has_reviewed THEN 'good'
      WHEN flags.credits > 0 THEN 'regular'
      ELSE 'no_data'
    END,
    flags.has_negative
  FROM flags;
END;
$$;

REVOKE ALL ON FUNCTION shared_client_verification(bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION shared_client_verification(bytea) TO {{APP_DATABASE_ROLE}};
