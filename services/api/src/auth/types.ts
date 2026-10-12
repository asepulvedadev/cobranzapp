import type {
  AccountSession as ContractAccountSession,
  MfaStatus as ContractMfaStatus,
  SecurityActivity as ContractSecurityActivity,
  TenantRole as ContractTenantRole,
  CurrentUser,
} from "@cobranzapp/contracts";

export type PlatformRole = CurrentUser["platformRole"];
export type TenantRole = ContractTenantRole;
export type AuthenticatedUser = CurrentUser;

export type SessionMetadata = {
  requestId: string;
  userAgent?: string;
  ipAddress?: string;
};

export type AccountSession = ContractAccountSession;
export type SecurityActivity = ContractSecurityActivity;
export type MfaStatus = ContractMfaStatus;

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
