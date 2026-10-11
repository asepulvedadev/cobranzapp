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

export interface AuthService {
  login(
    identifier: string,
    password: string,
    metadata: SessionMetadata,
  ): Promise<{ token: string; user: AuthenticatedUser } | null>;
  authenticate(token: string): Promise<AuthenticatedUser | null>;
  logout(token: string): Promise<void>;
  changePassword(userId: string, currentPassword: string, newPassword: string): Promise<boolean>;
}
