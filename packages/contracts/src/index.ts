import { z } from "zod";

export const serviceStatusSchema = z.object({
  service: z.string(),
  status: z.enum(["ok", "degraded"]),
  version: z.string(),
  timestamp: z.iso.datetime(),
});

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    requestId: z.string().min(1),
  }),
});

export const tenantRoleSchema = z.enum(["owner", "supervisor", "collector", "customer"]);

export const tenantMembershipSchema = z.object({
  tenantId: z.uuid(),
  tenantName: z.string().min(1),
  tenantSlug: z.string().min(1),
  role: tenantRoleSchema,
});

export const currentUserSchema = z.object({
  id: z.uuid(),
  username: z.string().min(1),
  email: z.email(),
  displayName: z.string().min(1),
  platformRole: z.literal("developer").nullable(),
  mustChangePassword: z.boolean(),
  mfaEnabled: z.boolean(),
  memberships: z.array(tenantMembershipSchema),
});

export const loginRequestSchema = z.object({
  identifier: z.string().trim().min(3).max(254),
  password: z.string().min(12).max(256),
});

export const authenticatedResponseSchema = z.object({ user: currentUserSchema });

export const mfaLoginRequiredResponseSchema = z.object({
  mfaRequired: z.literal(true),
  expiresAt: z.iso.datetime(),
});

export const mfaCodeRequestSchema = z.object({
  code: z.string().trim().min(6).max(32),
});

export const accountSessionSchema = z.object({
  id: z.uuid(),
  userAgent: z.string().nullable(),
  createdAt: z.iso.datetime(),
  lastSeenAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  current: z.boolean(),
});

export const accountSessionsResponseSchema = z.object({
  sessions: z.array(accountSessionSchema),
});

export const securityActivitySchema = z.object({
  id: z.uuid(),
  action: z.string().min(1),
  happenedAt: z.iso.datetime(),
});

export const securityActivityResponseSchema = z.object({
  activity: z.array(securityActivitySchema),
});

export const mfaStatusSchema = z.object({
  enabled: z.boolean(),
  setupPending: z.boolean(),
  setupExpiresAt: z.iso.datetime().nullable(),
});

export const mfaStatusResponseSchema = z.object({ mfa: mfaStatusSchema });

export const mfaEnrollmentResponseSchema = z.object({
  enrollment: z.object({
    secret: z.string().min(16),
    qrDataUrl: z.string().startsWith("data:image/"),
    expiresAt: z.iso.datetime(),
  }),
});

export const mfaEnableResponseSchema = z.object({
  mfa: z.object({ enabled: z.literal(true) }),
  recoveryCodes: z.array(z.string().min(6)),
  revokedSessions: z.number().int().nonnegative(),
});

export const mfaDisableResponseSchema = z.object({
  mfa: z.object({ enabled: z.literal(false) }),
  revokedSessions: z.number().int().nonnegative(),
});

export const reauthenticationRequestSchema = z.object({
  password: z.string().min(12).max(256),
});

export const reauthenticationResponseSchema = z.object({
  reauthenticated: z.literal(true),
  validForMinutes: z.number().int().positive(),
});

export const changePasswordRequestSchema = z
  .object({
    currentPassword: z.string().min(12).max(256),
    newPassword: z.string().min(12).max(256),
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: "La nueva contraseña debe ser diferente.",
    path: ["newPassword"],
  });

export const messageResponseSchema = z.object({ message: z.string().min(1) });
export const revokedSessionsResponseSchema = z.object({
  revoked: z.number().int().nonnegative(),
});

export type ServiceStatus = z.infer<typeof serviceStatusSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
export type TenantRole = z.infer<typeof tenantRoleSchema>;
export type TenantMembership = z.infer<typeof tenantMembershipSchema>;
export type CurrentUser = z.infer<typeof currentUserSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type AuthenticatedResponse = z.infer<typeof authenticatedResponseSchema>;
export type MfaLoginRequiredResponse = z.infer<typeof mfaLoginRequiredResponseSchema>;
export type MfaCodeRequest = z.infer<typeof mfaCodeRequestSchema>;
export type AccountSession = z.infer<typeof accountSessionSchema>;
export type SecurityActivity = z.infer<typeof securityActivitySchema>;
export type MfaStatus = z.infer<typeof mfaStatusSchema>;
export type ReauthenticationRequest = z.infer<typeof reauthenticationRequestSchema>;
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;
