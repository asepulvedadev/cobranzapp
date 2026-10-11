export type PlatformRole = "developer" | null;
export type TenantRole = "owner" | "supervisor" | "collector" | "customer";

export type AuthenticatedUser = {
  id: string;
  username: string;
  email: string;
  displayName: string;
  platformRole: PlatformRole;
  mustChangePassword: boolean;
  memberships: Array<{
    tenantId: string;
    tenantName: string;
    tenantSlug: string;
    role: TenantRole;
  }>;
};

export type SessionMetadata = {
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

export interface AuthService {
  login(
    identifier: string,
    password: string,
    metadata: SessionMetadata,
  ): Promise<{ token: string; user: AuthenticatedUser } | null>;
  authenticate(token: string): Promise<AuthenticatedUser | null>;
  logout(token: string): Promise<void>;
  reauthenticate(
    userId: string,
    token: string,
    password: string,
    requestId: string,
  ): Promise<boolean>;
  isRecentlyReauthenticated(userId: string, token: string, withinMinutes: number): Promise<boolean>;
  changePassword(userId: string, currentPassword: string, newPassword: string): Promise<boolean>;
  listSessions(userId: string, currentToken: string): Promise<AccountSession[]>;
  revokeSession(
    userId: string,
    sessionId: string,
    currentToken: string,
  ): Promise<"revoked" | "current" | "not_found">;
  revokeOtherSessions(userId: string, currentToken: string): Promise<number>;
}
