-- Derive the shared verification summary from operational payment history.
-- This keeps the result minimal (name, active credits and a conservative rating)
-- while making it reflect active loans instead of the legacy approved-only state.

CREATE OR REPLACE FUNCTION loan_installment_due_date(
  start_date date,
  payment_frequency text,
  installment_number integer
)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
DECLARE
  month_start date;
  month_end date;
  original_day integer;
BEGIN
  IF installment_number < 1 THEN
    RAISE EXCEPTION 'installment number must be positive';
  END IF;

  IF payment_frequency = 'daily' THEN
    RETURN start_date + installment_number;
  ELSIF payment_frequency = 'weekly' THEN
    RETURN start_date + (installment_number * 7);
  ELSIF payment_frequency = 'fortnightly' THEN
    RETURN start_date + (installment_number * 14);
  ELSIF payment_frequency = 'monthly' THEN
    original_day := EXTRACT(DAY FROM start_date)::integer;
    month_start := (date_trunc('month', start_date) + make_interval(months => installment_number))::date;
    month_end := (month_start + interval '1 month - 1 day')::date;
    RETURN month_start + LEAST(original_day, EXTRACT(DAY FROM month_end)::integer) - 1;
  END IF;

  RAISE EXCEPTION 'unsupported payment frequency: %', payment_frequency;
END;
$$;

REVOKE ALL ON FUNCTION loan_installment_due_date(date, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION loan_installment_due_date(date, text, integer) TO {{APP_DATABASE_ROLE}};

CREATE OR REPLACE FUNCTION shared_client_verification(target_lookup_hmac bytea)
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
  active_loans AS (
    SELECT application.*,
           GREATEST(
             0,
             LEAST(
               application.requested_term_count,
               CASE application.payment_frequency
                 WHEN 'daily' THEN (CURRENT_DATE - application.created_at::date)
                 WHEN 'weekly' THEN ((CURRENT_DATE - application.created_at::date) / 7)
                 WHEN 'fortnightly' THEN ((CURRENT_DATE - application.created_at::date) / 14)
                 WHEN 'monthly' THEN (
                   EXTRACT(YEAR FROM age(CURRENT_DATE, application.created_at::date))::integer * 12
                   + EXTRACT(MONTH FROM age(CURRENT_DATE, application.created_at::date))::integer
                 )
                 ELSE 0
               END
             )
           )::integer AS due_installments
      FROM public.loan_applications application
      JOIN matches match
        ON match.tenant_id = application.tenant_id AND match.id = application.borrower_id
     WHERE application.status IN ('active', 'approved')
  ),
  payment_history AS (
    SELECT application.borrower_id,
           payment.paid_at::date AS paid_date,
           public.loan_installment_due_date(
             application.created_at::date,
             application.payment_frequency,
             payment.installment_number
           ) AS due_date
      FROM public.loan_payments payment
      JOIN public.loan_applications application
        ON application.tenant_id = payment.tenant_id
       AND application.id = payment.application_id
      JOIN matches match
        ON match.tenant_id = application.tenant_id AND match.id = application.borrower_id
  ),
  flags AS (
    SELECT
      EXISTS (
        SELECT 1 FROM public.borrower_identity_reviews review
        JOIN matches match ON match.tenant_id = review.tenant_id AND match.id = review.borrower_id
        WHERE review.decision = 'rejected'
      ) AS identity_negative,
      EXISTS (
        SELECT 1 FROM active_loans loan
        WHERE loan.due_installments > loan.paid_installments
      ) AS missed_payment,
      EXISTS (
        SELECT 1 FROM payment_history payment
        WHERE payment.paid_date > payment.due_date
      ) AS late_payment,
      EXISTS (
        SELECT 1 FROM payment_history
      ) AS has_payment_history,
      (SELECT count(*)::bigint FROM active_loans) AS credits
  )
  SELECT
    (SELECT max(match.full_name) FROM matches match),
    flags.credits,
    CASE
      WHEN flags.identity_negative OR flags.missed_payment THEN 'low'
      WHEN flags.late_payment THEN 'regular'
      WHEN flags.has_payment_history THEN 'good'
      WHEN flags.credits > 0 THEN 'regular'
      ELSE 'no_data'
    END,
    flags.identity_negative OR flags.missed_payment
  FROM flags;
END;
$$;

REVOKE ALL ON FUNCTION shared_client_verification(bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION shared_client_verification(bytea) TO {{APP_DATABASE_ROLE}};
