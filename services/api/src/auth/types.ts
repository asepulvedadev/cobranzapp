export type PlatformRole = "developer" | null;
export type TenantRole = "owner" | "supervisor" | "collector" | "customer";

export type AuthenticatedUser = {
  id: string;
  username: string;
  email: string;
  displayName: string;
  platformRole: PlatformRole;
  mustChangePassword: boolean;
  mfaEnabled: boolean;
  memberships: Array<{
    tenantId: string;
    tenantName: string;
    tenantSlug: string;
    role: TenantRole;
  }>;
};

export type SessionMetadata = {
  requestId: string;
  userAgent?: string;
  ipAddress?: string;
};

export type AccountSession = {
  id: string;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  current: boolean;
};

export type SecurityActivity = {
  id: string;
  action: string;
  happenedAt: string;
};

export type MfaStatus = {
  enabled: boolean;
  setupPending: boolean;
  setupExpiresAt: string | null;
};

export type MfaEnrollmentResult =
  | { status: "created"; secret: string; uri: string; expiresAt: string }
  | { status: "already_enabled" }
  | { status: "not_found" };

export type MfaConfirmationResult =
  | { status: "enabled"; recoveryCodes: string[]; revokedSessions: number }
  | { status: "already_enabled" }
  | { status: "invalid" }
  | { status: "expired" }
  | { status: "not_found" };

export type MfaDisableResult =
  | { status: "disabled"; revokedSessions: number }
  | { status: "invalid" }
  | { status: "not_enabled" }
  | { status: "not_found" };

export type LoginResult =
  | { status: "authenticated"; token: string; user: AuthenticatedUser }
  | { status: "mfa_required"; challengeToken: string; expiresAt: string };

export type MfaChallengeResult =
  | { status: "authenticated"; token: string; user: AuthenticatedUser }
  | { status: "invalid" }
  | { status: "expired" }
  | { status: "locked" };

export interface AuthService {
  login(
    identifier: string,
    password: string,
    metadata: SessionMetadata,
  ): Promise<LoginResult | null>;
  verifyMfaChallenge(
    challengeToken: string,
    code: string,
    requestId: string,
  ): Promise<MfaChallengeResult>;
  authenticate(token: string): Promise<AuthenticatedUser | null>;
  logout(token: string, requestId: string): Promise<void>;
  reauthenticate(
    userId: string,
    token: string,
    password: string,
    requestId: string,
  ): Promise<boolean>;
  isRecentlyReauthenticated(userId: string, token: string, withinMinutes: number): Promise<boolean>;
  changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    requestId: string,
  ): Promise<boolean>;
  listSessions(userId: string, currentToken: string): Promise<AccountSession[]>;
  listSecurityActivity(userId: string): Promise<SecurityActivity[]>;
  revokeSession(
    userId: string,
    sessionId: string,
    currentToken: string,
    requestId: string,
  ): Promise<"revoked" | "current" | "not_found">;
  revokeOtherSessions(userId: string, currentToken: string, requestId: string): Promise<number>;
  getMfaStatus(userId: string): Promise<MfaStatus>;
  beginMfaEnrollment(userId: string, requestId: string): Promise<MfaEnrollmentResult>;
  confirmMfaEnrollment(
    userId: string,
    currentToken: string,
    code: string,
    requestId: string,
  ): Promise<MfaConfirmationResult>;
  disableMfa(
    userId: string,
    currentToken: string,
    code: string,
    requestId: string,
  ): Promise<MfaDisableResult>;
}
