import { createHash, randomBytes } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { hashPassword } from "../auth/password.js";
import {
  buildMembershipEntitlement,
  membershipCatalog,
  membershipCatalogVersion,
} from "../memberships/catalog.js";
import type {
  CompanyCreationCode,
  MembershipEntitlementUpdateResult,
  MembershipPlan,
  MembershipPlanUpdateResult,
  PlatformActivityDirectory,
  PlatformOverview,
  PlatformService,
  PlatformUserDirectory,
  PlatformUserMembershipUpdateResult,
  PlatformUserStatusUpdateResult,
  TenantDirectory,
  TenantStatus,
  TenantStatusUpdateResult,
  UserProfile,
  UserProfileUpdateResult,
} from "./types.js";

function normalizeCompanyCode(code: string) {
  return code.trim().toUpperCase();
}

function companyCodeHash(code: string) {
  return createHash("sha256").update(normalizeCompanyCode(code)).digest();
}

function generateCompanyCode() {
  const segment = () => randomBytes(2).toString("hex").toUpperCase();
  return `CZA-${segment()}-${segment()}-${segment()}`;
}

async function insertEntitlementVersion(
  client: Pick<PoolClient, "query">,
  input: {
    actorUserId: string;
    additionalEmployeeSeats: number;
    membershipPlan: MembershipPlan;
    requestId: string;
    tenantId: string;
    version: number;
  },
) {
  const entitlement = buildMembershipEntitlement(
    input.membershipPlan,
    input.additionalEmployeeSeats,
    input.version,
  );
  await client.query(
    `INSERT INTO tenant_membership_entitlement_versions (
       tenant_id, version, membership_plan, included_employee_seats,
       additional_employee_seats, client_limit, priority_support,
       catalog_version, changed_by, request_id
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      input.tenantId,
      input.version,
      input.membershipPlan,
      entitlement.includedEmployeeSeats,
      input.additionalEmployeeSeats,
      entitlement.clientLimit,
      entitlement.prioritySupport,
      membershipCatalogVersion,
      input.actorUserId,
      input.requestId,
    ],
  );
  return entitlement;
}

async function setPlatformContext(client: Pick<PoolClient, "query">, actorUserId: string) {
  await client.query("SELECT set_config('app.user_id', $1, true)", [actorUserId]);
  await client.query("SELECT set_config('app.platform_role', 'developer', true)");
}

async function lockTenantMembershipCapacity(client: Pick<PoolClient, "query">, tenantId: string) {
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))", [tenantId]);
}

type TenantRow = {
  id: string;
  slug: string;
  display_name: string;
  status: PlatformOverview["tenants"][number]["status"];
  membership_plan: MembershipPlan | null;
  additional_employee_seats: number;
  membership_entitlement_version: number;
  members: string;
  active_owner: boolean;
  active_branch: boolean;
  contact_email: boolean;
  created_at: Date;
};

function mapTenant(tenant: TenantRow): PlatformOverview["tenants"][number] {
  return {
    id: tenant.id,
    slug: tenant.slug,
    displayName: tenant.display_name,
    status: tenant.status,
    membershipPlan: tenant.membership_plan,
    membershipEntitlement: tenant.membership_plan
      ? buildMembershipEntitlement(
          tenant.membership_plan,
          tenant.additional_employee_seats,
          tenant.membership_entitlement_version,
        )
      : null,
    members: Number(tenant.members),
    readiness: {
      activeOwner: tenant.active_owner,
      activeBranch: tenant.active_branch,
      contactEmail: tenant.contact_email,
      membershipPlan: tenant.membership_plan !== null,
    },
    createdAt: tenant.created_at.toISOString(),
  };
}

type PlatformUserRow = {
  id: string;
  username: string;
  email: string;
  display_name: string;
  platform_role: "developer" | null;
  status: "active" | "disabled";
  active_memberships: string;
  membership_plan: MembershipPlan | null;
  membership_activated_at: Date | null;
  active_sessions: string;
  last_seen_at: Date | null;
  created_at: Date;
};

type UserProfileRow = {
  id: string;
  username: string;
  email: string;
  display_name: string;
  profile_phone: string | null;
  profile_home_address: string | null;
  profile_work_address: string | null;
  profile_photo_object_key: string | null;
};

function mapUserProfile(row: UserProfileRow): UserProfile {
  return {
    userId: row.id,
    username: row.username,
    email: row.email,
    displayName: row.display_name,
    phone: row.profile_phone,
    homeAddress: row.profile_home_address,
    workAddress: row.profile_work_address,
    profilePhotoObjectKey: row.profile_photo_object_key,
  };
}

type PlatformAuditActivityRow = {
  id: string;
  action: string;
  actor_display_name: string | null;
  actor_username: string | null;
  tenant_id: string | null;
  tenant_name: string | null;
  happened_at: Date;
};

function mapPlatformActivity(
  event: PlatformAuditActivityRow,
): PlatformOverview["activity"][number] {
  return {
    id: event.id,
    action: event.action,
    actorDisplayName: event.actor_display_name,
    actorUsername: event.actor_username,
    tenantId: event.tenant_id,
    tenantName: event.tenant_name,
    happenedAt: event.happened_at.toISOString(),
  };
}

function mapPlatformUser(user: PlatformUserRow): PlatformUserDirectory["users"][number] {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.display_name,
    platformRole: user.platform_role,
    status: user.status,
    activeMemberships: Number(user.active_memberships),
    membershipPlan: user.membership_plan,
    membershipActivatedAt: user.membership_activated_at?.toISOString() ?? null,
    activeSessions: Number(user.active_sessions),
    lastSeenAt: user.last_seen_at?.toISOString() ?? null,
    createdAt: user.created_at.toISOString(),
  };
}

function tenantSlugSeed(displayName: string) {
  const seed = displayName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 54);
  return seed || "empresa";
}

export function createPostgresPlatformService(pool: Pool): PlatformService {
  return {
    async getUserProfile(userId) {
      const result = await pool.query<UserProfileRow>(
        `SELECT id, username, email, display_name, profile_phone,
                profile_home_address, profile_work_address, profile_photo_object_key
           FROM users WHERE id = $1 AND status = 'active'`,
        [userId],
      );
      return result.rows[0] ? mapUserProfile(result.rows[0]) : null;
    },

    async updateUserProfile(actorUserId, userId, input, requestId) {
      if (actorUserId !== userId) return { status: "forbidden" } satisfies UserProfileUpdateResult;
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT set_config('app.user_id', $1, true)", [actorUserId]);
        const result = await client.query<UserProfileRow>(
          `UPDATE users
              SET display_name = $2, profile_phone = $3, profile_home_address = $4,
                  profile_work_address = $5, updated_at = now()
            WHERE id = $1 AND status = 'active'
            RETURNING id, username, email, display_name, profile_phone,
                      profile_home_address, profile_work_address, profile_photo_object_key`,
          [userId, input.displayName, input.phone, input.homeAddress, input.workAddress],
        );
        const row = result.rows[0];
        if (!row) {
          await client.query("ROLLBACK");
          return { status: "not_found" } satisfies UserProfileUpdateResult;
        }
        await client.query(
          `INSERT INTO audit_events
             (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
           VALUES (NULL, $1, 'user.profile_updated', 'user_profile', $2, $3, '{}'::jsonb)`,
          [actorUserId, userId, requestId],
        );
        await client.query("COMMIT");
        return {
          status: "updated",
          profile: mapUserProfile(row),
        } satisfies UserProfileUpdateResult;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async setUserProfilePhoto(actorUserId, userId, objectKey, requestId) {
      if (actorUserId !== userId) return { status: "forbidden" } satisfies UserProfileUpdateResult;
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT set_config('app.user_id', $1, true)", [actorUserId]);
        const result = await client.query<UserProfileRow>(
          `UPDATE users SET profile_photo_object_key = $2, updated_at = now()
            WHERE id = $1 AND status = 'active'
            RETURNING id, username, email, display_name, profile_phone,
                      profile_home_address, profile_work_address, profile_photo_object_key`,
          [userId, objectKey],
        );
        const row = result.rows[0];
        if (!row) {
          await client.query("ROLLBACK");
          return { status: "not_found" } satisfies UserProfileUpdateResult;
        }
        await client.query(
          `INSERT INTO audit_events
             (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
           VALUES (NULL, $1, 'user.profile_photo_updated', 'user_profile', $2, $3, '{}'::jsonb)`,
          [actorUserId, userId, requestId],
        );
        await client.query("COMMIT");
        return {
          status: "updated",
          profile: mapUserProfile(row),
        } satisfies UserProfileUpdateResult;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async systemStatus(actorUserId) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await setPlatformContext(client, actorUserId);
        const result = await client.query<{
          schema_version: string | null;
          checked_at: Date;
          due: string;
          scheduled: string;
          processing: string;
          dead: string;
          expired_leases: string;
          oldest_due_at: Date | null;
          oldest_due_seconds: string | null;
        }>(
          `SELECT
              (SELECT max(name) FROM schema_migrations) AS schema_version,
              now() AS checked_at,
              count(*) FILTER (
                WHERE status = 'pending' AND available_at <= now()
              ) AS due,
              count(*) FILTER (
                WHERE status = 'pending' AND available_at > now()
              ) AS scheduled,
              count(*) FILTER (WHERE status = 'processing') AS processing,
              count(*) FILTER (WHERE status = 'dead') AS dead,
              count(*) FILTER (
                WHERE status = 'processing' AND lease_expires_at <= now()
              ) AS expired_leases,
              min(available_at) FILTER (
                WHERE status = 'pending' AND available_at <= now()
              ) AS oldest_due_at,
              extract(
                epoch FROM now() - (
                  min(available_at) FILTER (
                    WHERE status = 'pending' AND available_at <= now()
                  )
                )
              ) AS oldest_due_seconds
             FROM outbox_events`,
        );
        await client.query("COMMIT");
        const status = result.rows[0];
        if (!status) throw new Error("Database status query did not return a record");
        const dead = Number(status.dead);
        const expiredLeases = Number(status.expired_leases);
        const oldestDueSeconds = Number(status.oldest_due_seconds ?? 0);
        return {
          schemaVersion: status.schema_version,
          jobs: {
            status:
              dead > 0 || expiredLeases > 0 || oldestDueSeconds >= 300
                ? "attention"
                : "operational",
            due: Number(status.due),
            scheduled: Number(status.scheduled),
            processing: Number(status.processing),
            dead,
            expiredLeases,
            oldestDueAt: status.oldest_due_at?.toISOString() ?? null,
          },
          checkedAt: status.checked_at.toISOString(),
        };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async overview(actorUserId) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await setPlatformContext(client, actorUserId);
        const metricsResult = await client.query<{
          tenants: string;
          active_tenants: string;
          users: string;
          active_memberships: string;
        }>(
          `SELECT
              (SELECT count(*) FROM tenants) AS tenants,
              (SELECT count(*) FROM tenants WHERE status = 'active') AS active_tenants,
              (SELECT count(*) FROM users WHERE status = 'active') AS users,
              (SELECT count(*) FROM tenant_memberships WHERE status = 'active') AS active_memberships`,
        );
        const tenantsResult = await client.query<TenantRow>(
          `SELECT tenant.id, tenant.slug, tenant.display_name, tenant.status,
                    tenant.membership_plan, tenant.additional_employee_seats,
                    tenant.membership_entitlement_version,
                    count(membership.user_id) FILTER (WHERE membership.status = 'active') AS members,
                    EXISTS (
                      SELECT 1 FROM tenant_memberships owner_membership
                       WHERE owner_membership.tenant_id = tenant.id
                         AND owner_membership.role = 'owner'
                         AND owner_membership.status = 'active'
                    ) AS active_owner,
                    EXISTS (
                      SELECT 1 FROM branches branch
                       WHERE branch.tenant_id = tenant.id AND branch.status = 'active'
                    ) AS active_branch,
                    EXISTS (
                      SELECT 1 FROM tenant_settings settings
                       WHERE settings.tenant_id = tenant.id AND settings.contact_email IS NOT NULL
                    ) AS contact_email,
                    tenant.created_at
               FROM tenants tenant
               LEFT JOIN tenant_memberships membership ON membership.tenant_id = tenant.id
              GROUP BY tenant.id
              ORDER BY tenant.created_at DESC
          LIMIT 100`,
        );
        const activityResult = await client.query<PlatformAuditActivityRow>(
          `SELECT event.id, event.action,
                  actor.display_name AS actor_display_name,
                  actor.username AS actor_username,
                  tenant.id AS tenant_id,
                  tenant.display_name AS tenant_name,
                  event.happened_at
             FROM audit_events event
             LEFT JOIN users actor ON actor.id = event.actor_user_id
             LEFT JOIN tenants tenant ON tenant.id = event.tenant_id
            ORDER BY event.happened_at DESC, event.id DESC
            LIMIT 12`,
        );
        await client.query("COMMIT");
        const metrics = metricsResult.rows[0];
        return {
          metrics: {
            tenants: Number(metrics?.tenants ?? 0),
            activeTenants: Number(metrics?.active_tenants ?? 0),
            users: Number(metrics?.users ?? 0),
            activeMemberships: Number(metrics?.active_memberships ?? 0),
          },
          tenants: tenantsResult.rows.map(mapTenant),
          activity: activityResult.rows.map(mapPlatformActivity),
        };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async listActivity(actorUserId, query) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await setPlatformContext(client, actorUserId);
        const filter = `($1::text IS NULL
                          OR event.action ILIKE '%' || $1 || '%'
                          OR actor.display_name ILIKE '%' || $1 || '%'
                          OR actor.username::text ILIKE '%' || $1 || '%'
                          OR tenant.display_name ILIKE '%' || $1 || '%'
                          OR tenant.slug::text ILIKE '%' || $1 || '%')
                        AND ($2::text IS NULL OR event.action = $2)`;
        const countResult = await client.query<{ total: string }>(
          `SELECT count(*) AS total
             FROM audit_events event
             LEFT JOIN users actor ON actor.id = event.actor_user_id
             LEFT JOIN tenants tenant ON tenant.id = event.tenant_id
            WHERE ${filter}`,
          [query.search, query.action],
        );
        const total = Number(countResult.rows[0]?.total ?? 0);
        const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
        const page = Math.min(query.page, totalPages);
        const offset = (page - 1) * query.pageSize;
        const activityResult = await client.query<PlatformAuditActivityRow>(
          `SELECT event.id, event.action,
                  actor.display_name AS actor_display_name,
                  actor.username AS actor_username,
                  tenant.id AS tenant_id,
                  tenant.display_name AS tenant_name,
                  event.happened_at
             FROM audit_events event
             LEFT JOIN users actor ON actor.id = event.actor_user_id
             LEFT JOIN tenants tenant ON tenant.id = event.tenant_id
            WHERE ${filter}
            ORDER BY event.happened_at DESC, event.id DESC
            LIMIT $3 OFFSET $4`,
          [query.search, query.action, query.pageSize, offset],
        );
        const actionsResult = await client.query<{ action: string }>(
          `SELECT DISTINCT action
             FROM audit_events
            ORDER BY action ASC
            LIMIT 200`,
        );
        await client.query("COMMIT");
        return {
          activity: activityResult.rows.map(mapPlatformActivity),
          availableActions: actionsResult.rows.map((row) => row.action),
          pagination: { page, pageSize: query.pageSize, total, totalPages },
        } satisfies PlatformActivityDirectory;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async listTenants(actorUserId, query) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await setPlatformContext(client, actorUserId);
        const filter = `($1::text IS NULL OR tenant.display_name ILIKE '%' || $1 || '%'
                         OR tenant.slug::text ILIKE '%' || $1 || '%')
                        AND ($2::text IS NULL OR tenant.status = $2)`;
        const countResult = await client.query<{ total: string }>(
          `SELECT count(*) AS total
               FROM tenants tenant
              WHERE ${filter}`,
          [query.search, query.status],
        );
        const total = Number(countResult.rows[0]?.total ?? 0);
        const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
        const page = Math.min(query.page, totalPages);
        const offset = (page - 1) * query.pageSize;
        const tenantsResult = await client.query<TenantRow>(
          `SELECT tenant.id, tenant.slug, tenant.display_name, tenant.status,
                    tenant.membership_plan, tenant.additional_employee_seats,
                    tenant.membership_entitlement_version,
                    count(membership.user_id) FILTER (WHERE membership.status = 'active') AS members,
                    EXISTS (
                      SELECT 1 FROM tenant_memberships owner_membership
                       WHERE owner_membership.tenant_id = tenant.id
                         AND owner_membership.role = 'owner'
                         AND owner_membership.status = 'active'
                    ) AS active_owner,
                    EXISTS (
                      SELECT 1 FROM branches branch
                       WHERE branch.tenant_id = tenant.id AND branch.status = 'active'
                    ) AS active_branch,
                    EXISTS (
                      SELECT 1 FROM tenant_settings settings
                       WHERE settings.tenant_id = tenant.id AND settings.contact_email IS NOT NULL
                    ) AS contact_email,
                    tenant.created_at
               FROM tenants tenant
               LEFT JOIN tenant_memberships membership ON membership.tenant_id = tenant.id
              WHERE ${filter}
              GROUP BY tenant.id
              ORDER BY tenant.created_at DESC, tenant.id DESC
              LIMIT $3 OFFSET $4`,
          [query.search, query.status, query.pageSize, offset],
        );
        await client.query("COMMIT");
        return {
          tenants: tenantsResult.rows.map(mapTenant),
          pagination: {
            page,
            pageSize: query.pageSize,
            total,
            totalPages,
          },
        } satisfies TenantDirectory;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async listUsers(actorUserId, query) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await setPlatformContext(client, actorUserId);
        const filter = `($1::text IS NULL OR app_user.display_name ILIKE '%' || $1 || '%'
                         OR app_user.username::text ILIKE '%' || $1 || '%'
                         OR app_user.email::text ILIKE '%' || $1 || '%')
                        AND ($2::text IS NULL OR app_user.status = $2)`;
        const countResult = await client.query<{ total: string }>(
          `SELECT count(*) AS total
             FROM users app_user
            WHERE ${filter}`,
          [query.search, query.status],
        );
        const total = Number(countResult.rows[0]?.total ?? 0);
        const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
        const page = Math.min(query.page, totalPages);
        const offset = (page - 1) * query.pageSize;
        const result = await client.query<PlatformUserRow>(
          `SELECT app_user.id, app_user.username, app_user.email, app_user.display_name,
                  app_user.platform_role, app_user.status, app_user.created_at,
                  (
                    SELECT count(*) FROM tenant_memberships membership
                     WHERE membership.user_id = app_user.id AND membership.status = 'active'
                  ) AS active_memberships,
                  active_membership.membership_plan,
                  active_membership.activated_at AS membership_activated_at,
                  (
                    SELECT count(*) FROM auth_sessions session
                     WHERE session.user_id = app_user.id
                       AND session.revoked_at IS NULL AND session.expires_at > now()
                  ) AS active_sessions,
                  (
                    SELECT max(session.last_seen_at) FROM auth_sessions session
                     WHERE session.user_id = app_user.id
                  ) AS last_seen_at
             FROM users app_user
             LEFT JOIN user_memberships active_membership
               ON active_membership.user_id = app_user.id
              AND active_membership.status = 'active'
            WHERE ${filter}
            ORDER BY app_user.created_at DESC, app_user.id DESC
            LIMIT $3 OFFSET $4`,
          [query.search, query.status, query.pageSize, offset],
        );
        await client.query("COMMIT");
        return {
          users: result.rows.map(mapPlatformUser),
          pagination: { page, pageSize: query.pageSize, total, totalPages },
        } satisfies PlatformUserDirectory;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async createTenant(actorUserId, input) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await setPlatformContext(client, actorUserId);
        const result = await client.query<{
          id: string;
          slug: string;
          display_name: string;
          status: PlatformOverview["tenants"][number]["status"];
          membership_plan: MembershipPlan;
          additional_employee_seats: number;
          membership_entitlement_version: number;
          created_at: Date;
        }>(
          `INSERT INTO tenants (slug, display_name, membership_plan, created_by)
           VALUES ($1, $2, $3, $4)
           RETURNING id, slug, display_name, status, membership_plan,
                     additional_employee_seats, membership_entitlement_version, created_at`,
          [input.slug, input.displayName, input.membershipPlan, actorUserId],
        );
        const tenant = result.rows[0];
        if (!tenant) throw new Error("Tenant insert did not return a record");
        await client.query(
          `INSERT INTO tenant_settings (tenant_id, updated_by)
           VALUES ($1, $2)`,
          [tenant.id, actorUserId],
        );
        const entitlement = await insertEntitlementVersion(client, {
          actorUserId,
          additionalEmployeeSeats: tenant.additional_employee_seats,
          membershipPlan: tenant.membership_plan,
          requestId: input.requestId,
          tenantId: tenant.id,
          version: tenant.membership_entitlement_version,
        });
        await client.query(
          `INSERT INTO tenant_setting_versions (
             tenant_id, version, primary_color, accent_color, contact_email,
             contact_phone, address, changed_by, changed_at
           )
           SELECT tenant_id, version, primary_color, accent_color, contact_email,
                  contact_phone, address, updated_by, updated_at
             FROM tenant_settings
            WHERE tenant_id = $1`,
          [tenant.id],
        );
        await client.query(
          `INSERT INTO audit_events (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
           VALUES (
             $1, $2, 'tenant.created', 'tenant', $1, $3,
             jsonb_build_object(
               'slug', $4::text,
               'membershipPlan', $5::text,
               'membershipCatalogVersion', 1
             )
           )`,
          [tenant.id, actorUserId, input.requestId, tenant.slug, tenant.membership_plan],
        );
        await client.query("COMMIT");
        return {
          id: tenant.id,
          slug: tenant.slug,
          displayName: tenant.display_name,
          status: tenant.status,
          membershipPlan: tenant.membership_plan,
          membershipEntitlement: entitlement,
          members: 0,
          readiness: {
            activeOwner: false,
            activeBranch: false,
            contactEmail: false,
            membershipPlan: true,
          },
          createdAt: tenant.created_at.toISOString(),
        };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async createOwnerAccount(actorUserId, input) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await setPlatformContext(client, actorUserId);
        const passwordHash = await hashPassword(input.temporaryPassword);
        const result = await client.query<{
          id: string;
          username: string;
          email: string;
          display_name: string;
          status: "active" | "disabled";
          created_at: Date;
        }>(
          `INSERT INTO users (username, email, display_name, password_hash, platform_role, must_change_password)
           VALUES ($1, $2, $3, $4, NULL, true)
           RETURNING id, username, email, display_name, status, created_at`,
          [input.username, input.email, input.displayName, passwordHash],
        );
        const user = result.rows[0];
        if (!user) throw new Error("Owner account insert did not return a record");
        await client.query(
          `INSERT INTO audit_events (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
           VALUES (NULL, $1, 'owner.account_created', 'user', $2, $3,
                   jsonb_build_object('username', $4::text, 'email', $5::text))`,
          [actorUserId, user.id, input.requestId, user.username, user.email],
        );
        await client.query("COMMIT");
        return {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            displayName: user.display_name,
            platformRole: null,
            status: user.status,
            activeMemberships: 0,
            membershipPlan: null,
            membershipActivatedAt: null,
            activeSessions: 0,
            lastSeenAt: null,
            createdAt: user.created_at.toISOString(),
          },
          temporaryPassword: input.temporaryPassword,
        };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async issueCompanyCreationCode(actorUserId, input) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await setPlatformContext(client, actorUserId);
        const ownerResult = await client.query<{ id: string; display_name: string }>(
          `SELECT id, display_name
             FROM users
            WHERE id = $1 AND status = 'active' AND platform_role IS NULL`,
          [input.ownerUserId],
        );
        const owner = ownerResult.rows[0];
        if (!owner) throw new Error("OWNER_NOT_FOUND");
        let code = "";
        let result: {
          id: string;
          expires_at: Date;
        } | null = null;
        for (let attempt = 0; attempt < 5; attempt += 1) {
          code = generateCompanyCode();
          try {
            const inserted = await client.query<{ id: string; expires_at: Date }>(
              `INSERT INTO company_creation_codes (
                 owner_user_id, code_hash, membership_plan, expires_at, created_by
               ) VALUES ($1, $2, $3, now() + interval '30 days', $4)
               RETURNING id, expires_at`,
              [input.ownerUserId, companyCodeHash(code), input.membershipPlan, actorUserId],
            );
            result = inserted.rows[0] ?? null;
            break;
          } catch (error) {
            if ((error as { code?: string }).code !== "23505" || attempt === 4) throw error;
          }
        }
        if (!result) throw new Error("Company creation code insert did not return a record");
        await client.query(
          `INSERT INTO audit_events (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
           VALUES (NULL, $1, 'company_creation_code.issued', 'company_creation_code', $2, $3,
                   jsonb_build_object('ownerUserId', $4::text, 'membershipPlan', $5::text))`,
          [actorUserId, result.id, input.requestId, input.ownerUserId, input.membershipPlan],
        );
        await client.query("COMMIT");
        return {
          id: result.id,
          code,
          ownerUserId: owner.id,
          ownerDisplayName: owner.display_name,
          membershipPlan: input.membershipPlan,
          expiresAt: result.expires_at.toISOString(),
        } satisfies CompanyCreationCode;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async createTenantForOwner(actorUserId, input) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT set_config('app.user_id', $1, true)", [actorUserId]);
        await client.query("SELECT set_config('app.platform_role', '', true)");
        const codeResult = await client.query<{
          id: string;
          owner_user_id: string;
          membership_plan: MembershipPlan;
          expires_at: Date;
        }>(
          `SELECT id, owner_user_id, membership_plan, expires_at
             FROM company_creation_codes
            WHERE code_hash = $1
              AND owner_user_id = $2
              AND status = 'issued'
            FOR UPDATE`,
          [companyCodeHash(input.code), actorUserId],
        );
        const code = codeResult.rows[0];
        if (!code) {
          await client.query("ROLLBACK");
          return { status: "invalid_code" as const };
        }
        if (code.expires_at <= new Date()) {
          await client.query(`UPDATE company_creation_codes SET status = 'revoked' WHERE id = $1`, [
            code.id,
          ]);
          await client.query("COMMIT");
          return { status: "expired_code" as const };
        }
        const base = tenantSlugSeed(input.displayName);
        await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))", [base]);
        let slug = base;
        for (let suffix = 2; suffix < 1000; suffix += 1) {
          const existing = await client.query("SELECT 1 FROM tenants WHERE slug = $1", [slug]);
          if (!existing.rows[0]) break;
          slug = `${base.slice(0, 63 - String(suffix).length - 1)}-${suffix}`;
        }
        const tenantResult = await client.query<{
          id: string;
          display_name: string;
          slug: string;
        }>(
          `INSERT INTO tenants (slug, display_name, membership_plan, created_by)
           VALUES ($1, $2, $3, $4)
           RETURNING id, display_name, slug`,
          [slug, input.displayName, code.membership_plan, actorUserId],
        );
        const tenant = tenantResult.rows[0];
        if (!tenant) throw new Error("Owner tenant insert did not return a record");
        await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenant.id]);
        await client.query("SELECT set_config('app.tenant_role', 'owner', true)");
        await client.query(
          `INSERT INTO tenant_memberships (tenant_id, user_id, role, status, created_by)
           VALUES ($1, $2, 'owner', 'active', $2)`,
          [tenant.id, actorUserId],
        );
        await client.query(`INSERT INTO tenant_settings (tenant_id, updated_by) VALUES ($1, $2)`, [
          tenant.id,
          actorUserId,
        ]);
        await insertEntitlementVersion(client, {
          actorUserId,
          additionalEmployeeSeats: 0,
          membershipPlan: code.membership_plan,
          requestId: input.requestId,
          tenantId: tenant.id,
          version: 1,
        });
        await client.query(
          `INSERT INTO tenant_setting_versions (
             tenant_id, version, primary_color, accent_color, contact_email,
             contact_phone, address, changed_by, changed_at
           )
           SELECT tenant_id, version, primary_color, accent_color, contact_email,
                  contact_phone, address, updated_by, updated_at
             FROM tenant_settings WHERE tenant_id = $1`,
          [tenant.id],
        );
        await client.query(
          `INSERT INTO branches (tenant_id, code, display_name, status, created_by)
           VALUES ($1, 'principal', 'Sede principal', 'active', $2)`,
          [tenant.id, actorUserId],
        );
        await client.query(
          `INSERT INTO audit_events (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
           VALUES ($1, $2, 'tenant.created_by_owner', 'tenant', $1, $3,
                   jsonb_build_object('slug', $4::text, 'membershipPlan', $5::text, 'creationCodeId', $6::text))`,
          [tenant.id, actorUserId, input.requestId, tenant.slug, code.membership_plan, code.id],
        );
        await client.query(
          `UPDATE company_creation_codes
              SET status = 'redeemed', redeemed_at = now(), redeemed_tenant_id = $2
            WHERE id = $1`,
          [code.id, tenant.id],
        );
        await client.query("COMMIT");
        return {
          status: "created" as const,
          tenantId: tenant.id,
          tenantName: tenant.display_name,
          tenantSlug: tenant.slug,
          role: "owner" as const,
        };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async updateMembershipPlan(actorUserId, tenantId, membershipPlan, requestId) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await setPlatformContext(client, actorUserId);
        await lockTenantMembershipCapacity(client, tenantId);
        const current = await client.query<{
          membership_plan: MembershipPlan | null;
          additional_employee_seats: number;
          membership_entitlement_version: number;
        }>(
          `SELECT membership_plan, additional_employee_seats, membership_entitlement_version
             FROM tenants WHERE id = $1 FOR UPDATE`,
          [tenantId],
        );
        const tenant = current.rows[0];
        if (!tenant) {
          await client.query("ROLLBACK");
          return { status: "not_found" } satisfies MembershipPlanUpdateResult;
        }
        const nextLimit =
          membershipCatalog[membershipPlan].includedEmployeeSeats +
          tenant.additional_employee_seats;
        const activeEmployees = await client.query<{ count: string }>(
          `SELECT count(*) AS count
             FROM tenant_memberships
            WHERE tenant_id = $1 AND status = 'active'
              AND role IN ('supervisor', 'collector')`,
          [tenantId],
        );
        const activeEmployeeSeats = Number(activeEmployees.rows[0]?.count ?? 0);
        if (activeEmployeeSeats > nextLimit) {
          await client.query("ROLLBACK");
          return {
            status: "seat_limit_conflict",
            activeEmployeeSeats,
            employeeSeatLimit: nextLimit,
          } satisfies MembershipPlanUpdateResult;
        }
        let entitlement = buildMembershipEntitlement(
          membershipPlan,
          tenant.additional_employee_seats,
          tenant.membership_entitlement_version,
        );
        if (tenant.membership_plan !== membershipPlan) {
          const nextVersion = tenant.membership_entitlement_version + 1;
          await client.query(
            `UPDATE tenants
                SET membership_plan = $2,
                    membership_entitlement_version = $3,
                    updated_at = now()
              WHERE id = $1`,
            [tenantId, membershipPlan, nextVersion],
          );
          entitlement = await insertEntitlementVersion(client, {
            actorUserId,
            additionalEmployeeSeats: tenant.additional_employee_seats,
            membershipPlan,
            requestId,
            tenantId,
            version: nextVersion,
          });
          await client.query(
            `INSERT INTO audit_events
               (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
             VALUES (
               $1, $2, 'tenant.membership_plan_changed', 'tenant', $1, $3,
               jsonb_build_object(
                 'from', $4::text,
                 'to', $5::text,
                 'membershipCatalogVersion', 1
               )
             )`,
            [tenantId, actorUserId, requestId, tenant.membership_plan, membershipPlan],
          );
        }
        await client.query("COMMIT");
        return {
          status: "updated",
          membershipPlan,
          membershipEntitlement: entitlement,
        } satisfies MembershipPlanUpdateResult;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async updateMembershipEntitlement(actorUserId, tenantId, additionalEmployeeSeats, requestId) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await setPlatformContext(client, actorUserId);
        await lockTenantMembershipCapacity(client, tenantId);
        const current = await client.query<{
          membership_plan: MembershipPlan | null;
          additional_employee_seats: number;
          membership_entitlement_version: number;
        }>(
          `SELECT membership_plan, additional_employee_seats, membership_entitlement_version
             FROM tenants WHERE id = $1 FOR UPDATE`,
          [tenantId],
        );
        const tenant = current.rows[0];
        if (!tenant) {
          await client.query("ROLLBACK");
          return { status: "not_found" } satisfies MembershipEntitlementUpdateResult;
        }
        if (!tenant.membership_plan) {
          await client.query("ROLLBACK");
          return { status: "plan_required" } satisfies MembershipEntitlementUpdateResult;
        }
        const nextLimit =
          membershipCatalog[tenant.membership_plan].includedEmployeeSeats + additionalEmployeeSeats;
        const activeEmployees = await client.query<{ count: string }>(
          `SELECT count(*) AS count
             FROM tenant_memberships
            WHERE tenant_id = $1 AND status = 'active'
              AND role IN ('supervisor', 'collector')`,
          [tenantId],
        );
        const activeEmployeeSeats = Number(activeEmployees.rows[0]?.count ?? 0);
        if (activeEmployeeSeats > nextLimit) {
          await client.query("ROLLBACK");
          return {
            status: "seat_limit_conflict",
            activeEmployeeSeats,
            employeeSeatLimit: nextLimit,
          } satisfies MembershipEntitlementUpdateResult;
        }
        let entitlement = buildMembershipEntitlement(
          tenant.membership_plan,
          tenant.additional_employee_seats,
          tenant.membership_entitlement_version,
        );
        if (tenant.additional_employee_seats !== additionalEmployeeSeats) {
          const nextVersion = tenant.membership_entitlement_version + 1;
          await client.query(
            `UPDATE tenants
                SET additional_employee_seats = $2,
                    membership_entitlement_version = $3,
                    updated_at = now()
              WHERE id = $1`,
            [tenantId, additionalEmployeeSeats, nextVersion],
          );
          entitlement = await insertEntitlementVersion(client, {
            actorUserId,
            additionalEmployeeSeats,
            membershipPlan: tenant.membership_plan,
            requestId,
            tenantId,
            version: nextVersion,
          });
          await client.query(
            `INSERT INTO audit_events
               (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
             VALUES (
               $1, $2, 'tenant.membership_capacity_changed', 'tenant', $1, $3,
               jsonb_build_object(
                 'fromAdditionalEmployeeSeats', $4::integer,
                 'toAdditionalEmployeeSeats', $5::integer,
                 'employeeSeatLimit', $6::integer,
                 'membershipCatalogVersion', $7::integer,
                 'entitlementVersion', $8::integer
               )
             )`,
            [
              tenantId,
              actorUserId,
              requestId,
              tenant.additional_employee_seats,
              additionalEmployeeSeats,
              entitlement.employeeSeatLimit,
              membershipCatalogVersion,
              entitlement.version,
            ],
          );
        }
        await client.query("COMMIT");
        return {
          status: "updated",
          membershipEntitlement: entitlement,
        } satisfies MembershipEntitlementUpdateResult;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async updateTenantStatus(actorUserId, tenantId, targetStatus, requestId) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await setPlatformContext(client, actorUserId);
        const current = await client.query<{
          id: string;
          status: TenantStatus;
        }>("SELECT id, status FROM tenants WHERE id = $1 FOR UPDATE", [tenantId]);
        const currentTenant = current.rows[0];
        if (!currentTenant) {
          await client.query("ROLLBACK");
          return { status: "not_found" } satisfies TenantStatusUpdateResult;
        }

        const allowedTransitions: Record<TenantStatus, TenantStatus[]> = {
          draft: ["active", "archived"],
          active: ["suspended"],
          suspended: ["active", "archived"],
          archived: [],
        };
        if (!allowedTransitions[currentTenant.status].includes(targetStatus)) {
          await client.query("ROLLBACK");
          return { status: "invalid_transition" } satisfies TenantStatusUpdateResult;
        }

        if (targetStatus === "active") {
          const readiness = await client.query<{
            active_owner: boolean;
            active_branch: boolean;
            contact_email: boolean;
            membership_plan: boolean;
          }>(
            `SELECT
              EXISTS (
                SELECT 1 FROM tenant_memberships
                 WHERE tenant_id = $1 AND role = 'owner' AND status = 'active'
              ) AS active_owner,
              EXISTS (
                SELECT 1 FROM branches
                 WHERE tenant_id = $1 AND status = 'active'
              ) AS active_branch,
              EXISTS (
                SELECT 1 FROM tenant_settings
                 WHERE tenant_id = $1 AND contact_email IS NOT NULL
              ) AS contact_email,
              EXISTS (
                SELECT 1 FROM tenants
                 WHERE id = $1 AND membership_plan IS NOT NULL
              ) AS membership_plan`,
            [tenantId],
          );
          const state = readiness.rows[0];
          const missing: Array<
            "active_owner" | "active_branch" | "contact_email" | "membership_plan"
          > = [];
          if (!state?.active_owner) missing.push("active_owner");
          if (!state?.active_branch) missing.push("active_branch");
          if (!state?.contact_email) missing.push("contact_email");
          if (!state?.membership_plan) missing.push("membership_plan");
          if (missing.length > 0) {
            await client.query("ROLLBACK");
            return { status: "not_ready", missing } satisfies TenantStatusUpdateResult;
          }
        }

        const updated = await client.query<{
          id: string;
          slug: string;
          display_name: string;
          status: TenantStatus;
          membership_plan: MembershipPlan | null;
          additional_employee_seats: number;
          membership_entitlement_version: number;
          created_at: Date;
        }>(
          `UPDATE tenants
              SET status = $2, updated_at = now()
            WHERE id = $1
          RETURNING id, slug, display_name, status, membership_plan,
                    additional_employee_seats, membership_entitlement_version, created_at`,
          [tenantId, targetStatus],
        );
        const tenant = updated.rows[0];
        if (!tenant) throw new Error("Tenant status update did not return a record");
        const memberCount = await client.query<{ count: string }>(
          `SELECT count(*) AS count
             FROM tenant_memberships
            WHERE tenant_id = $1 AND status = 'active'`,
          [tenantId],
        );
        const readiness = await client.query<{
          active_owner: boolean;
          active_branch: boolean;
          contact_email: boolean;
          membership_plan: boolean;
        }>(
          `SELECT
             EXISTS (
               SELECT 1 FROM tenant_memberships
                WHERE tenant_id = $1 AND role = 'owner' AND status = 'active'
             ) AS active_owner,
             EXISTS (
               SELECT 1 FROM branches
                WHERE tenant_id = $1 AND status = 'active'
             ) AS active_branch,
             EXISTS (
               SELECT 1 FROM tenant_settings
                WHERE tenant_id = $1 AND contact_email IS NOT NULL
             ) AS contact_email,
             EXISTS (
               SELECT 1 FROM tenants
                WHERE id = $1 AND membership_plan IS NOT NULL
             ) AS membership_plan`,
          [tenantId],
        );
        await client.query(
          `INSERT INTO audit_events
             (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
           VALUES ($1, $2, 'tenant.status_changed', 'tenant', $1, $3,
                   jsonb_build_object('from', $4::text, 'to', $5::text))`,
          [tenantId, actorUserId, requestId, currentTenant.status, targetStatus],
        );
        await client.query("COMMIT");
        return {
          status: "updated",
          tenant: {
            id: tenant.id,
            slug: tenant.slug,
            displayName: tenant.display_name,
            status: tenant.status,
            membershipPlan: tenant.membership_plan,
            membershipEntitlement: tenant.membership_plan
              ? buildMembershipEntitlement(
                  tenant.membership_plan,
                  tenant.additional_employee_seats,
                  tenant.membership_entitlement_version,
                )
              : null,
            members: Number(memberCount.rows[0]?.count ?? 0),
            readiness: {
              activeOwner: readiness.rows[0]?.active_owner ?? false,
              activeBranch: readiness.rows[0]?.active_branch ?? false,
              contactEmail: readiness.rows[0]?.contact_email ?? false,
              membershipPlan: readiness.rows[0]?.membership_plan ?? false,
            },
            createdAt: tenant.created_at.toISOString(),
          },
        } satisfies TenantStatusUpdateResult;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async updateUserStatus(actorUserId, userId, targetStatus, requestId) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await setPlatformContext(client, actorUserId);
        const current = await client.query<{
          id: string;
          platform_role: "developer" | null;
          status: "active" | "disabled";
        }>("SELECT id, platform_role, status FROM users WHERE id = $1 FOR UPDATE", [userId]);
        const user = current.rows[0];
        if (!user) {
          await client.query("ROLLBACK");
          return { status: "not_found" } satisfies PlatformUserStatusUpdateResult;
        }
        if (user.id === actorUserId || user.platform_role === "developer") {
          await client.query("ROLLBACK");
          return { status: "protected" } satisfies PlatformUserStatusUpdateResult;
        }

        let revokedSessions = 0;
        if (user.status !== targetStatus) {
          await client.query(
            `UPDATE users
                SET status = $2, updated_at = now()
              WHERE id = $1`,
            [userId, targetStatus],
          );
          if (targetStatus === "disabled") {
            const revoked = await client.query(
              `UPDATE auth_sessions
                  SET revoked_at = now()
                WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now()`,
              [userId],
            );
            revokedSessions = revoked.rowCount ?? 0;
          }
          await client.query(
            `INSERT INTO audit_events
               (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
             VALUES (
               NULL, $1, 'user.status_changed', 'user', $2, $3,
               jsonb_build_object(
                 'from', $4::text,
                 'to', $5::text,
                 'revokedSessions', $6::integer
               )
             )`,
            [actorUserId, userId, requestId, user.status, targetStatus, revokedSessions],
          );
        }
        await client.query("COMMIT");
        return {
          status: "updated",
          userStatus: targetStatus,
          revokedSessions,
        } satisfies PlatformUserStatusUpdateResult;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async updateUserMembership(actorUserId, userId, input, requestId) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await setPlatformContext(client, actorUserId);
        const userResult = await client.query<{
          id: string;
          platform_role: "developer" | null;
          status: "active" | "disabled";
        }>("SELECT id, platform_role, status FROM users WHERE id = $1 FOR UPDATE", [userId]);
        const user = userResult.rows[0];
        if (!user) {
          await client.query("ROLLBACK");
          return { status: "not_found" } satisfies PlatformUserMembershipUpdateResult;
        }
        if (user.platform_role === "developer" || user.status !== "active") {
          await client.query("ROLLBACK");
          return { status: "protected" } satisfies PlatformUserMembershipUpdateResult;
        }
        const currentResult = await client.query<{ id: string; membership_plan: MembershipPlan }>(
          `SELECT id, membership_plan
             FROM user_memberships
            WHERE user_id = $1 AND status = 'active'
            FOR UPDATE`,
          [userId],
        );
        const current = currentResult.rows[0];
        if (current?.membership_plan === input.membershipPlan) {
          const activated = await client.query<{ activated_at: Date }>(
            "SELECT activated_at FROM user_memberships WHERE id = $1",
            [current.id],
          );
          await client.query("COMMIT");
          return {
            status: "updated",
            membershipPlan: current.membership_plan,
            activatedAt: activated.rows[0]?.activated_at.toISOString() ?? new Date().toISOString(),
          } satisfies PlatformUserMembershipUpdateResult;
        }
        if (current) {
          await client.query(
            `UPDATE user_memberships
                SET status = 'suspended', deactivated_at = now(), updated_at = now()
              WHERE id = $1`,
            [current.id],
          );
        }
        const inserted = await client.query<{
          membership_plan: MembershipPlan;
          activated_at: Date;
        }>(
          `INSERT INTO user_memberships (user_id, membership_plan, assigned_by)
           VALUES ($1, $2, $3)
           RETURNING membership_plan, activated_at`,
          [userId, input.membershipPlan, actorUserId],
        );
        const membership = inserted.rows[0];
        if (!membership) throw new Error("User membership insert did not return a record");
        await client.query(
          `INSERT INTO audit_events
             (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
           VALUES (NULL, $1, 'user.membership_activated', 'user', $2, $3,
                   jsonb_build_object('membershipPlan', $4::text, 'activatedAt', $5::text))`,
          [
            actorUserId,
            userId,
            requestId,
            membership.membership_plan,
            membership.activated_at.toISOString(),
          ],
        );
        await client.query("COMMIT");
        return {
          status: "updated",
          membershipPlan: membership.membership_plan,
          activatedAt: membership.activated_at.toISOString(),
        } satisfies PlatformUserMembershipUpdateResult;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
