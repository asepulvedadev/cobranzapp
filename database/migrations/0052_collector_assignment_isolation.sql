-- Enforce collector-to-borrower assignment at the database boundary.
-- Tenant isolation alone is not enough: a collector must not be able to read
-- or mutate another collector's clients, credits, payments, or private files.

CREATE OR REPLACE FUNCTION app_actor_can_access_borrower(
  target_tenant_id uuid,
  target_borrower_id uuid
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    target_tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND EXISTS (
      SELECT 1
        FROM public.tenant_memberships membership
       WHERE membership.tenant_id = target_tenant_id
         AND membership.user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
         AND membership.status = 'active'
         AND (
           membership.role IN ('owner', 'supervisor')
           OR (
             membership.role = 'collector'
             AND EXISTS (
               SELECT 1
                 FROM public.borrowers borrower
                WHERE borrower.tenant_id = target_tenant_id
                  AND borrower.id = target_borrower_id
                  AND borrower.assigned_collector_id = membership.user_id
             )
           )
         )
    );
$$;

CREATE OR REPLACE FUNCTION app_actor_can_create_borrower(
  target_tenant_id uuid,
  target_collector_id uuid
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    target_tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND EXISTS (
      SELECT 1
        FROM public.tenant_memberships membership
       WHERE membership.tenant_id = target_tenant_id
         AND membership.user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
         AND membership.status = 'active'
         AND (
           membership.role IN ('owner', 'supervisor')
           OR (
             membership.role = 'collector'
             AND target_collector_id = membership.user_id
           )
         )
    );
$$;

CREATE OR REPLACE FUNCTION app_actor_can_access_application(
  target_tenant_id uuid,
  target_application_id uuid
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.loan_applications application
     WHERE application.tenant_id = target_tenant_id
       AND application.id = target_application_id
       AND public.app_actor_can_access_borrower(
         application.tenant_id,
         application.borrower_id
       )
  );
$$;

CREATE OR REPLACE FUNCTION app_actor_can_access_route(
  target_tenant_id uuid,
  target_route_id uuid
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    target_tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND EXISTS (
      SELECT 1
        FROM public.tenant_memberships membership
        JOIN public.collection_routes route
          ON route.tenant_id = membership.tenant_id
         AND route.id = target_route_id
       WHERE membership.tenant_id = target_tenant_id
         AND membership.user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
         AND membership.status = 'active'
         AND (
           membership.role IN ('owner', 'supervisor')
           OR (
             membership.role = 'collector'
             AND route.assigned_collector_id = membership.user_id
           )
         )
    );
$$;

REVOKE ALL ON FUNCTION app_actor_can_access_borrower(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_actor_can_create_borrower(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_actor_can_access_application(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_actor_can_access_route(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_actor_can_access_borrower(uuid, uuid) TO {{APP_DATABASE_ROLE}};
GRANT EXECUTE ON FUNCTION app_actor_can_create_borrower(uuid, uuid) TO {{APP_DATABASE_ROLE}};
GRANT EXECUTE ON FUNCTION app_actor_can_access_application(uuid, uuid) TO {{APP_DATABASE_ROLE}};
GRANT EXECUTE ON FUNCTION app_actor_can_access_route(uuid, uuid) TO {{APP_DATABASE_ROLE}};

DROP POLICY borrowers_staff_access ON borrowers;
CREATE POLICY borrowers_staff_access ON borrowers
  FOR ALL TO {{APP_DATABASE_ROLE}}
  USING (app_actor_can_access_borrower(tenant_id, id))
  WITH CHECK (app_actor_can_create_borrower(tenant_id, assigned_collector_id));

DROP POLICY borrower_identities_staff_access ON borrower_identities;
CREATE POLICY borrower_identities_staff_access ON borrower_identities
  FOR ALL TO {{APP_DATABASE_ROLE}}
  USING (app_actor_can_access_borrower(tenant_id, borrower_id))
  WITH CHECK (app_actor_can_access_borrower(tenant_id, borrower_id));

DROP POLICY borrower_contacts_staff_access ON borrower_emergency_contacts;
CREATE POLICY borrower_contacts_staff_access ON borrower_emergency_contacts
  FOR ALL TO {{APP_DATABASE_ROLE}}
  USING (app_actor_can_access_borrower(tenant_id, borrower_id))
  WITH CHECK (app_actor_can_access_borrower(tenant_id, borrower_id));

DROP POLICY borrower_documents_staff_access ON borrower_documents;
CREATE POLICY borrower_documents_staff_access ON borrower_documents
  FOR ALL TO {{APP_DATABASE_ROLE}}
  USING (app_actor_can_access_borrower(tenant_id, borrower_id))
  WITH CHECK (app_actor_can_access_borrower(tenant_id, borrower_id));

DROP POLICY borrower_document_ocr_staff_select ON borrower_document_ocr_extractions;
CREATE POLICY borrower_document_ocr_staff_select ON borrower_document_ocr_extractions
  FOR SELECT TO {{APP_DATABASE_ROLE}}
  USING (app_actor_can_access_borrower(tenant_id, borrower_id));

DROP POLICY borrower_document_ocr_staff_insert ON borrower_document_ocr_extractions;
CREATE POLICY borrower_document_ocr_staff_insert ON borrower_document_ocr_extractions
  FOR INSERT TO {{APP_DATABASE_ROLE}}
  WITH CHECK (app_actor_can_access_borrower(tenant_id, borrower_id));

DROP POLICY borrower_document_ocr_staff_update ON borrower_document_ocr_extractions;
CREATE POLICY borrower_document_ocr_staff_update ON borrower_document_ocr_extractions
  FOR UPDATE TO {{APP_DATABASE_ROLE}}
  USING (app_actor_can_access_borrower(tenant_id, borrower_id))
  WITH CHECK (app_actor_can_access_borrower(tenant_id, borrower_id));

DROP POLICY borrower_address_locations_staff_select ON borrower_address_locations;
CREATE POLICY borrower_address_locations_staff_select ON borrower_address_locations
  FOR SELECT TO {{APP_DATABASE_ROLE}}
  USING (app_actor_can_access_borrower(tenant_id, borrower_id));

DROP POLICY borrower_address_locations_staff_write ON borrower_address_locations;
CREATE POLICY borrower_address_locations_staff_write ON borrower_address_locations
  FOR ALL TO {{APP_DATABASE_ROLE}}
  USING (app_actor_can_access_borrower(tenant_id, borrower_id))
  WITH CHECK (app_actor_can_access_borrower(tenant_id, borrower_id));

DROP POLICY loan_applications_staff_access ON loan_applications;
CREATE POLICY loan_applications_staff_access ON loan_applications
  FOR ALL TO {{APP_DATABASE_ROLE}}
  USING (app_actor_can_access_borrower(tenant_id, borrower_id))
  WITH CHECK (app_actor_can_access_borrower(tenant_id, borrower_id));

DROP POLICY loan_payments_staff_access ON loan_payments;
CREATE POLICY loan_payments_staff_access ON loan_payments
  FOR ALL TO {{APP_DATABASE_ROLE}}
  USING (app_actor_can_access_application(tenant_id, application_id))
  WITH CHECK (app_actor_can_access_application(tenant_id, application_id));

DROP POLICY borrower_portal_links_staff_access ON borrower_portal_links;
CREATE POLICY borrower_portal_links_staff_access ON borrower_portal_links
  FOR ALL TO {{APP_DATABASE_ROLE}}
  USING (app_actor_can_access_borrower(tenant_id, borrower_id))
  WITH CHECK (app_actor_can_access_borrower(tenant_id, borrower_id));

DROP POLICY collection_routes_staff_select ON collection_routes;
CREATE POLICY collection_routes_staff_select ON collection_routes
  FOR SELECT TO {{APP_DATABASE_ROLE}}
  USING (app_actor_can_access_route(tenant_id, id));

DROP POLICY collection_route_stops_staff_select ON collection_route_stops;
CREATE POLICY collection_route_stops_staff_select ON collection_route_stops
  FOR SELECT TO {{APP_DATABASE_ROLE}}
  USING (app_actor_can_access_route(tenant_id, route_id));

-- Normalize production installations that inherited broad privileges from the
-- former ALTER DEFAULT PRIVILEGES rule. This matrix matches the explicit grants
-- required by the migrations and leaves no privilege behind by accident.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM {{APP_DATABASE_ROLE}};

GRANT SELECT ON schema_migrations TO {{APP_DATABASE_ROLE}};

GRANT SELECT, INSERT ON
  borrower_collection_reports,
  borrower_identity_reviews,
  loan_payments,
  outbox_events,
  tenant_membership_entitlement_versions,
  tenant_setting_versions
TO {{APP_DATABASE_ROLE}};

GRANT SELECT, INSERT, UPDATE ON
  audit_events,
  auth_mfa_challenges,
  auth_sessions,
  borrower_address_locations,
  borrower_document_ocr_extractions,
  borrower_documents,
  borrower_emergency_contacts,
  borrower_identities,
  borrower_portal_links,
  borrowers,
  branches,
  collection_route_stops,
  collection_routes,
  company_creation_codes,
  loan_applications,
  loan_products,
  teams,
  tenant_invitations,
  tenant_member_profiles,
  tenant_memberships,
  tenant_settings,
  tenant_support_access_requests,
  tenants,
  user_memberships,
  users,
  verification_network_assertions,
  verification_network_consents,
  verification_network_corrections,
  verification_network_queries,
  verification_network_subjects
TO {{APP_DATABASE_ROLE}};

GRANT SELECT, INSERT, UPDATE, DELETE ON
  auth_mfa_recovery_codes,
  team_memberships,
  tenant_member_emergency_contacts
TO {{APP_DATABASE_ROLE}};
