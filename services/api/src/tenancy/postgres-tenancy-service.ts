import { createHash, randomBytes } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { hashPassword } from "../auth/password.js";
import type { TenantRole } from "../auth/types.js";
import type {
  InvitationAcceptanceResult,
  InvitationPreview,
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

export function createPostgresTenancyService(pool: Pool, publicWebUrl: string): TenancyService {
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
        }>(
          `SELECT id, slug, display_name, status, locale, timezone, currency
             FROM tenants WHERE id = $1`,
          [tenantId],
        );
        const tenantRow = tenant.rows[0];
        if (!tenantRow || !actor.tenantRole) {
          await client.query("ROLLBACK");
          return null;
        }
        const metrics = await client.query<{
          members: string;
          branches: string;
          pending_invitations: string;
        }>(
          `SELECT
             (SELECT count(*) FROM tenant_memberships WHERE tenant_id = $1 AND status = 'active') AS members,
             (SELECT count(*) FROM branches WHERE tenant_id = $1 AND status = 'active') AS branches,
             (SELECT count(*) FROM tenant_invitations WHERE tenant_id = $1 AND accepted_at IS NULL
               AND revoked_at IS NULL AND expires_at > now()) AS pending_invitations`,
          [tenantId],
        );
        const branches = await client.query<{
          id: string;
          code: string;
          display_name: string;
          status: "active" | "inactive";
        }>(
          "SELECT id, code, display_name, status FROM branches WHERE tenant_id = $1 ORDER BY display_name",
          [tenantId],
        );
        const mayManagePeople = actor.tenantRole === "owner" || actor.tenantRole === "supervisor";
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
        await client.query("COMMIT");
        const counts = metrics.rows[0];
        return {
          tenant: {
            id: tenantRow.id,
            slug: tenantRow.slug,
            displayName: tenantRow.display_name,
            status: tenantRow.status,
            locale: tenantRow.locale,
            timezone: tenantRow.timezone,
            currency: tenantRow.currency,
          },
          actorRole: actor.tenantRole,
          metrics: {
            members: Number(counts?.members ?? 0),
            branches: Number(counts?.branches ?? 0),
            pendingInvitations: Number(counts?.pending_invitations ?? 0),
          },
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
          pendingInvitations: invitations.rows.map((invitation) => ({
            id: invitation.id,
            email: invitation.email,
            role: invitation.role,
            expiresAt: invitation.expires_at.toISOString(),
          })),
        } satisfies TenantOverview;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
