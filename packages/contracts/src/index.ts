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

export const platformAuditActivitySchema = z.object({
  id: z.uuid(),
  action: z.string().min(1),
  actorDisplayName: z.string().nullable(),
  actorUsername: z.string().nullable(),
  tenantId: z.uuid().nullable(),
  tenantName: z.string().nullable(),
  happenedAt: z.iso.datetime(),
});

export const platformActivityQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  action: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9_.]{2,80}$/)
    .optional(),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const platformActivityDirectorySchema = z.object({
  activity: z.array(platformAuditActivitySchema),
  availableActions: z.array(z.string().regex(/^[a-z][a-z0-9_.]{2,80}$/)),
  pagination: z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().positive(),
  }),
});

export const membershipPlanSchema = z.enum(["pro", "ultra"]);

export const membershipEntitlementSchema = z.object({
  catalogVersion: z.number().int().positive(),
  version: z.number().int().positive(),
  includedEmployeeSeats: z.number().int().nonnegative(),
  additionalEmployeeSeats: z.number().int().nonnegative(),
  employeeSeatLimit: z.number().int().nonnegative(),
  clientLimit: z.number().int().positive(),
  prioritySupport: z.boolean(),
});

export const platformTenantStatusSchema = z.enum(["draft", "active", "suspended", "archived"]);

export const platformTenantSchema = z.object({
  id: z.uuid(),
  slug: z.string().min(1),
  displayName: z.string().min(1),
  status: platformTenantStatusSchema,
  membershipPlan: membershipPlanSchema.nullable(),
  membershipEntitlement: membershipEntitlementSchema.nullable(),
  members: z.number().int().nonnegative(),
  readiness: z.object({
    activeOwner: z.boolean(),
    activeBranch: z.boolean(),
    contactEmail: z.boolean(),
    membershipPlan: z.boolean(),
  }),
  createdAt: z.iso.datetime(),
});

export const platformOverviewSchema = z.object({
  metrics: z.object({
    tenants: z.number().int().nonnegative(),
    activeTenants: z.number().int().nonnegative(),
    users: z.number().int().nonnegative(),
    activeMemberships: z.number().int().nonnegative(),
  }),
  tenants: z.array(platformTenantSchema),
  activity: z.array(platformAuditActivitySchema),
});

const pageQueryFields = {
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
};

export const platformTenantDirectoryQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  status: platformTenantStatusSchema.optional(),
  ...pageQueryFields,
});

export const platformPaginationSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().positive(),
});

export const platformTenantDirectorySchema = z.object({
  tenants: z.array(platformTenantSchema),
  pagination: platformPaginationSchema,
});

export const createPlatformTenantRequestSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(63),
  membershipPlan: membershipPlanSchema,
});

export const platformTenantResponseSchema = z.object({ tenant: platformTenantSchema });

export const platformTenantStatusUpdateRequestSchema = z.object({
  status: platformTenantStatusSchema.exclude(["draft"]),
});

export const platformMembershipPlanUpdateRequestSchema = z.object({
  membershipPlan: membershipPlanSchema,
});

export const platformMembershipPlanUpdateResponseSchema = z.object({
  membershipPlan: membershipPlanSchema,
  membershipEntitlement: membershipEntitlementSchema,
});

export const platformMembershipEntitlementUpdateRequestSchema = z.object({
  additionalEmployeeSeats: z.number().int().min(0).max(1000),
});

export const platformMembershipEntitlementUpdateResponseSchema = z.object({
  membershipEntitlement: membershipEntitlementSchema,
});

export const platformUserStatusSchema = z.enum(["active", "disabled"]);

export const platformUserSchema = z.object({
  id: z.uuid(),
  username: z.string().min(1),
  email: z.email(),
  displayName: z.string().min(1),
  platformRole: z.literal("developer").nullable(),
  status: platformUserStatusSchema,
  activeMemberships: z.number().int().nonnegative(),
  activeSessions: z.number().int().nonnegative(),
  lastSeenAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});

export const platformUserDirectoryQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  status: platformUserStatusSchema.optional(),
  ...pageQueryFields,
});

export const platformUserDirectorySchema = z.object({
  users: z.array(platformUserSchema),
  pagination: platformPaginationSchema,
});

export const platformUserStatusUpdateRequestSchema = z.object({
  status: platformUserStatusSchema,
});

export const platformUserStatusUpdateResponseSchema = z.object({
  status: platformUserStatusSchema,
  revokedSessions: z.number().int().nonnegative(),
});

export const platformSystemStatusSchema = z.object({
  api: z.object({ status: z.literal("operational"), version: z.string().min(1) }),
  database: z.object({
    status: z.literal("operational"),
    schemaVersion: z.string().nullable(),
  }),
  jobs: z.object({
    status: z.enum(["operational", "attention"]),
    due: z.number().int().nonnegative(),
    scheduled: z.number().int().nonnegative(),
    processing: z.number().int().nonnegative(),
    dead: z.number().int().nonnegative(),
    expiredLeases: z.number().int().nonnegative(),
    oldestDueAt: z.iso.datetime().nullable(),
  }),
  checkedAt: z.iso.datetime(),
});

export const supportAccessStatusSchema = z.enum([
  "pending",
  "active",
  "denied",
  "revoked",
  "expired",
]);

export const supportAccessRecordSchema = z.object({
  id: z.uuid(),
  tenantId: z.uuid(),
  tenantName: z.string().min(1),
  requestedByDisplayName: z.string().min(1),
  purpose: z.string().min(1),
  requestedDurationMinutes: z.number().int().positive(),
  status: supportAccessStatusSchema,
  requestedAt: z.iso.datetime(),
  reviewedByDisplayName: z.string().nullable(),
  reviewedAt: z.iso.datetime().nullable(),
  expiresAt: z.iso.datetime().nullable(),
});

export const platformSupportAccessResponseSchema = z.object({
  access: z.array(supportAccessRecordSchema),
});

export const tenantSettingsSchema = z.object({
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  contactEmail: z.email().nullable(),
  contactPhone: z.string().min(1).max(30).nullable(),
  address: z.string().min(1).max(240).nullable(),
  version: z.number().int().positive(),
});

export const tenantMemberStatusSchema = z.enum(["invited", "active", "suspended", "revoked"]);
export const organizationStatusSchema = z.enum(["active", "inactive"]);

export const tenantMemberSchema = z.object({
  userId: z.uuid(),
  displayName: z.string().min(1),
  email: z.email(),
  username: z.string().min(1),
  role: tenantRoleSchema,
  status: tenantMemberStatusSchema,
});

export const tenantBranchSchema = z.object({
  id: z.uuid(),
  code: z.string().min(1),
  displayName: z.string().min(1),
  status: organizationStatusSchema,
});

export const tenantTeamSchema = z.object({
  id: z.uuid(),
  branchId: z.uuid().nullable(),
  branchName: z.string().nullable(),
  displayName: z.string().min(1),
  status: organizationStatusSchema,
  memberIds: z.array(z.uuid()),
});

export const tenantSettingsHistoryEntrySchema = z.object({
  version: z.number().int().positive(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  contactEmail: z.email().nullable(),
  changedByDisplayName: z.string().min(1),
  changedAt: z.iso.datetime(),
});

export const tenantInvitationSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  role: tenantRoleSchema,
  expiresAt: z.iso.datetime(),
});

export const tenantAuditActivitySchema = z.object({
  id: z.uuid(),
  action: z.string().min(1),
  actorDisplayName: z.string().nullable(),
  actorUsername: z.string().nullable(),
  happenedAt: z.iso.datetime(),
});

export const tenantOverviewSchema = z.object({
  tenant: z.object({
    id: z.uuid(),
    slug: z.string().min(1),
    displayName: z.string().min(1),
    status: platformTenantStatusSchema,
    locale: z.string().min(2),
    timezone: z.string().min(1),
    currency: z.string().length(3),
    membershipPlan: membershipPlanSchema.nullable(),
  }),
  actorRole: z.union([tenantRoleSchema, z.literal("support")]),
  metrics: z.object({
    members: z.number().int().nonnegative(),
    branches: z.number().int().nonnegative(),
    teams: z.number().int().nonnegative(),
    pendingInvitations: z.number().int().nonnegative(),
    activeEmployeeSeats: z.number().int().nonnegative(),
  }),
  membershipEntitlement: membershipEntitlementSchema
    .extend({ availableEmployeeSeats: z.number().int().nonnegative() })
    .nullable(),
  settings: tenantSettingsSchema,
  settingsHistory: z.array(tenantSettingsHistoryEntrySchema),
  members: z.array(tenantMemberSchema),
  branches: z.array(tenantBranchSchema),
  teams: z.array(tenantTeamSchema),
  pendingInvitations: z.array(tenantInvitationSchema),
  activity: z.array(tenantAuditActivitySchema),
});

export const tenantOverviewResponseSchema = z.object({ overview: tenantOverviewSchema });

export const tenantSettingsUpdateRequestSchema = z.object({
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  contactEmail: z.union([z.email(), z.literal(""), z.null()]),
  contactPhone: z.union([z.string().trim().min(1).max(30), z.literal(""), z.null()]),
  address: z.union([z.string().trim().min(1).max(240), z.literal(""), z.null()]),
  version: z.number().int().positive(),
});

export const createBranchRequestSchema = z.object({
  code: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(40),
  displayName: z.string().trim().min(2).max(100),
});

export const createTeamRequestSchema = z.object({
  branchId: z.uuid().nullable(),
  displayName: z.string().trim().min(2).max(100),
});

export const organizationStatusUpdateRequestSchema = z.object({ status: organizationStatusSchema });

export const tenantMemberUpdateRequestSchema = z.object({
  role: z.enum(["supervisor", "collector", "customer"]),
  status: z.enum(["active", "suspended", "revoked"]),
});

export const tenantInvitationRequestSchema = z.object({
  email: z.email(),
  role: tenantRoleSchema,
});

export const tenantInvitationCreatedSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  role: tenantRoleSchema,
  expiresAt: z.iso.datetime(),
  acceptanceUrl: z.url(),
});

export const tenantInvitationCreatedResponseSchema = z.object({
  invitation: tenantInvitationCreatedSchema,
});

export const tenantSettingsResponseSchema = z.object({ settings: tenantSettingsSchema });
export const tenantBranchResponseSchema = z.object({ branch: tenantBranchSchema });
export const tenantTeamResponseSchema = z.object({ team: tenantTeamSchema });
export const tenantMemberResponseSchema = z.object({ member: tenantMemberSchema });

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
export type PlatformAuditActivity = z.infer<typeof platformAuditActivitySchema>;
export type PlatformActivityDirectory = z.infer<typeof platformActivityDirectorySchema>;
export type MembershipPlan = z.infer<typeof membershipPlanSchema>;
export type MembershipEntitlement = z.infer<typeof membershipEntitlementSchema>;
export type PlatformTenantStatus = z.infer<typeof platformTenantStatusSchema>;
export type PlatformTenant = z.infer<typeof platformTenantSchema>;
export type PlatformOverview = z.infer<typeof platformOverviewSchema>;
export type PlatformTenantDirectory = z.infer<typeof platformTenantDirectorySchema>;
export type CreatePlatformTenantRequest = z.infer<typeof createPlatformTenantRequestSchema>;
export type PlatformTenantStatusUpdateRequest = z.infer<
  typeof platformTenantStatusUpdateRequestSchema
>;
export type PlatformMembershipPlanUpdateRequest = z.infer<
  typeof platformMembershipPlanUpdateRequestSchema
>;
export type PlatformMembershipEntitlementUpdateRequest = z.infer<
  typeof platformMembershipEntitlementUpdateRequestSchema
>;
export type PlatformUserStatus = z.infer<typeof platformUserStatusSchema>;
export type PlatformUser = z.infer<typeof platformUserSchema>;
export type PlatformUserDirectory = z.infer<typeof platformUserDirectorySchema>;
export type PlatformUserStatusUpdateRequest = z.infer<typeof platformUserStatusUpdateRequestSchema>;
export type PlatformSystemStatus = z.infer<typeof platformSystemStatusSchema>;
export type SupportAccessStatus = z.infer<typeof supportAccessStatusSchema>;
export type SupportAccessRecord = z.infer<typeof supportAccessRecordSchema>;
export type TenantOverview = z.infer<typeof tenantOverviewSchema>;
export type TenantSettingsUpdateRequest = z.infer<typeof tenantSettingsUpdateRequestSchema>;
export type CreateBranchRequest = z.infer<typeof createBranchRequestSchema>;
export type CreateTeamRequest = z.infer<typeof createTeamRequestSchema>;
export type OrganizationStatusUpdateRequest = z.infer<typeof organizationStatusUpdateRequestSchema>;
export type TenantMemberUpdateRequest = z.infer<typeof tenantMemberUpdateRequestSchema>;
export type TenantInvitationRequest = z.infer<typeof tenantInvitationRequestSchema>;
export type MfaStatus = z.infer<typeof mfaStatusSchema>;
export type ReauthenticationRequest = z.infer<typeof reauthenticationRequestSchema>;
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;
