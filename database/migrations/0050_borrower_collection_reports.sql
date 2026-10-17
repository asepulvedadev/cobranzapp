-- Append-only collection outcomes reported from a borrower's profile.
-- A later payment or a newer contact outcome supersedes an adverse report in
-- the shared verifier without deleting the original audit evidence.

CREATE TABLE borrower_collection_reports (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  borrower_id uuid NOT NULL,
  reason text NOT NULL CHECK (reason IN ('payment_postponed', 'refuses_payment', 'unreachable')),
  follow_up_date date NULL,
  notes text NULL CHECK (notes IS NULL OR length(notes) BETWEEN 3 AND 500),
  reported_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, borrower_id) REFERENCES borrowers(tenant_id, id) ON DELETE CASCADE,
  CHECK (
    (reason = 'payment_postponed' AND follow_up_date IS NOT NULL)
    OR (reason <> 'payment_postponed' AND follow_up_date IS NULL)
  )
);

CREATE INDEX borrower_collection_reports_timeline_idx
  ON borrower_collection_reports (tenant_id, borrower_id, created_at DESC, id DESC);

CREATE INDEX borrower_collection_reports_follow_up_idx
  ON borrower_collection_reports (tenant_id, reported_by, follow_up_date)
  WHERE reason = 'payment_postponed';

ALTER TABLE borrower_collection_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE borrower_collection_reports FORCE ROW LEVEL SECURITY;

CREATE POLICY borrower_collection_reports_staff_select ON borrower_collection_reports
  FOR SELECT
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND (
      current_setting('app.tenant_role', true) IN ('owner', 'supervisor')
      OR EXISTS (
        SELECT 1
          FROM borrowers borrower
         WHERE borrower.tenant_id = borrower_collection_reports.tenant_id
           AND borrower.id = borrower_collection_reports.borrower_id
           AND borrower.assigned_collector_id = NULLIF(current_setting('app.user_id', true), '')::uuid
      )
    )
  );

CREATE POLICY borrower_collection_reports_staff_insert ON borrower_collection_reports
  FOR INSERT
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND reported_by = NULLIF(current_setting('app.user_id', true), '')::uuid
    AND (
      current_setting('app.tenant_role', true) IN ('owner', 'supervisor')
      OR EXISTS (
        SELECT 1
          FROM borrowers borrower
         WHERE borrower.tenant_id = borrower_collection_reports.tenant_id
           AND borrower.id = borrower_collection_reports.borrower_id
           AND borrower.assigned_collector_id = NULLIF(current_setting('app.user_id', true), '')::uuid
      )
    )
  );

GRANT SELECT, INSERT ON borrower_collection_reports TO {{APP_DATABASE_ROLE}};

CREATE OR REPLACE FUNCTION shared_client_adverse_collection_report(target_lookup_hmac bytea)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  current_tenant uuid;
  current_user_id uuid;
  adverse boolean;
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

  WITH matches AS (
    SELECT borrower.tenant_id, borrower.id
      FROM public.borrowers borrower
      JOIN public.borrower_identities identity
        ON identity.tenant_id = borrower.tenant_id
       AND identity.borrower_id = borrower.id
     WHERE identity.shared_lookup_hmac = target_lookup_hmac
       AND borrower.status = 'active'
  ),
  latest_reports AS (
    SELECT DISTINCT ON (report.tenant_id, report.borrower_id)
           report.tenant_id,
           report.borrower_id,
           report.reason,
           report.created_at
      FROM public.borrower_collection_reports report
      JOIN matches match
        ON match.tenant_id = report.tenant_id
       AND match.id = report.borrower_id
     ORDER BY report.tenant_id, report.borrower_id, report.created_at DESC, report.id DESC
  )
  SELECT EXISTS (
    SELECT 1
      FROM latest_reports report
     WHERE report.reason IN ('refuses_payment', 'unreachable')
       AND NOT EXISTS (
         SELECT 1
           FROM public.loan_payments payment
           JOIN public.loan_applications application
             ON application.tenant_id = payment.tenant_id
            AND application.id = payment.application_id
          WHERE application.tenant_id = report.tenant_id
            AND application.borrower_id = report.borrower_id
            AND payment.paid_at > report.created_at
       )
  ) INTO adverse;

  RETURN COALESCE(adverse, false);
END;
$$;

REVOKE ALL ON FUNCTION shared_client_adverse_collection_report(bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION shared_client_adverse_collection_report(bytea) TO {{APP_DATABASE_ROLE}};
