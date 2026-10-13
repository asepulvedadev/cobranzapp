-- A loan created by a supervisor or collector is immediately active. Review
-- remains available for legacy applications, but is no longer required for new loans.

ALTER TABLE loan_applications
  DROP CONSTRAINT loan_applications_status_check,
  ADD CONSTRAINT loan_applications_status_check
    CHECK (status IN ('draft', 'submitted', 'under_review', 'approved', 'active', 'paid', 'rejected', 'cancelled'));
