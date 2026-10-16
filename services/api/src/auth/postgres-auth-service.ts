import { createHash, randomBytes } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import {
  createMfaSecret,
  createMfaUri,
  createRecoveryCodes,
  decryptMfaSecret,
  encryptMfaSecret,
  hashRecoveryCode,
  verifyMfaToken,
} from "./mfa.js";
import { hashPassword, verifyPassword } from "./password.js";
import type {
  AccountSession,
  AuthenticatedUser,
  AuthService,
  MfaChallengeResult,
  MfaDisableResult,
  SecurityActivity,
  TenantRole,
} from "./types.js";

type UserRow = {
  id: string;
  username: string;
  email: string;
  display_name: string;
  password_hash: string;
  platform_role: "developer" | null;
  must_change_password: boolean;
  mfa_enabled_at: Date | null;
};

function hashToken(token: string) {
  return createHash("sha256").update(token).digest();
}

function hashIp(ipAddress?: string) {
  return ipAddress ? createHash("sha256").update(ipAddress).digest() : null;
}

async function loadUser(client: PoolClient, userId: string): Promise<AuthenticatedUser | null> {
  const userResult = await client.query<UserRow>(
    `SELECT id, username, email, display_name, password_hash, platform_role, must_change_password,
            mfa_enabled_at
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
    mfaEnabled: row.mfa_enabled_at !== null,
    memberships: membershipResult.rows.map((membership) => ({
      tenantId: membership.tenant_id,
      tenantName: membership.display_name,
      tenantSlug: membership.slug,
      role: membership.role,
    })),
  };
}

type MfaCredentialRow = {
  mfa_secret_encrypted: string | null;
  mfa_enabled_at: Date | null;
  mfa_setup_expires_at: Date | null;
  mfa_last_used_counter: string | null;
};

type MfaChallengeRow = MfaCredentialRow & {
  id: string;
  user_id: string;
  platform_role: "developer" | null;
  attempts: number;
  expires_at: Date;
  used_at: Date | null;
  user_agent: string | null;
  ip_hash: Buffer | null;
};

async function verifyAndConsumeMfaCode(
  client: PoolClient,
  userId: string,
  credential: MfaCredentialRow,
  code: string,
  key: Buffer,
) {
  if (!credential.mfa_secret_encrypted || !credential.mfa_enabled_at) return false;
  if (/^\d{6}$/.test(code)) {
    const counter = verifyMfaToken(
      decryptMfaSecret(credential.mfa_secret_encrypted, key),
      code,
      credential.mfa_last_used_counter === null ? null : Number(credential.mfa_last_used_counter),
    );
    if (counter === null) return false;
    await client.query("UPDATE users SET mfa_last_used_counter = $2 WHERE id = $1", [
      userId,
      counter,
    ]);
    return true;
  }
  const recovered = await client.query(
    `UPDATE auth_mfa_recovery_codes
        SET used_at = now()
      WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL`,
    [userId, hashRecoveryCode(code)],
  );
  return Boolean(recovered.rowCount);
}

export function createPostgresAuthService(
  pool: Pool,
  sessionTtlHours: number,
  mfaEncryptionKey: Buffer,
): AuthService {
  return {
    async login(identifier, password, metadata) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await client.query<UserRow>(
          `SELECT id, username, email, display_name, password_hash, platform_role, must_change_password,
                  mfa_enabled_at
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

        if (row.mfa_enabled_at) {
          const challengeToken = randomBytes(32).toString("base64url");
          const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
          await client.query("SELECT set_config('app.user_id', $1, true)", [row.id]);
          await client.query("SELECT set_config('app.platform_role', $1, true)", [
            row.platform_role ?? "",
          ]);
          await client.query(
            `UPDATE auth_mfa_challenges
                SET used_at = now()
              WHERE user_id = $1 AND used_at IS NULL`,
            [row.id],
          );
          const challenge = await client.query<{ id: string }>(
            `INSERT INTO auth_mfa_challenges
               (user_id, token_hash, expires_at, user_agent, ip_hash)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id`,
            [
              row.id,
              hashToken(challengeToken),
              expiresAt,
              metadata.userAgent ?? null,
              hashIp(metadata.ipAddress),
            ],
          );
          const challengeId = challenge.rows[0]?.id;
          if (!challengeId) throw new Error("MFA login did not create a challenge");
          await client.query(
            `INSERT INTO audit_events
               (tenant_id, actor_user_id, action, target_type, target_id, request_id)
             VALUES (NULL, $1, 'auth.mfa_challenge_created', 'auth_mfa_challenge', $2, $3)`,
            [row.id, challengeId, metadata.requestId],
          );
          await client.query("COMMIT");
          return {
            status: "mfa_required",
            challengeToken,
            expiresAt: expiresAt.toISOString(),
          } as const;
        }

        const token = randomBytes(32).toString("base64url");
        const sessionResult = await client.query<{ id: string }>(
          `INSERT INTO auth_sessions
             (user_id, token_hash, expires_at, user_agent, ip_hash, reauthenticated_at)
           VALUES ($1, $2, now() + make_interval(hours => $3), $4, $5, now())
           RETURNING id`,
          [
            row.id,
            hashToken(token),
            sessionTtlHours,
            metadata.userAgent ?? null,
            hashIp(metadata.ipAddress),
          ],
        );
        const user = await loadUser(client, row.id);
        const sessionId = sessionResult.rows[0]?.id;
        if (!user || !sessionId) throw new Error("Login did not create a complete session");
        await client.query(
          `INSERT INTO audit_events
             (tenant_id, actor_user_id, action, target_type, target_id, request_id)
           VALUES (NULL, $1, 'auth.login_succeeded', 'auth_session', $2, $3)`,
          [row.id, sessionId, metadata.requestId],
        );
        await client.query("COMMIT");
        return { status: "authenticated", token, user } as const;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async verifyMfaChallenge(challengeToken, code, requestId) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await client.query<MfaChallengeRow>(
          `SELECT challenge.id, challenge.user_id, challenge.attempts, challenge.expires_at,
                  challenge.used_at, challenge.user_agent, challenge.ip_hash,
                  users.platform_role, users.mfa_secret_encrypted, users.mfa_enabled_at,
                  users.mfa_setup_expires_at, users.mfa_last_used_counter
             FROM auth_mfa_challenges challenge
             JOIN users ON users.id = challenge.user_id AND users.status = 'active'
            WHERE challenge.token_hash = $1
            FOR UPDATE OF challenge, users`,
          [hashToken(challengeToken)],
        );
        const challenge = result.rows[0];
        if (!challenge || challenge.used_at) {
          await client.query("ROLLBACK");
          return { status: "invalid" } satisfies MfaChallengeResult;
        }
        if (challenge.expires_at <= new Date()) {
          await client.query("ROLLBACK");
          return { status: "expired" } satisfies MfaChallengeResult;
        }
        if (challenge.attempts >= 5) {
          await client.query("ROLLBACK");
          return { status: "locked" } satisfies MfaChallengeResult;
        }
        await client.query("SELECT set_config('app.user_id', $1, true)", [challenge.user_id]);
        await client.query("SELECT set_config('app.platform_role', $1, true)", [
          challenge.platform_role ?? "",
        ]);
        const valid = await verifyAndConsumeMfaCode(
          client,
          challenge.user_id,
          challenge,
          code,
          mfaEncryptionKey,
        );
        if (!valid) {
          const attempts = challenge.attempts + 1;
          await client.query("UPDATE auth_mfa_challenges SET attempts = $2 WHERE id = $1", [
            challenge.id,
            attempts,
          ]);
          await client.query(
            `INSERT INTO audit_events
               (tenant_id, actor_user_id, action, target_type, target_id, request_id)
             VALUES (NULL, $1, $2, 'auth_mfa_challenge', $3, $4)`,
            [
              challenge.user_id,
              attempts >= 5 ? "auth.mfa_login_locked" : "auth.mfa_login_failed",
              challenge.id,
              requestId,
            ],
          );
          await client.query("COMMIT");
          return {
            status: attempts >= 5 ? "locked" : "invalid",
          } satisfies MfaChallengeResult;
        }
        await client.query("UPDATE auth_mfa_challenges SET used_at = now() WHERE id = $1", [
          challenge.id,
        ]);
        const token = randomBytes(32).toString("base64url");
        const session = await client.query<{ id: string }>(
          `INSERT INTO auth_sessions
             (user_id, token_hash, expires_at, user_agent, ip_hash, reauthenticated_at)
           VALUES ($1, $2, now() + make_interval(hours => $3), $4, $5, now())
           RETURNING id`,
          [
            challenge.user_id,
            hashToken(token),
            sessionTtlHours,
            challenge.user_agent,
            challenge.ip_hash,
          ],
        );
        const user = await loadUser(client, challenge.user_id);
        const sessionId = session.rows[0]?.id;
        if (!user || !sessionId) throw new Error("MFA login did not create a complete session");
        await client.query(
          `INSERT INTO audit_events
             (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
           VALUES
             (NULL, $1, 'auth.login_succeeded', 'auth_session', $2, $3,
              jsonb_build_object('method', 'totp')),
             (NULL, $1, 'auth.mfa_login_succeeded', 'auth_session', $2, $3, '{}'::jsonb)`,
          [challenge.user_id, sessionId, requestId],
        );
        await client.query("COMMIT");
        return { status: "authenticated", token, user } satisfies MfaChallengeResult;
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
              SET last_seen_at = now(),
                  expires_at = now() + make_interval(hours => $2),
                  reauthenticated_at = now()
            WHERE token_hash = $1
              AND revoked_at IS NULL
              AND expires_at > now()
          RETURNING user_id`,
          [hashToken(token), sessionTtlHours],
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

    async logout(token, requestId) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await client.query<{ id: string; user_id: string }>(
          `UPDATE auth_sessions
              SET revoked_at = now()
            WHERE token_hash = $1 AND revoked_at IS NULL
          RETURNING id, user_id`,
          [hashToken(token)],
        );
        const session = result.rows[0];
        if (session) {
          await client.query("SELECT set_config('app.user_id', $1, true)", [session.user_id]);
          await client.query(
            `INSERT INTO audit_events
               (tenant_id, actor_user_id, action, target_type, target_id, request_id)
             VALUES (NULL, $1, 'auth.logged_out', 'auth_session', $2, $3)`,
            [session.user_id, session.id, requestId],
          );
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async reauthenticate(userId, token, password, requestId) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await client.query<{
          password_hash: string;
          platform_role: "developer" | null;
        }>(
          `SELECT password_hash, platform_role
             FROM users
            WHERE id = $1 AND status = 'active'
            FOR UPDATE`,
          [userId],
        );
        const user = result.rows[0];
        if (!user || !(await verifyPassword(password, user.password_hash))) {
          await client.query("ROLLBACK");
          return false;
        }
        await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
        await client.query("SELECT set_config('app.platform_role', $1, true)", [
          user.platform_role ?? "",
        ]);
        const session = await client.query<{ id: string }>(
          `UPDATE auth_sessions
              SET reauthenticated_at = now(),
                  last_seen_at = now()
            WHERE user_id = $1
              AND token_hash = $2
              AND revoked_at IS NULL
              AND expires_at > now()
          RETURNING id`,
          [userId, hashToken(token)],
        );
        const sessionId = session.rows[0]?.id;
        if (!sessionId) {
          await client.query("ROLLBACK");
          return false;
        }
        await client.query(
          `INSERT INTO audit_events
             (tenant_id, actor_user_id, action, target_type, target_id, request_id)
           VALUES (NULL, $1, 'auth.reauthenticated', 'auth_session', $2, $3)`,
          [userId, sessionId, requestId],
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

    async isRecentlyReauthenticated(userId, token, withinMinutes) {
      const result = await pool.query(
        `SELECT 1
           FROM auth_sessions
          WHERE user_id = $1
            AND token_hash = $2
            AND revoked_at IS NULL
            AND expires_at > now()
            AND reauthenticated_at > now() - make_interval(mins => $3)
          LIMIT 1`,
        [userId, hashToken(token), withinMinutes],
      );
      return Boolean(result.rowCount);
    },

    async changePassword(userId, currentPassword, newPassword, requestId) {
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
        await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
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
        await client.query(
          `INSERT INTO audit_events
             (tenant_id, actor_user_id, action, target_type, target_id, request_id)
           VALUES (NULL, $1, 'auth.password_changed', 'user', $1, $2)`,
          [userId, requestId],
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

    async listSecurityActivity(userId) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
        const result = await client.query<{
          id: string;
          action: string;
          happened_at: Date;
        }>(
          `SELECT id, action, happened_at
             FROM audit_events
            WHERE tenant_id IS NULL
              AND actor_user_id = $1
              AND action LIKE 'auth.%'
            ORDER BY happened_at DESC, id DESC
            LIMIT 20`,
          [userId],
        );
        await client.query("COMMIT");
        return result.rows.map(
          (event): SecurityActivity => ({
            id: event.id,
            action: event.action,
            happenedAt: event.happened_at.toISOString(),
          }),
        );
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async revokeSession(userId, sessionId, currentToken, requestId) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const currentHash = hashToken(currentToken);
        const revoked = await client.query<{ id: string }>(
          `UPDATE auth_sessions
              SET revoked_at = now()
            WHERE id = $1 AND user_id = $2 AND token_hash <> $3
              AND revoked_at IS NULL AND expires_at > now()
          RETURNING id`,
          [sessionId, userId, currentHash],
        );
        if (revoked.rowCount) {
          await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
          await client.query(
            `INSERT INTO audit_events
               (tenant_id, actor_user_id, action, target_type, target_id, request_id)
             VALUES (NULL, $1, 'auth.session_revoked', 'auth_session', $2, $3)`,
            [userId, sessionId, requestId],
          );
          await client.query("COMMIT");
          return "revoked";
        }
        const current = await client.query<{ current: boolean }>(
          `SELECT token_hash = $3 AS current
             FROM auth_sessions
            WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL AND expires_at > now()`,
          [sessionId, userId, currentHash],
        );
        await client.query("ROLLBACK");
        return current.rows[0]?.current ? "current" : "not_found";
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async revokeOtherSessions(userId, currentToken, requestId) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await client.query<{ id: string }>(
          `UPDATE auth_sessions
              SET revoked_at = now()
            WHERE user_id = $1 AND token_hash <> $2
              AND revoked_at IS NULL AND expires_at > now()
          RETURNING id`,
          [userId, hashToken(currentToken)],
        );
        if (result.rowCount) {
          await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
          await client.query(
            `INSERT INTO audit_events
               (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
             VALUES (
               NULL, $1, 'auth.other_sessions_revoked', 'user', $1, $2,
               jsonb_build_object('revokedCount', $3::integer)
             )`,
            [userId, requestId, result.rowCount],
          );
        }
        await client.query("COMMIT");
        return result.rowCount ?? 0;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async getMfaStatus(userId) {
      const result = await pool.query<{
        mfa_enabled_at: Date | null;
        mfa_setup_expires_at: Date | null;
      }>(
        `SELECT mfa_enabled_at, mfa_setup_expires_at
           FROM users
          WHERE id = $1 AND status = 'active'`,
        [userId],
      );
      const user = result.rows[0];
      return {
        enabled: user?.mfa_enabled_at !== null && user?.mfa_enabled_at !== undefined,
        setupPending:
          user?.mfa_enabled_at === null &&
          user.mfa_setup_expires_at !== null &&
          user.mfa_setup_expires_at > new Date(),
        setupExpiresAt: user?.mfa_setup_expires_at?.toISOString() ?? null,
      };
    },

    async beginMfaEnrollment(userId, requestId) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const current = await client.query<{
          email: string;
          mfa_enabled_at: Date | null;
        }>(
          `SELECT email, mfa_enabled_at
             FROM users
            WHERE id = $1 AND status = 'active'
            FOR UPDATE`,
          [userId],
        );
        const user = current.rows[0];
        if (!user) {
          await client.query("ROLLBACK");
          return { status: "not_found" } as const;
        }
        if (user.mfa_enabled_at) {
          await client.query("ROLLBACK");
          return { status: "already_enabled" } as const;
        }
        const secret = createMfaSecret();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
        await client.query(
          `UPDATE users
              SET mfa_secret_encrypted = $2,
                  mfa_setup_expires_at = $3,
                  mfa_last_used_counter = NULL,
                  updated_at = now()
            WHERE id = $1`,
          [userId, encryptMfaSecret(secret, mfaEncryptionKey), expiresAt],
        );
        await client.query("DELETE FROM auth_mfa_recovery_codes WHERE user_id = $1", [userId]);
        await client.query(
          `INSERT INTO audit_events
             (tenant_id, actor_user_id, action, target_type, target_id, request_id)
           VALUES (NULL, $1, 'auth.mfa_setup_started', 'user', $1, $2)`,
          [userId, requestId],
        );
        await client.query("COMMIT");
        return {
          status: "created",
          secret,
          uri: createMfaUri(user.email, secret),
          expiresAt: expiresAt.toISOString(),
        } as const;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async confirmMfaEnrollment(userId, currentToken, code, requestId) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const current = await client.query<MfaCredentialRow>(
          `SELECT mfa_secret_encrypted, mfa_enabled_at, mfa_setup_expires_at,
                  mfa_last_used_counter
             FROM users
            WHERE id = $1 AND status = 'active'
            FOR UPDATE`,
          [userId],
        );
        const credential = current.rows[0];
        if (!credential) {
          await client.query("ROLLBACK");
          return { status: "not_found" } as const;
        }
        if (credential.mfa_enabled_at) {
          await client.query("ROLLBACK");
          return { status: "already_enabled" } as const;
        }
        if (
          !credential.mfa_secret_encrypted ||
          !credential.mfa_setup_expires_at ||
          credential.mfa_setup_expires_at <= new Date()
        ) {
          await client.query("ROLLBACK");
          return { status: "expired" } as const;
        }
        const counter = verifyMfaToken(
          decryptMfaSecret(credential.mfa_secret_encrypted, mfaEncryptionKey),
          code,
          null,
        );
        if (counter === null) {
          await client.query("ROLLBACK");
          return { status: "invalid" } as const;
        }
        const recoveryCodes = createRecoveryCodes();
        await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
        await client.query(
          `UPDATE users
              SET mfa_enabled_at = now(),
                  mfa_setup_expires_at = NULL,
                  mfa_last_used_counter = $2,
                  updated_at = now()
            WHERE id = $1`,
          [userId, counter],
        );
        for (const recoveryCode of recoveryCodes) {
          await client.query(
            `INSERT INTO auth_mfa_recovery_codes (user_id, code_hash)
             VALUES ($1, $2)`,
            [userId, hashRecoveryCode(recoveryCode)],
          );
        }
        const revoked = await client.query(
          `UPDATE auth_sessions
              SET revoked_at = now()
            WHERE user_id = $1 AND token_hash <> $2
              AND revoked_at IS NULL AND expires_at > now()`,
          [userId, hashToken(currentToken)],
        );
        await client.query(
          `INSERT INTO audit_events
             (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
           VALUES (
             NULL, $1, 'auth.mfa_enabled', 'user', $1, $2,
             jsonb_build_object('revokedSessions', $3::integer)
           )`,
          [userId, requestId, revoked.rowCount ?? 0],
        );
        await client.query("COMMIT");
        return {
          status: "enabled",
          recoveryCodes,
          revokedSessions: revoked.rowCount ?? 0,
        } as const;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async disableMfa(userId, currentToken, code, requestId) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const current = await client.query<MfaCredentialRow>(
          `SELECT mfa_secret_encrypted, mfa_enabled_at, mfa_setup_expires_at,
                  mfa_last_used_counter
             FROM users
            WHERE id = $1 AND status = 'active'
            FOR UPDATE`,
          [userId],
        );
        const credential = current.rows[0];
        if (!credential) {
          await client.query("ROLLBACK");
          return { status: "not_found" } satisfies MfaDisableResult;
        }
        if (!credential.mfa_enabled_at) {
          await client.query("ROLLBACK");
          return { status: "not_enabled" } satisfies MfaDisableResult;
        }
        if (!(await verifyAndConsumeMfaCode(client, userId, credential, code, mfaEncryptionKey))) {
          await client.query("ROLLBACK");
          return { status: "invalid" } satisfies MfaDisableResult;
        }
        await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
        await client.query(
          `UPDATE users
              SET mfa_secret_encrypted = NULL,
                  mfa_setup_expires_at = NULL,
                  mfa_enabled_at = NULL,
                  mfa_last_used_counter = NULL,
                  updated_at = now()
            WHERE id = $1`,
          [userId],
        );
        await client.query("DELETE FROM auth_mfa_recovery_codes WHERE user_id = $1", [userId]);
        const revoked = await client.query(
          `UPDATE auth_sessions
              SET revoked_at = now()
            WHERE user_id = $1 AND token_hash <> $2
              AND revoked_at IS NULL AND expires_at > now()`,
          [userId, hashToken(currentToken)],
        );
        await client.query(
          `INSERT INTO audit_events
             (tenant_id, actor_user_id, action, target_type, target_id, request_id, metadata)
           VALUES (
             NULL, $1, 'auth.mfa_disabled', 'user', $1, $2,
             jsonb_build_object('revokedSessions', $3::integer)
           )`,
          [userId, requestId, revoked.rowCount ?? 0],
        );
        await client.query("COMMIT");
        return {
          status: "disabled",
          revokedSessions: revoked.rowCount ?? 0,
        } satisfies MfaDisableResult;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
