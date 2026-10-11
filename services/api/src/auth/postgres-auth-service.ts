import { createHash, randomBytes } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { hashPassword, verifyPassword } from "./password.js";
import type { AccountSession, AuthenticatedUser, AuthService, TenantRole } from "./types.js";

type UserRow = {
  id: string;
  username: string;
  email: string;
  display_name: string;
  password_hash: string;
  platform_role: "developer" | null;
  must_change_password: boolean;
};

function hashToken(token: string) {
  return createHash("sha256").update(token).digest();
}

function hashIp(ipAddress?: string) {
  return ipAddress ? createHash("sha256").update(ipAddress).digest() : null;
}

async function loadUser(client: PoolClient, userId: string): Promise<AuthenticatedUser | null> {
  const userResult = await client.query<UserRow>(
    `SELECT id, username, email, display_name, password_hash, platform_role, must_change_password
       FROM users
      WHERE id = $1 AND status = 'active'`,
    [userId],
  );
  const row = userResult.rows[0];
  if (!row) return null;

  await client.query("SELECT set_config('app.user_id', $1, true)", [row.id]);
  await client.query("SELECT set_config('app.platform_role', $1, true)", [row.platform_role ?? ""]);
  const membershipResult = await client.query<{
    tenant_id: string;
    display_name: string;
    slug: string;
    role: TenantRole;
  }>(
    `SELECT membership.tenant_id, tenant.display_name, tenant.slug, membership.role
       FROM tenant_memberships membership
       JOIN tenants tenant ON tenant.id = membership.tenant_id
      WHERE membership.user_id = $1
        AND membership.status = 'active'
        AND tenant.status IN ('draft', 'active')
      ORDER BY tenant.display_name`,
    [row.id],
  );

  return {
    id: row.id,
    username: row.username,
    email: row.email,
    displayName: row.display_name,
    platformRole: row.platform_role,
    mustChangePassword: row.must_change_password,
    memberships: membershipResult.rows.map((membership) => ({
      tenantId: membership.tenant_id,
      tenantName: membership.display_name,
      tenantSlug: membership.slug,
      role: membership.role,
    })),
  };
}

export function createPostgresAuthService(pool: Pool, sessionTtlHours: number): AuthService {
  return {
    async login(identifier, password, metadata) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await client.query<UserRow>(
          `SELECT id, username, email, display_name, password_hash, platform_role, must_change_password
             FROM users
            WHERE status = 'active'
              AND (username = lower($1) OR email = lower($1))
            LIMIT 1`,
          [identifier.trim()],
        );
        const row = result.rows[0];
        if (!row || !(await verifyPassword(password, row.password_hash))) {
          await client.query("ROLLBACK");
          return null;
        }

        const token = randomBytes(32).toString("base64url");
        await client.query(
          `INSERT INTO auth_sessions (user_id, token_hash, expires_at, user_agent, ip_hash)
           VALUES ($1, $2, now() + make_interval(hours => $3), $4, $5)`,
          [
            row.id,
            hashToken(token),
            sessionTtlHours,
            metadata.userAgent ?? null,
            hashIp(metadata.ipAddress),
          ],
        );
        const user = await loadUser(client, row.id);
        await client.query("COMMIT");
        return user ? { token, user } : null;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async authenticate(token) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const sessionResult = await client.query<{ user_id: string }>(
          `UPDATE auth_sessions
              SET last_seen_at = now()
            WHERE token_hash = $1
              AND revoked_at IS NULL
              AND expires_at > now()
          RETURNING user_id`,
          [hashToken(token)],
        );
        const session = sessionResult.rows[0];
        if (!session) {
          await client.query("ROLLBACK");
          return null;
        }
        const user = await loadUser(client, session.user_id);
        await client.query("COMMIT");
        return user;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async logout(token) {
      await pool.query(
        "UPDATE auth_sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL",
        [hashToken(token)],
      );
    },

    async changePassword(userId, currentPassword, newPassword) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await client.query<{ password_hash: string }>(
          "SELECT password_hash FROM users WHERE id = $1 AND status = 'active' FOR UPDATE",
          [userId],
        );
        const row = result.rows[0];
        if (!row || !(await verifyPassword(currentPassword, row.password_hash))) {
          await client.query("ROLLBACK");
          return false;
        }
        const nextHash = await hashPassword(newPassword);
        await client.query(
          `UPDATE users
              SET password_hash = $2,
                  must_change_password = false,
                  password_changed_at = now(),
                  updated_at = now()
            WHERE id = $1`,
          [userId, nextHash],
        );
        await client.query(
          "UPDATE auth_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL",
          [userId],
        );
        await client.query("COMMIT");
        return true;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async listSessions(userId, currentToken) {
      const result = await pool.query<{
        id: string;
        user_agent: string | null;
        created_at: Date;
        last_seen_at: Date;
        expires_at: Date;
        current: boolean;
      }>(
        `SELECT id, user_agent, created_at, last_seen_at, expires_at,
                token_hash = $2 AS current
           FROM auth_sessions
          WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now()
          ORDER BY current DESC, last_seen_at DESC`,
        [userId, hashToken(currentToken)],
      );
      return result.rows.map(
        (session): AccountSession => ({
          id: session.id,
          userAgent: session.user_agent,
          createdAt: session.created_at.toISOString(),
          lastSeenAt: session.last_seen_at.toISOString(),
          expiresAt: session.expires_at.toISOString(),
          current: session.current,
        }),
      );
    },

    async revokeSession(userId, sessionId, currentToken) {
      const currentHash = hashToken(currentToken);
      const revoked = await pool.query(
        `UPDATE auth_sessions
            SET revoked_at = now()
          WHERE id = $1 AND user_id = $2 AND token_hash <> $3
            AND revoked_at IS NULL AND expires_at > now()
        RETURNING id`,
        [sessionId, userId, currentHash],
      );
      if (revoked.rowCount) return "revoked";
      const current = await pool.query<{ current: boolean }>(
        `SELECT token_hash = $3 AS current
           FROM auth_sessions
          WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL AND expires_at > now()`,
        [sessionId, userId, currentHash],
      );
      return current.rows[0]?.current ? "current" : "not_found";
    },

    async revokeOtherSessions(userId, currentToken) {
      const result = await pool.query(
        `UPDATE auth_sessions
            SET revoked_at = now()
          WHERE user_id = $1 AND token_hash <> $2
            AND revoked_at IS NULL AND expires_at > now()`,
        [userId, hashToken(currentToken)],
      );
      return result.rowCount ?? 0;
    },
  };
}
