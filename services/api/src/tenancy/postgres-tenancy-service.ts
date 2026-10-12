import { createHash, randomBytes } from "node:crypto";
import type { TenantMemberProfile } from "@cobranzapp/contracts";
import type { Pool, PoolClient } from "pg";
import { hashPassword } from "../auth/password.js";
import type { TenantRole } from "../auth/types.js";
import {
  borrowerDocumentLookupHmac,
  encryptBorrowerDocumentNumber,
  normalizeBorrowerDocumentNumber,
} from "../borrowers/identity.js";
import { buildMembershipEntitlement, membershipCatalog } from "../memberships/catalog.js";
import type {
  InvitationAcceptanceResult,
  InvitationPreview,
  MemberIdentityDocumentResult,
  MemberProfilePhotoResult,
  MemberProfileResult,
  TenancyService,
  TenantActor,
  TenantOverview,
} from "./types.js";

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest();
}

function tokenHashHex(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function setActorContext(client: PoolClient, actor: TenantActor, tenantId: string) {
  await client.query("SELECT set_config('app.user_id', $1, true)", [actor.userId]);
  await client.query("SELECT set_config('app.platform_role', $1, true)", [
    actor.platformRole ?? "",
  ]);
  await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
  await client.query("SELECT set_config('app.tenant_role', $1, true)", [actor.tenantRole ?? ""]);
}

async function lockTenantMembershipCapacity(client: PoolClient, tenantId: string) {
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))", [tenantId]);
}

async function loadMemberProfile(
  client: Pick<PoolClient, "query">,
  tenantId: string,
  userId: string,
): Promise<TenantMemberProfile | null> {
  const member = await client.query<{
    user_id: string;
    country: string;
    document_type: string | null;
    document_last4: string | null;
    document_verification_state: "manual_pending" | "reviewed" | "rejected";
    identity_front_object_key: string | null;
    identity_back_object_key: string | null;
    phone: string | null;
    home_address: string | null;
    work_address: string | null;
    profile_photo_object_key: string | null;
    blood_type: TenantMemberProfile["bloodType"];
    blood_type_consent_version: string | null;
    blood_type_consented_at: Date | null;
  }>(
    `SELECT membership.user_id,
            COALESCE(profile.country, 'CO') AS country,
            profile.document_type, profile.document_last4,
            COALESCE(profile.document_verification_state, 'manual_pending') AS document_verification_state,
            profile.identity_front_object_key, profile.identity_back_object_key,
            profile.phone, profile.home_address, profile.work_address,
            profile.profile_photo_object_key, profile.blood_type,
            profile.blood_type_consent_version, profile.blood_type_consented_at
       FROM tenant_memberships membership
       LEFT JOIN tenant_member_profiles profile
         ON profile.tenant_id = membership.tenant_id AND profile.user_id = membership.user_id
      WHERE membership.tenant_id = $1
        AND membership.user_id = $2
        AND membership.status <> 'revoked'`,
    [tenantId, userId],
  );
  const row = member.rows[0];
  if (!row) return null;

  const contacts = await client.query<{
    id: string;
    full_name: string;
    relationship: string;
    phone: string;
  }>(
    `SELECT id, full_name, relationship, phone
       FROM tenant_member_emergency_contacts
      WHERE tenant_id = $1 AND user_id = $2
      ORDER BY created_at ASC, id ASC`,
    [tenantId, userId],
  );
  return {
    userId: row.user_id,
    country: row.country,
    documentType: row.document_type,
    documentLast4: row.document_last4,
    documentVerificationState: row.document_verification_state,
    identityFrontObjectKey: row.identity_front_object_key,
    identityBackObjectKey: row.identity_back_object_key,
    phone: row.phone,
    homeAddress: row.home_address,
    workAddress: row.work_address,
    profilePhotoObjectKey: row.profile_photo_object_key,
    bloodType: row.blood_type,
    bloodTypeConsentVersion: row.blood_type_consent_version,
    bloodTypeConsentedAt: row.blood_type_consented_at?.toISOString() ?? null,
    emergencyContacts: contacts.rows.map((contact) => ({
      id: contact.id,
      fullName: contact.full_name,
      relationship: contact.relationship,
      phone: contact.phone,
    })),
  };
}

async function loadInvitation(
  client: PoolClient,
  token: string,
  lock = false,
): Promise<{
  id: string;
  tenant_id: string;
  email: string;
  role: TenantRole;
  expires_at: Date;
  accepted_at: Date | null;
  revoked_at: Date | null;
}> {
  await client.query("SELECT set_config('app.invitation_token_hash', $1, true)", [
    tokenHashHex(token),
  ]);
  const result = await client.query<{
    id: string;
    tenant_id: string;
    email: string;
    role: TenantRole;
    expires_at: Date;
    accepted_at: Date | null;
    revoked_at: Date | null;
  }>(
    `SELECT id, tenant_id, email, role, expires_at, accepted_at, revoked_at
       FROM tenant_invitations
      WHERE token_hash = $1
      ${lock ? "FOR UPDATE" : ""}`,
    [tokenHash(token)],
  );
  const row = result.rows[0];
  if (!row) throw new Error("INVITATION_NOT_FOUND");
  return row;
}

export function createPostgresTenancyService(
  pool: Pool,
  publicWebUrl: string,
  identityKey?: string,
): TenancyService {
  return {
    async createInvitation(actor, tenantId, input) {
      const client = await pool.connect();
      const token = randomBytes(32).toString("base64url");
      try {
        await client.query("BEGIN");
        await setActorContext(client, actor, tenantId);
        const tenant = await client.query<{ id: string }>("SELECT id FROM tenants WHERE id = $1", [
          tenantId,
        ]);
        if (!tenant.rows[0]) {
          await client.query("ROLLBACK");
          return null;
        }
        await client.query(
          `UPDATE tenant_invitations
              SET revoked_at = now()
            WHERE tenant_id = $1 AND email = $2
              AND accepted_at IS NULL AND revoked_at IS NULL`,
          [tenantId, input.email],
        );
        const result = await client.query<{
          id: string;
          email: string;
          role: TenantRole;
          expires_at: Date;
        }>(
          `INSERT INTO tenant_invitations (tenant_id, email, role, token_hash, expires_at, created_by)
           VALUES ($1, $2, $3, $4, now() + interval '72 hours', $5)
           RETURNING id, email, role, expires_at`,
          [tenantId, input.email, input.role, tokenHash(token), actor.userId],
        );
        const invitation = result.rows[0];
        if (!invitation) throw new Error("Invitation insert did not return a record");
        await client.query(
          `INSERT INTO audit_events (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
           VALUES ($1, $2, 'invitation.created', 'tenant_invitation', $3, $4,
                   jsonb_build_object('email', $5::text, 'role', $6::text))`,
          [
            tenantId,
            actor.userId,
            invitation.id,
            input.requestId,
            invitation.email,
            invitation.role,
          ],
        );
        await client.query("COMMIT");
        const acceptanceUrl = new URL("/activar", publicWebUrl);
        acceptanceUrl.searchParams.set("token", token);
        return {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          expiresAt: invitation.expires_at.toISOString(),
          acceptanceUrl: acceptanceUrl.toString(),
        };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async previewInvitation(token) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        let invitation: Awaited<ReturnType<typeof loadInvitation>>;
        try {
          invitation = await loadInvitation(client, token);
        } catch (error) {
          if (error instanceof Error && error.message === "INVITATION_NOT_FOUND") {
            await client.query("ROLLBACK");
            return null;
          }
          throw error;
        }
        if (
          invitation.accepted_at ||
          invitation.revoked_at ||
          invitation.expires_at <= new Date()
        ) {
          await client.query("ROLLBACK");
          return null;
        }
        await client.query("SELECT set_config('app.invitation_tenant_id', $1, true)", [
          invitation.tenant_id,
        ]);
        const tenant = await client.query<{ display_name: string; slug: string }>(
          "SELECT display_name, slug FROM tenants WHERE id = $1",
          [invitation.tenant_id],
        );
        const account = await client.query<{ exists: boolean }>(
          "SELECT EXISTS (SELECT 1 FROM users WHERE email = $1 AND status = 'active') AS exists",
          [invitation.email],
        );
        const tenantRow = tenant.rows[0];
        if (!tenantRow) throw new Error("Invitation tenant is unavailable");
        await client.query("COMMIT");
        return {
          email: invitation.email,
          role: invitation.role,
          tenantName: tenantRow.display_name,
          tenantSlug: tenantRow.slug,
          expiresAt: invitation.expires_at.toISOString(),
          accountExists: account.rows[0]?.exists ?? false,
        } satisfies InvitationPreview;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async acceptInvitation(token, input, requestId) {
      const passwordHash = "password" in input ? await hashPassword(input.password) : null;
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        let invitation: Awaited<ReturnType<typeof loadInvitation>>;
        try {
          invitation = await loadInvitation(client, token, true);
        } catch (error) {
          if (error instanceof Error && error.message === "INVITATION_NOT_FOUND") {
            await client.query("ROLLBACK");
            return { status: "invalid" };
          }
          throw error;
        }
        if (invitation.accepted_at || invitation.revoked_at) {
          await client.query("ROLLBACK");
          return { status: "invalid" };
        }
        if (invitation.expires_at <= new Date()) {
          await client.query("ROLLBACK");
          return { status: "expired" };
        }
        await client.query("SELECT set_config('app.invitation_tenant_id', $1, true)", [
          invitation.tenant_id,
        ]);

        let userId: string;
        if ("existingUserId" in input) {
          const user = await client.query<{ id: string; email: string }>(
            "SELECT id, email FROM users WHERE id = $1 AND status = 'active'",
            [input.existingUserId],
          );
          const userRow = user.rows[0];
          if (!userRow || userRow.email !== invitation.email) {
            await client.query("ROLLBACK");
            return { status: "email_mismatch" };
          }
          userId = userRow.id;
        } else {
          const account = await client.query<{ exists: boolean }>(
            "SELECT EXISTS (SELECT 1 FROM users WHERE email = $1) AS exists",
            [invitation.email],
          );
          if (account.rows[0]?.exists) {
            await client.query("ROLLBACK");
            return { status: "account_exists" };
          }
          const username = await client.query<{ exists: boolean }>(
            "SELECT EXISTS (SELECT 1 FROM users WHERE username = $1) AS exists",
            [input.username],
          );
          if (username.rows[0]?.exists) {
            await client.query("ROLLBACK");
            return { status: "username_unavailable" };
          }
          const created = await client.query<{ id: string }>(
            `INSERT INTO users (username, email, display_name, password_hash, must_change_password)
             VALUES ($1, $2, $3, $4, false)
             RETURNING id`,
            [input.username, invitation.email, input.displayName, passwordHash],
          );
          const createdUser = created.rows[0];
          if (!createdUser) throw new Error("User insert did not return a record");
          userId = createdUser.id;
        }

        await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);

        if (invitation.role === "supervisor" || invitation.role === "collector") {
          await lockTenantMembershipCapacity(client, invitation.tenant_id);
          const tenant = await client.query<{
            membership_plan: "pro" | "ultra" | null;
            additional_employee_seats: number;
          }>(
            `SELECT membership_plan, additional_employee_seats
               FROM tenants WHERE id = $1`,
            [invitation.tenant_id],
          );
          const tenantRow = tenant.rows[0];
          const employeeSeatLimit = tenantRow?.membership_plan
            ? membershipCatalog[tenantRow.membership_plan].includedEmployeeSeats +
              tenantRow.additional_employee_seats
            : 0;
          const currentMembership = await client.query<{ consumes_seat: boolean }>(
            `SELECT EXISTS (
               SELECT 1 FROM tenant_memberships
                WHERE tenant_id = $1 AND user_id = $2
                  AND status = 'active' AND role IN ('supervisor', 'collector')
             ) AS consumes_seat`,
            [invitation.tenant_id, userId],
          );
          const occupied = await client.query<{ count: number }>(
            "SELECT tenant_active_employee_seat_count($1) AS count",
            [invitation.tenant_id],
          );
          if (
            !currentMembership.rows[0]?.consumes_seat &&
            Number(occupied.rows[0]?.count ?? 0) >= employeeSeatLimit
          ) {
            await client.query("ROLLBACK");
            return { status: "seat_limit_reached", employeeSeatLimit };
          }
        }

        await client.query("SELECT set_config('app.tenant_id', $1, true)", [invitation.tenant_id]);
        await client.query("SELECT set_config('app.invitation_tenant_id', $1, true)", [
          invitation.tenant_id,
        ]);
        await client.query("SELECT set_config('app.invitation_role', $1, true)", [invitation.role]);
        await client.query(
          `INSERT INTO tenant_memberships (tenant_id, user_id, role, status, created_by)
           VALUES ($1, $2, $3, 'active', $2)
           ON CONFLICT (tenant_id, user_id) DO UPDATE
             SET role = EXCLUDED.role, status = 'active', updated_at = now()`,
          [invitation.tenant_id, userId, invitation.role],
        );
        await client.query("UPDATE tenant_invitations SET accepted_at = now() WHERE id = $1", [
          invitation.id,
        ]);
        const tenant = await client.query<{ slug: string }>(
          "SELECT slug FROM tenants WHERE id = $1",
          [invitation.tenant_id],
        );
        await client.query(
          `INSERT INTO audit_events (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
           VALUES ($1, $2, 'invitation.accepted', 'tenant_membership', $2, $3,
                   jsonb_build_object('role', $4::text))`,
          [invitation.tenant_id, userId, requestId, invitation.role],
        );
        await client.query("COMMIT");
        return {
          status: "accepted",
          tenantSlug: tenant.rows[0]?.slug ?? "",
        } satisfies InvitationAcceptanceResult;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async revokeInvitation(actor, tenantId, invitationId, requestId) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await setActorContext(client, actor, tenantId);
        const current = await client.query<{
          id: string;
          email: string;
          role: TenantRole;
        }>(
          `SELECT id, email, role
             FROM tenant_invitations
            WHERE tenant_id = $1 AND id = $2
              AND accepted_at IS NULL AND revoked_at IS NULL
            FOR UPDATE`,
          [tenantId, invitationId],
        );
        const invitation = current.rows[0];
        if (!invitation) {
          await client.query("ROLLBACK");
          return { status: "not_found" };
        }
        if (invitation.role === "owner" && actor.platformRole !== "developer") {
          await client.query("ROLLBACK");
          return { status: "protected" };
        }
        await client.query(
          `UPDATE tenant_invitations
              SET revoked_at = now()
            WHERE tenant_id = $1 AND id = $2`,
          [tenantId, invitationId],
        );
        await client.query(
          `INSERT INTO audit_events
             (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
           VALUES ($1, $2, 'invitation.revoked', 'tenant_invitation', $3, $4,
                   jsonb_build_object('email', $5::text, 'role', $6::text))`,
          [tenantId, actor.userId, invitation.id, requestId, invitation.email, invitation.role],
        );
        await client.query("COMMIT");
        return { status: "revoked" };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async overview(actor, tenantId) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await setActorContext(client, actor, tenantId);
        const tenant = await client.query<{
          id: string;
          slug: string;
          display_name: string;
          status: TenantOverview["tenant"]["status"];
          locale: string;
          timezone: string;
          currency: string;
          membership_plan: "pro" | "ultra" | null;
          additional_employee_seats: number;
          membership_entitlement_version: number;
        }>(
          `SELECT id, slug, display_name, status, locale, timezone, currency, membership_plan,
                  additional_employee_seats, membership_entitlement_version
             FROM tenants WHERE id = $1`,
          [tenantId],
        );
        const tenantRow = tenant.rows[0];
        const supportAccess = actor.supportAccessId
          ? await client.query<{ allowed: boolean }>(
              `SELECT EXISTS (
                 SELECT 1 FROM tenant_support_access_requests
                  WHERE id = $1 AND tenant_id = $2 AND requested_by = $3
                    AND status = 'approved' AND approved_until > now()
               ) AS allowed`,
              [actor.supportAccessId, tenantId, actor.userId],
            )
          : { rows: [] };
        const isSupport =
          actor.platformRole === "developer" &&
          actor.tenantRole === null &&
          supportAccess.rows[0]?.allowed === true;
        if (!tenantRow || (!actor.tenantRole && !isSupport)) {
          await client.query("ROLLBACK");
          return null;
        }
        const maySeeOrganization =
          isSupport || actor.tenantRole === "owner" || actor.tenantRole === "supervisor";
        const metrics = await client.query<{
          members: string;
          branches: string;
          teams: string;
          pending_invitations: string;
          active_employee_seats: string;
        }>(
          `SELECT
             (SELECT count(*) FROM tenant_memberships WHERE tenant_id = $1 AND status = 'active') AS members,
             (SELECT count(*) FROM branches WHERE tenant_id = $1 AND status = 'active') AS branches,
             (SELECT count(*) FROM teams WHERE tenant_id = $1 AND status = 'active') AS teams,
             (SELECT count(*) FROM tenant_invitations WHERE tenant_id = $1 AND accepted_at IS NULL
               AND revoked_at IS NULL AND expires_at > now()) AS pending_invitations,
             (SELECT count(*) FROM tenant_memberships
               WHERE tenant_id = $1 AND status = 'active'
                 AND role IN ('supervisor', 'collector')) AS active_employee_seats`,
          [tenantId],
        );
        const settings = await client.query<{
          primary_color: string;
          accent_color: string;
          contact_email: string | null;
          contact_phone: string | null;
          address: string | null;
          version: number;
        }>(
          `SELECT primary_color, accent_color, contact_email, contact_phone, address, version
             FROM tenant_settings
            WHERE tenant_id = $1`,
          [tenantId],
        );
        const maySeeSettingsHistory =
          isSupport || actor.tenantRole === "owner" || actor.tenantRole === "supervisor";
        const settingsHistory = maySeeSettingsHistory
          ? await client.query<{
              version: number;
              primary_color: string;
              accent_color: string;
              contact_email: string | null;
              changed_by_display_name: string;
              changed_at: Date;
            }>(
              `SELECT history.version, history.primary_color, history.accent_color,
                      history.contact_email,
                      changed_by.display_name AS changed_by_display_name,
                      history.changed_at
                 FROM tenant_setting_versions history
                 JOIN users changed_by ON changed_by.id = history.changed_by
                WHERE history.tenant_id = $1
                ORDER BY history.version DESC
                LIMIT 12`,
              [tenantId],
            )
          : { rows: [] };
        const branches = await client.query<{
          id: string;
          code: string;
          display_name: string;
          status: "active" | "inactive";
        }>(
          "SELECT id, code, display_name, status FROM branches WHERE tenant_id = $1 ORDER BY display_name",
          [tenantId],
        );
        const teams = await client.query<{
          id: string;
          branch_id: string | null;
          branch_name: string | null;
          display_name: string;
          status: "active" | "inactive";
          member_ids: string[];
        }>(
          `SELECT team.id, team.branch_id, branch.display_name AS branch_name,
                  team.display_name, team.status,
                  COALESCE(
                    array_agg(team_member.user_id ORDER BY team_member.created_at)
                      FILTER (WHERE team_member.user_id IS NOT NULL),
                    '{}'::uuid[]
                  ) AS member_ids
             FROM teams team
             LEFT JOIN branches branch
               ON branch.tenant_id = team.tenant_id AND branch.id = team.branch_id
             LEFT JOIN team_memberships team_member
               ON team_member.tenant_id = team.tenant_id AND team_member.team_id = team.id
            WHERE team.tenant_id = $1
            GROUP BY team.id, team.branch_id, team.display_name, team.status, branch.display_name
            ORDER BY team.display_name`,
          [tenantId],
        );
        const mayManagePeople =
          isSupport || actor.tenantRole === "owner" || actor.tenantRole === "supervisor";
        const activity = mayManagePeople
          ? await client.query<{
              id: string;
              action: string;
              actor_display_name: string | null;
              actor_username: string | null;
              happened_at: Date;
            }>(
              `SELECT event.id, event.action,
                      actor.display_name AS actor_display_name,
                      actor.username AS actor_username,
                      event.happened_at
                 FROM audit_events event
                 LEFT JOIN users actor ON actor.id = event.actor_user_id
                WHERE event.tenant_id = $1
                ORDER BY event.happened_at DESC, event.id DESC
                LIMIT 12`,
              [tenantId],
            )
          : { rows: [] };
        const members = mayManagePeople
          ? await client.query<{
              user_id: string;
              display_name: string;
              email: string;
              username: string;
              role: TenantRole;
              status: "invited" | "active" | "suspended" | "revoked";
            }>(
              `SELECT membership.user_id, users.display_name, users.email, users.username,
                      membership.role, membership.status
                 FROM tenant_memberships membership
                 JOIN users ON users.id = membership.user_id
                WHERE membership.tenant_id = $1
                ORDER BY users.display_name`,
              [tenantId],
            )
          : { rows: [] };
        const invitations =
          actor.tenantRole === "owner"
            ? await client.query<{
                id: string;
                email: string;
                role: TenantRole;
                expires_at: Date;
              }>(
                `SELECT id, email, role, expires_at
                 FROM tenant_invitations
                WHERE tenant_id = $1 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now()
                ORDER BY created_at DESC`,
                [tenantId],
              )
            : { rows: [] };
        const counts = metrics.rows[0];
        const activeEmployeeSeats = Number(counts?.active_employee_seats ?? 0);
        const maySeeMembership = actor.tenantRole === "owner" || isSupport;
        const entitlement =
          maySeeMembership && tenantRow.membership_plan
            ? buildMembershipEntitlement(
                tenantRow.membership_plan,
                tenantRow.additional_employee_seats,
                tenantRow.membership_entitlement_version,
              )
            : null;
        const tenantSettings = settings.rows[0];
        if (!tenantSettings) throw new Error("Tenant settings are unavailable");
        await client.query("COMMIT");
        return {
          tenant: {
            id: tenantRow.id,
            slug: tenantRow.slug,
            displayName: tenantRow.display_name,
            status: tenantRow.status,
            locale: tenantRow.locale,
            timezone: tenantRow.timezone,
            currency: tenantRow.currency,
            membershipPlan: maySeeMembership ? tenantRow.membership_plan : null,
          },
          actorRole: actor.tenantRole ?? "support",
          metrics: {
            members: maySeeOrganization ? Number(counts?.members ?? 0) : 0,
            branches: Number(counts?.branches ?? 0),
            teams: Number(counts?.teams ?? 0),
            pendingInvitations: maySeeOrganization ? Number(counts?.pending_invitations ?? 0) : 0,
            activeEmployeeSeats: maySeeOrganization ? activeEmployeeSeats : 0,
          },
          membershipEntitlement: entitlement
            ? {
                ...entitlement,
                availableEmployeeSeats: Math.max(
                  0,
                  entitlement.employeeSeatLimit - activeEmployeeSeats,
                ),
              }
            : null,
          settings: {
            primaryColor: tenantSettings.primary_color,
            accentColor: tenantSettings.accent_color,
            contactEmail: tenantSettings.contact_email,
            contactPhone: tenantSettings.contact_phone,
            address: tenantSettings.address,
            version: tenantSettings.version,
          },
          settingsHistory: settingsHistory.rows.map((version) => ({
            version: version.version,
            primaryColor: version.primary_color,
            accentColor: version.accent_color,
            contactEmail: version.contact_email,
            changedByDisplayName: version.changed_by_display_name,
            changedAt: version.changed_at.toISOString(),
          })),
          members: members.rows.map((member) => ({
            userId: member.user_id,
            displayName: member.display_name,
            email: member.email,
            username: member.username,
            role: member.role,
            status: member.status,
          })),
          branches: branches.rows.map((branch) => ({
            id: branch.id,
            code: branch.code,
            displayName: branch.display_name,
            status: branch.status,
          })),
          teams: teams.rows.map((team) => ({
            id: team.id,
            branchId: team.branch_id,
            branchName: team.branch_name,
            displayName: team.display_name,
            status: team.status,
            memberIds: mayManagePeople ? team.member_ids : [],
          })),
          pendingInvitations: invitations.rows.map((invitation) => ({
            id: invitation.id,
            email: invitation.email,
            role: invitation.role,
            expiresAt: invitation.expires_at.toISOString(),
          })),
          activity: activity.rows.map((event) => ({
            id: event.id,
            action: event.action,
            actorDisplayName: event.actor_display_name,
            actorUsername: event.actor_username,
            happenedAt: event.happened_at.toISOString(),
          })),
        } satisfies TenantOverview;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async updateSettings(actor, tenantId, input) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await setActorContext(client, actor, tenantId);
        const updated = await client.query<{
          primary_color: string;
          accent_color: string;
          contact_email: string | null;
          contact_phone: string | null;
          address: string | null;
          version: number;
        }>(
          `UPDATE tenant_settings
              SET primary_color = $3,
                  accent_color = $4,
                  contact_email = $5,
                  contact_phone = $6,
                  address = $7,
                  version = version + 1,
                  updated_by = $8,
                  updated_at = now()
            WHERE tenant_id = $1 AND version = $2
          RETURNING primary_color, accent_color, contact_email, contact_phone, address, version`,
          [
            tenantId,
            input.version,
            input.primaryColor,
            input.accentColor,
            input.contactEmail,
            input.contactPhone,
            input.address,
            actor.userId,
          ],
        );
        const row = updated.rows[0];
        if (!row) {
          const exists = await client.query<{ exists: boolean }>(
            "SELECT EXISTS (SELECT 1 FROM tenant_settings WHERE tenant_id = $1) AS exists",
            [tenantId],
          );
          await client.query("ROLLBACK");
          return exists.rows[0]?.exists ? { status: "stale" } : { status: "not_found" };
        }
        await client.query(
          `INSERT INTO tenant_setting_versions (
             tenant_id, version, primary_color, accent_color, contact_email,
             contact_phone, address, changed_by, changed_at
           )
           SELECT tenant_id, version, primary_color, accent_color, contact_email,
                  contact_phone, address, updated_by, updated_at
             FROM tenant_settings
            WHERE tenant_id = $1`,
          [tenantId],
        );
        await client.query(
          `INSERT INTO audit_events
             (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
           VALUES ($1, $2, 'tenant.settings_updated', 'tenant', $1, $3,
                   jsonb_build_object('version', $4::integer))`,
          [tenantId, actor.userId, input.requestId, row.version],
        );
        await client.query("COMMIT");
        return {
          status: "updated",
          settings: {
            primaryColor: row.primary_color,
            accentColor: row.accent_color,
            contactEmail: row.contact_email,
            contactPhone: row.contact_phone,
            address: row.address,
            version: row.version,
          },
        } as const;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async createBranch(actor, tenantId, input) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await setActorContext(client, actor, tenantId);
        const tenant = await client.query<{ id: string }>("SELECT id FROM tenants WHERE id = $1", [
          tenantId,
        ]);
        if (!tenant.rows[0]) {
          await client.query("ROLLBACK");
          return null;
        }
        const created = await client.query<{
          id: string;
          code: string;
          display_name: string;
          status: "active" | "inactive";
        }>(
          `INSERT INTO branches (tenant_id, code, display_name, created_by)
           VALUES ($1, $2, $3, $4)
           RETURNING id, code, display_name, status`,
          [tenantId, input.code, input.displayName, actor.userId],
        );
        const branch = created.rows[0];
        if (!branch) throw new Error("Branch insert did not return a record");
        await client.query(
          `INSERT INTO audit_events
             (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
           VALUES ($1, $2, 'branch.created', 'branch', $3, $4,
                   jsonb_build_object('code', $5::text, 'displayName', $6::text))`,
          [tenantId, actor.userId, branch.id, input.requestId, branch.code, branch.display_name],
        );
        await client.query("COMMIT");
        return {
          id: branch.id,
          code: branch.code,
          displayName: branch.display_name,
          status: branch.status,
        };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async createTeam(actor, tenantId, input) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await setActorContext(client, actor, tenantId);
        const tenant = await client.query<{ id: string }>("SELECT id FROM tenants WHERE id = $1", [
          tenantId,
        ]);
        if (!tenant.rows[0]) {
          await client.query("ROLLBACK");
          return null;
        }
        if (input.branchId) {
          const branch = await client.query<{ id: string }>(
            `SELECT id FROM branches
              WHERE tenant_id = $1 AND id = $2 AND status = 'active'`,
            [tenantId, input.branchId],
          );
          if (!branch.rows[0]) {
            await client.query("ROLLBACK");
            return null;
          }
        }
        const created = await client.query<{
          id: string;
          branch_id: string | null;
          display_name: string;
          status: "active" | "inactive";
        }>(
          `INSERT INTO teams (tenant_id, branch_id, display_name, created_by)
           VALUES ($1, $2, $3, $4)
           RETURNING id, branch_id, display_name, status`,
          [tenantId, input.branchId, input.displayName, actor.userId],
        );
        const team = created.rows[0];
        if (!team) throw new Error("Team insert did not return a record");
        const branch = team.branch_id
          ? await client.query<{ display_name: string }>(
              "SELECT display_name FROM branches WHERE tenant_id = $1 AND id = $2",
              [tenantId, team.branch_id],
            )
          : { rows: [] };
        await client.query(
          `INSERT INTO audit_events
             (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
           VALUES ($1, $2, 'team.created', 'team', $3, $4,
                   jsonb_build_object('displayName', $5::text, 'branchId', $6::text))`,
          [tenantId, actor.userId, team.id, input.requestId, team.display_name, team.branch_id],
        );
        await client.query("COMMIT");
        return {
          id: team.id,
          branchId: team.branch_id,
          branchName: branch.rows[0]?.display_name ?? null,
          displayName: team.display_name,
          status: team.status,
          memberIds: [],
        };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async updateBranchStatus(actor, tenantId, branchId, status, requestId) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await setActorContext(client, actor, tenantId);
        const current = await client.query<{ status: "active" | "inactive" }>(
          `SELECT status FROM branches
            WHERE tenant_id = $1 AND id = $2
            FOR UPDATE`,
          [tenantId, branchId],
        );
        const branch = current.rows[0];
        if (!branch) {
          await client.query("ROLLBACK");
          return { status: "not_found" };
        }
        if (status === "inactive") {
          const activeTeams = await client.query<{ exists: boolean }>(
            `SELECT EXISTS (
               SELECT 1 FROM teams
                WHERE tenant_id = $1 AND branch_id = $2 AND status = 'active'
             ) AS exists`,
            [tenantId, branchId],
          );
          if (activeTeams.rows[0]?.exists) {
            await client.query("ROLLBACK");
            return { status: "has_active_teams" };
          }
        }
        if (branch.status !== status) {
          await client.query(
            "UPDATE branches SET status = $3, updated_at = now() WHERE tenant_id = $1 AND id = $2",
            [tenantId, branchId, status],
          );
          await client.query(
            `INSERT INTO audit_events
               (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
             VALUES ($1, $2, 'branch.status_changed', 'branch', $3, $4,
                     jsonb_build_object('from', $5::text, 'to', $6::text))`,
            [tenantId, actor.userId, branchId, requestId, branch.status, status],
          );
        }
        await client.query("COMMIT");
        return { status: "updated", branchStatus: status };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async updateTeamStatus(actor, tenantId, teamId, status, requestId) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await setActorContext(client, actor, tenantId);
        const current = await client.query<{
          branch_id: string | null;
          status: "active" | "inactive";
        }>(
          `SELECT branch_id, status FROM teams
            WHERE tenant_id = $1 AND id = $2
            FOR UPDATE`,
          [tenantId, teamId],
        );
        const team = current.rows[0];
        if (!team) {
          await client.query("ROLLBACK");
          return { status: "not_found" };
        }
        if (status === "active" && team.branch_id) {
          const branch = await client.query<{ exists: boolean }>(
            `SELECT EXISTS (
               SELECT 1 FROM branches
                WHERE tenant_id = $1 AND id = $2 AND status = 'active'
             ) AS exists`,
            [tenantId, team.branch_id],
          );
          if (!branch.rows[0]?.exists) {
            await client.query("ROLLBACK");
            return { status: "branch_inactive" };
          }
        }
        if (team.status !== status) {
          await client.query(
            "UPDATE teams SET status = $3, updated_at = now() WHERE tenant_id = $1 AND id = $2",
            [tenantId, teamId, status],
          );
          await client.query(
            `INSERT INTO audit_events
               (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
             VALUES ($1, $2, 'team.status_changed', 'team', $3, $4,
                     jsonb_build_object('from', $5::text, 'to', $6::text))`,
            [tenantId, actor.userId, teamId, requestId, team.status, status],
          );
        }
        await client.query("COMMIT");
        return { status: "updated", teamStatus: status };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async addTeamMember(actor, tenantId, teamId, userId, requestId) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await setActorContext(client, actor, tenantId);
        const team = await client.query<{ id: string }>(
          "SELECT id FROM teams WHERE tenant_id = $1 AND id = $2 AND status = 'active'",
          [tenantId, teamId],
        );
        if (!team.rows[0]) {
          await client.query("ROLLBACK");
          return { status: "team_not_found" };
        }
        const member = await client.query<{ role: TenantRole; status: string }>(
          `SELECT role, status
             FROM tenant_memberships
            WHERE tenant_id = $1 AND user_id = $2`,
          [tenantId, userId],
        );
        const membership = member.rows[0];
        if (!membership) {
          await client.query("ROLLBACK");
          return { status: "member_not_found" };
        }
        if (
          membership.status !== "active" ||
          !["supervisor", "collector"].includes(membership.role)
        ) {
          await client.query("ROLLBACK");
          return { status: "member_ineligible" };
        }
        const assigned = await client.query<{ user_id: string }>(
          `INSERT INTO team_memberships (tenant_id, team_id, user_id, created_by)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (tenant_id, team_id, user_id) DO NOTHING
           RETURNING user_id`,
          [tenantId, teamId, userId, actor.userId],
        );
        if (assigned.rows[0]) {
          await client.query(
            `INSERT INTO audit_events
               (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
             VALUES ($1, $2, 'team.member_assigned', 'team', $3, $4,
                     jsonb_build_object('userId', $5::text))`,
            [tenantId, actor.userId, teamId, requestId, userId],
          );
        }
        await client.query("COMMIT");
        return { status: "updated" };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async removeTeamMember(actor, tenantId, teamId, userId, requestId) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await setActorContext(client, actor, tenantId);
        const team = await client.query<{ id: string }>(
          "SELECT id FROM teams WHERE tenant_id = $1 AND id = $2",
          [tenantId, teamId],
        );
        if (!team.rows[0]) {
          await client.query("ROLLBACK");
          return { status: "team_not_found" };
        }
        const member = await client.query<{ exists: boolean }>(
          `SELECT EXISTS (
             SELECT 1 FROM tenant_memberships WHERE tenant_id = $1 AND user_id = $2
           ) AS exists`,
          [tenantId, userId],
        );
        if (!member.rows[0]?.exists) {
          await client.query("ROLLBACK");
          return { status: "member_not_found" };
        }
        const removed = await client.query<{ user_id: string }>(
          `DELETE FROM team_memberships
            WHERE tenant_id = $1 AND team_id = $2 AND user_id = $3
          RETURNING user_id`,
          [tenantId, teamId, userId],
        );
        if (removed.rows[0]) {
          await client.query(
            `INSERT INTO audit_events
               (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
             VALUES ($1, $2, 'team.member_removed', 'team', $3, $4,
                     jsonb_build_object('userId', $5::text))`,
            [tenantId, actor.userId, teamId, requestId, userId],
          );
        }
        await client.query("COMMIT");
        return { status: "updated" };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async getMemberProfile(actor, tenantId, userId) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await setActorContext(client, actor, tenantId);
        const profile = await loadMemberProfile(client, tenantId, userId);
        await client.query("COMMIT");
        return profile;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async updateMemberProfile(actor, tenantId, userId, input) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await setActorContext(client, actor, tenantId);
        const member = await client.query<{ role: TenantRole; status: string }>(
          `SELECT role, status
             FROM tenant_memberships
            WHERE tenant_id = $1 AND user_id = $2`,
          [tenantId, userId],
        );
        const membership = member.rows[0];
        if (!membership || membership.status === "revoked") {
          await client.query("ROLLBACK");
          return { status: "not_found" } satisfies MemberProfileResult;
        }
        if (actor.userId !== userId && !["owner", "supervisor"].includes(actor.tenantRole ?? "")) {
          await client.query("ROLLBACK");
          return { status: "forbidden" } satisfies MemberProfileResult;
        }
        if (
          actor.userId !== userId &&
          actor.tenantRole === "supervisor" &&
          membership.role === "owner"
        ) {
          await client.query("ROLLBACK");
          return { status: "forbidden" } satisfies MemberProfileResult;
        }
        if (
          input.profilePhotoObjectKey &&
          !input.profilePhotoObjectKey.startsWith(`tenant/${tenantId}/members/${userId}/profile/`)
        ) {
          await client.query("ROLLBACK");
          return { status: "invalid_photo_key" } satisfies MemberProfileResult;
        }

        const identityProvided =
          input.country != null || input.documentType != null || input.documentNumber != null;
        let identity: {
          country: string;
          documentType: string;
          ciphertext: string;
          lookupHmac: Buffer;
          last4: string;
        } | null = null;
        if (identityProvided) {
          if (!identityKey || !input.country || !input.documentType || !input.documentNumber) {
            await client.query("ROLLBACK");
            return { status: "identity_unavailable" } satisfies MemberProfileResult;
          }
          const normalizedNumber = normalizeBorrowerDocumentNumber(input.documentNumber);
          identity = {
            country: input.country.toUpperCase(),
            documentType: input.documentType.trim().toUpperCase(),
            ciphertext: encryptBorrowerDocumentNumber(identityKey, normalizedNumber),
            lookupHmac: borrowerDocumentLookupHmac(identityKey, {
              tenantId,
              country: input.country,
              documentType: input.documentType,
              documentNumber: normalizedNumber,
            }),
            last4: normalizedNumber.slice(-4),
          };
          const duplicate = await client.query(
            `SELECT 1
               FROM tenant_member_profiles
              WHERE tenant_id = $1
                AND document_lookup_hmac = $2
                AND user_id <> $3
              LIMIT 1`,
            [tenantId, identity.lookupHmac, userId],
          );
          if (duplicate.rows[0]) {
            await client.query("ROLLBACK");
            return { status: "duplicate_identity" } satisfies MemberProfileResult;
          }
        }

        await client.query(
          `INSERT INTO tenant_member_profiles (
             tenant_id, user_id, country, document_type, document_number_ciphertext,
             document_lookup_hmac, document_last4, document_verification_state,
             phone, home_address, work_address,
             profile_photo_object_key, blood_type, blood_type_consent_version,
             blood_type_consented_at
           ) VALUES ($1, $2,
                     COALESCE($3::text, 'CO'),
                     $4::text, $5::text, $6::bytea, $7::text,
                     CASE WHEN $4::text IS NULL THEN 'manual_pending' ELSE 'manual_pending' END,
                     $8::text, $9::text, $10::text, $11::text, $12::text,
                     $13::text,
                     CASE WHEN $12::text IS NULL THEN NULL ELSE now() END)
           ON CONFLICT (tenant_id, user_id) DO UPDATE SET
             country = CASE WHEN EXCLUDED.document_type IS NULL THEN tenant_member_profiles.country ELSE EXCLUDED.country END,
             document_type = CASE WHEN EXCLUDED.document_type IS NULL THEN tenant_member_profiles.document_type ELSE EXCLUDED.document_type END,
             document_number_ciphertext = CASE WHEN EXCLUDED.document_type IS NULL THEN tenant_member_profiles.document_number_ciphertext ELSE EXCLUDED.document_number_ciphertext END,
             document_lookup_hmac = CASE WHEN EXCLUDED.document_type IS NULL THEN tenant_member_profiles.document_lookup_hmac ELSE EXCLUDED.document_lookup_hmac END,
             document_last4 = CASE WHEN EXCLUDED.document_type IS NULL THEN tenant_member_profiles.document_last4 ELSE EXCLUDED.document_last4 END,
             document_verification_state = CASE WHEN EXCLUDED.document_type IS NULL THEN tenant_member_profiles.document_verification_state ELSE 'manual_pending' END,
             phone = EXCLUDED.phone,
             home_address = EXCLUDED.home_address,
             work_address = EXCLUDED.work_address,
             profile_photo_object_key = EXCLUDED.profile_photo_object_key,
             blood_type = EXCLUDED.blood_type,
             blood_type_consent_version = EXCLUDED.blood_type_consent_version,
             blood_type_consented_at = EXCLUDED.blood_type_consented_at,
             updated_at = now()`,
          [
            tenantId,
            userId,
            identity?.country ?? null,
            identity?.documentType ?? null,
            identity?.ciphertext ?? null,
            identity?.lookupHmac ?? null,
            identity?.last4 ?? null,
            input.phone,
            input.homeAddress,
            input.workAddress,
            input.profilePhotoObjectKey,
            input.bloodType,
            input.bloodTypeConsentVersion,
          ],
        );
        await client.query(
          "DELETE FROM tenant_member_emergency_contacts WHERE tenant_id = $1 AND user_id = $2",
          [tenantId, userId],
        );
        for (const contact of input.emergencyContacts) {
          await client.query(
            `INSERT INTO tenant_member_emergency_contacts
               (tenant_id, user_id, full_name, relationship, phone)
             VALUES ($1, $2, $3, $4, $5)`,
            [tenantId, userId, contact.fullName, contact.relationship, contact.phone],
          );
        }
        await client.query(
          `INSERT INTO audit_events
             (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
           VALUES ($1, $2, 'member.profile_updated', 'tenant_member_profile', $3, $4,
                   $5::jsonb)`,
          [
            tenantId,
            actor.userId,
            userId,
            input.requestId,
            JSON.stringify({
              targetUserId: userId,
              hasPhone: input.phone !== null,
              hasDocumentIdentity: identity !== null,
              hasHomeAddress: input.homeAddress !== null,
              hasWorkAddress: input.workAddress !== null,
              hasProfilePhoto: input.profilePhotoObjectKey !== null,
              bloodTypeProvided: input.bloodType !== null,
              emergencyContactCount: input.emergencyContacts.length,
            }),
          ],
        );
        const profile = await loadMemberProfile(client, tenantId, userId);
        if (!profile) {
          await client.query("ROLLBACK");
          return { status: "not_found" } satisfies MemberProfileResult;
        }
        await client.query("COMMIT");
        return { status: "updated", profile } satisfies MemberProfileResult;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async setMemberProfilePhoto(actor, tenantId, userId, input) {
      const expectedPrefix = `tenant/${tenantId}/members/${userId}/profile/`;
      if (!input.objectKey.startsWith(expectedPrefix)) {
        return { status: "invalid_photo_key" } satisfies MemberProfileResult;
      }
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await setActorContext(client, actor, tenantId);
        const member = await client.query<{ role: TenantRole; status: string }>(
          `SELECT role, status
             FROM tenant_memberships
            WHERE tenant_id = $1 AND user_id = $2`,
          [tenantId, userId],
        );
        const membership = member.rows[0];
        if (!membership || membership.status === "revoked") {
          await client.query("ROLLBACK");
          return { status: "not_found" } satisfies MemberProfilePhotoResult;
        }
        if (actor.userId !== userId && !["owner", "supervisor"].includes(actor.tenantRole ?? "")) {
          await client.query("ROLLBACK");
          return { status: "forbidden" } satisfies MemberProfilePhotoResult;
        }
        if (
          actor.userId !== userId &&
          actor.tenantRole === "supervisor" &&
          membership.role === "owner"
        ) {
          await client.query("ROLLBACK");
          return { status: "forbidden" } satisfies MemberProfilePhotoResult;
        }
        await client.query(
          `INSERT INTO tenant_member_profiles (tenant_id, user_id, profile_photo_object_key)
           VALUES ($1, $2, $3)
           ON CONFLICT (tenant_id, user_id) DO UPDATE SET
             profile_photo_object_key = EXCLUDED.profile_photo_object_key,
             updated_at = now()`,
          [tenantId, userId, input.objectKey],
        );
        await client.query(
          `INSERT INTO audit_events
             (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
           VALUES ($1, $2, 'member.profile_photo_uploaded', 'tenant_member_profile', $3, $4,
                   jsonb_build_object('targetUserId', $5::text))`,
          [tenantId, actor.userId, userId, input.requestId, userId],
        );
        const profile = await loadMemberProfile(client, tenantId, userId);
        if (!profile) {
          await client.query("ROLLBACK");
          return { status: "not_found" } satisfies MemberProfilePhotoResult;
        }
        await client.query("COMMIT");
        return { status: "updated", profile } satisfies MemberProfilePhotoResult;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async setMemberIdentityDocument(actor, tenantId, userId, input) {
      const expectedPrefix = `tenant/${tenantId}/members/${userId}/identity/`;
      if (!input.objectKey.startsWith(expectedPrefix)) {
        return { status: "invalid_document_key" } satisfies MemberIdentityDocumentResult;
      }
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await setActorContext(client, actor, tenantId);
        const member = await client.query<{ role: TenantRole; status: string }>(
          `SELECT role, status
             FROM tenant_memberships
            WHERE tenant_id = $1 AND user_id = $2`,
          [tenantId, userId],
        );
        const membership = member.rows[0];
        if (!membership || membership.status === "revoked") {
          await client.query("ROLLBACK");
          return { status: "not_found" } satisfies MemberIdentityDocumentResult;
        }
        if (actor.userId !== userId && !["owner", "supervisor"].includes(actor.tenantRole ?? "")) {
          await client.query("ROLLBACK");
          return { status: "forbidden" } satisfies MemberIdentityDocumentResult;
        }
        if (
          actor.userId !== userId &&
          actor.tenantRole === "supervisor" &&
          membership.role === "owner"
        ) {
          await client.query("ROLLBACK");
          return { status: "forbidden" } satisfies MemberIdentityDocumentResult;
        }
        const column =
          input.side === "front" ? "identity_front_object_key" : "identity_back_object_key";
        await client.query(
          `INSERT INTO tenant_member_profiles (tenant_id, user_id, ${column})
           VALUES ($1, $2, $3)
           ON CONFLICT (tenant_id, user_id) DO UPDATE SET
             ${column} = EXCLUDED.${column}, updated_at = now()`,
          [tenantId, userId, input.objectKey],
        );
        await client.query(
          `INSERT INTO audit_events
             (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
           VALUES ($1, $2, 'member.identity_document_uploaded', 'tenant_member_profile', $3, $4,
                   jsonb_build_object('targetUserId', $5::text, 'side', $6::text))`,
          [tenantId, actor.userId, userId, input.requestId, userId, input.side],
        );
        const profile = await loadMemberProfile(client, tenantId, userId);
        if (!profile) {
          await client.query("ROLLBACK");
          return { status: "not_found" } satisfies MemberIdentityDocumentResult;
        }
        await client.query("COMMIT");
        return { status: "updated", profile } satisfies MemberIdentityDocumentResult;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async updateMember(actor, tenantId, userId, input) {
      if (actor.userId === userId) return { status: "protected" };
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await setActorContext(client, actor, tenantId);
        await lockTenantMembershipCapacity(client, tenantId);
        const tenant = await client.query<{
          membership_plan: "pro" | "ultra" | null;
          additional_employee_seats: number;
        }>(
          `SELECT membership_plan, additional_employee_seats
             FROM tenants WHERE id = $1`,
          [tenantId],
        );
        const tenantRow = tenant.rows[0];
        if (!tenantRow) {
          await client.query("ROLLBACK");
          return { status: "not_found" };
        }
        const current = await client.query<{
          display_name: string;
          email: string;
          username: string;
          role: TenantRole;
          status: "invited" | "active" | "suspended" | "revoked";
        }>(
          `SELECT users.display_name, users.email, users.username,
                  membership.role, membership.status
             FROM tenant_memberships membership
             JOIN users ON users.id = membership.user_id
            WHERE membership.tenant_id = $1 AND membership.user_id = $2
            FOR UPDATE OF membership`,
          [tenantId, userId],
        );
        const previous = current.rows[0];
        if (!previous) {
          await client.query("ROLLBACK");
          return { status: "not_found" };
        }
        if (previous.role === "owner") {
          await client.query("ROLLBACK");
          return { status: "protected" };
        }
        if (previous.status === "revoked") {
          await client.query("ROLLBACK");
          return { status: "invalid_transition" };
        }
        const becomesActiveEmployee =
          input.status === "active" &&
          (input.role === "supervisor" || input.role === "collector") &&
          !(
            previous.status === "active" &&
            (previous.role === "supervisor" || previous.role === "collector")
          );
        if (becomesActiveEmployee) {
          const employeeSeatLimit = tenantRow.membership_plan
            ? membershipCatalog[tenantRow.membership_plan].includedEmployeeSeats +
              tenantRow.additional_employee_seats
            : 0;
          const occupied = await client.query<{ count: string }>(
            `SELECT count(*) AS count
               FROM tenant_memberships
              WHERE tenant_id = $1 AND user_id <> $2
                AND status = 'active' AND role IN ('supervisor', 'collector')`,
            [tenantId, userId],
          );
          if (Number(occupied.rows[0]?.count ?? 0) >= employeeSeatLimit) {
            await client.query("ROLLBACK");
            return { status: "seat_limit_reached", employeeSeatLimit };
          }
        }
        const updated = await client.query<{
          role: TenantRole;
          status: "active" | "suspended" | "revoked";
        }>(
          `UPDATE tenant_memberships
              SET role = $3, status = $4, updated_at = now()
            WHERE tenant_id = $1 AND user_id = $2
          RETURNING role, status`,
          [tenantId, userId, input.role, input.status],
        );
        const member = updated.rows[0];
        if (!member) {
          await client.query("ROLLBACK");
          return { status: "not_found" };
        }
        if (member.role === "customer" || member.status === "revoked") {
          await client.query("DELETE FROM team_memberships WHERE tenant_id = $1 AND user_id = $2", [
            tenantId,
            userId,
          ]);
        }
        await client.query(
          `INSERT INTO audit_events
             (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
           VALUES ($1, $2, 'membership.updated', 'tenant_membership', $3, $4,
                   jsonb_build_object(
                     'previousRole', $5::text, 'role', $6::text,
                     'previousStatus', $7::text, 'status', $8::text
                   ))`,
          [
            tenantId,
            actor.userId,
            userId,
            input.requestId,
            previous.role,
            member.role,
            previous.status,
            member.status,
          ],
        );
        await client.query("COMMIT");
        return {
          status: "updated",
          member: {
            userId,
            displayName: previous.display_name,
            email: previous.email,
            username: previous.username,
            role: member.role,
            status: member.status,
          },
        };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
