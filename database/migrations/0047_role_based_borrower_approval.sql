-- Preserve the creator role so borrower approval policy remains auditable even
-- if that user's membership changes after the client was registered.

ALTER TABLE borrowers
  ADD COLUMN created_by_role text NOT NULL DEFAULT 'legacy'
    CHECK (created_by_role IN ('owner', 'supervisor', 'collector', 'legacy'));

UPDATE borrowers borrower
   SET created_by_role = membership.role
  FROM tenant_memberships membership
 WHERE membership.tenant_id = borrower.tenant_id
   AND membership.user_id = borrower.created_by
   AND membership.role IN ('owner', 'supervisor', 'collector');
