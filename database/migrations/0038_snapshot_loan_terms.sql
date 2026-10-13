-- Freeze the agreed financial rule on each credit so later catalog edits do not alter active loans.

ALTER TABLE loan_applications
  ADD COLUMN rate_basis text NULL,
  ADD COLUMN nominal_rate numeric(12, 8) NULL,
  ADD COLUMN documentation_fee_rate numeric(12, 8) NULL;

UPDATE loan_applications application
   SET rate_basis = product.rate_basis,
       nominal_rate = product.nominal_rate,
       documentation_fee_rate = product.documentation_fee_rate
  FROM loan_products product
 WHERE product.tenant_id = application.tenant_id
   AND product.id = application.loan_product_id;

ALTER TABLE loan_applications
  ALTER COLUMN rate_basis SET NOT NULL,
  ALTER COLUMN nominal_rate SET NOT NULL,
  ALTER COLUMN documentation_fee_rate SET NOT NULL,
  ADD CONSTRAINT loan_applications_rate_basis_check
    CHECK (rate_basis IN ('flat_total', 'periodic_simple', 'effective_annual')),
  ADD CONSTRAINT loan_applications_nominal_rate_check CHECK (nominal_rate >= 0),
  ADD CONSTRAINT loan_applications_documentation_fee_rate_check CHECK (documentation_fee_rate >= 0);
