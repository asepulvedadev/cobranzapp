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

export const userProfileSchema = z.object({
  userId: z.uuid(),
  username: z.string().min(1),
  email: z.email(),
  displayName: z.string().min(1),
  phone: z.string().max(30).nullable(),
  homeAddress: z.string().max(240).nullable(),
  workAddress: z.string().max(240).nullable(),
  profilePhotoObjectKey: z.string().nullable(),
});

export const userProfileResponseSchema = z.object({ profile: userProfileSchema });

export const userProfileUpdateRequestSchema = z.object({
  displayName: z.string().trim().min(2).max(100),
  phone: z.string().trim().max(30).nullable(),
  homeAddress: z.string().trim().max(240).nullable(),
  workAddress: z.string().trim().max(240).nullable(),
});

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

export const createOwnerTenantRequestSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^CZA-[A-Z0-9]{4}(?:-[A-Z0-9]{4}){2}$/)
    .optional(),
  password: z.string().min(12).max(256),
});

export const ownerTenantResponseSchema = z.object({
  tenant: tenantMembershipSchema,
});

export const ownerSubscriptionSchema = z.object({
  membershipPlan: membershipPlanSchema,
  activatedAt: z.iso.datetime(),
});

export const ownerSubscriptionSummarySchema = z.object({
  availableCount: z.number().int().nonnegative(),
  availableSubscriptions: z.array(ownerSubscriptionSchema),
});

export const platformTenantResponseSchema = z.object({ tenant: platformTenantSchema });

export const createPlatformOwnerRequestSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,40}$/),
  email: z.email(),
  displayName: z.string().trim().min(2).max(100),
  temporaryPassword: z.string().min(12).max(256),
});

export const createCompanyCreationCodeRequestSchema = z.object({
  ownerUserId: z.uuid(),
  membershipPlan: membershipPlanSchema,
});

export const companyCreationCodeSchema = z.object({
  id: z.uuid(),
  code: z.string().regex(/^CZA-[A-Z0-9]{4}(?:-[A-Z0-9]{4}){2}$/),
  ownerUserId: z.uuid(),
  ownerDisplayName: z.string().min(1),
  membershipPlan: membershipPlanSchema,
  expiresAt: z.iso.datetime(),
});

export const companyCreationCodeResponseSchema = z.object({
  code: companyCreationCodeSchema,
});

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
  subscriptionCount: z.number().int().nonnegative(),
  availableSubscriptions: z.number().int().nonnegative(),
  eligibleForSubscription: z.boolean(),
  membershipPlan: membershipPlanSchema.nullable(),
  membershipActivatedAt: z.iso.datetime().nullable(),
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

export const platformUserMembershipUpdateRequestSchema = z.object({
  membershipPlan: membershipPlanSchema,
});

export const platformUserMembershipUpdateResponseSchema = z.object({
  membershipPlan: membershipPlanSchema,
  activatedAt: z.iso.datetime(),
});

export const platformSubscriptionStatusSchema = z.enum([
  "active",
  "suspended",
  "expired",
  "cancelled",
]);

export const platformSubscriptionBillingCycleSchema = z.enum(["monthly", "yearly"]);

export const platformSubscriptionSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  ownerDisplayName: z.string().min(1),
  ownerEmail: z.email(),
  membershipPlan: membershipPlanSchema,
  status: platformSubscriptionStatusSchema,
  billingCycle: platformSubscriptionBillingCycleSchema,
  amountCop: z.number().int().nonnegative(),
  monthlyEquivalentCop: z.number().int().nonnegative(),
  currentPeriodStart: z.iso.date(),
  currentPeriodEnd: z.iso.date(),
  autoRenew: z.boolean(),
  internalNotes: z.string().nullable(),
  consumedAt: z.iso.datetime().nullable(),
  tenantId: z.uuid().nullable(),
  tenantName: z.string().nullable(),
  tenantSlug: z.string().nullable(),
  additionalEmployeeSeats: z.number().int().nonnegative(),
  isAvailable: z.boolean(),
  activatedAt: z.iso.datetime(),
  deactivatedAt: z.iso.datetime().nullable(),
  updatedAt: z.iso.datetime(),
});

export const platformSubscriptionDirectoryQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  status: platformSubscriptionStatusSchema.optional(),
  plan: membershipPlanSchema.optional(),
  assignment: z.enum(["available", "assigned"]).optional(),
  ...pageQueryFields,
});

export const platformSubscriptionDirectorySchema = z.object({
  metrics: z.object({
    total: z.number().int().nonnegative(),
    active: z.number().int().nonnegative(),
    available: z.number().int().nonnegative(),
    assigned: z.number().int().nonnegative(),
    monthlyRecurringRevenueCop: z.number().int().nonnegative(),
    expiringWithinSevenDays: z.number().int().nonnegative(),
  }),
  subscriptions: z.array(platformSubscriptionSchema),
  pagination: platformPaginationSchema,
});

const subscriptionWriteFields = {
  membershipPlan: membershipPlanSchema,
  billingCycle: platformSubscriptionBillingCycleSchema,
  amountCop: z.number().int().min(0).max(1_000_000_000_000),
  currentPeriodStart: z.iso.date(),
  currentPeriodEnd: z.iso.date(),
  autoRenew: z.boolean(),
  internalNotes: z.string().trim().max(500).nullable().default(null),
};

export const platformSubscriptionCreateRequestSchema = z
  .object({
    userId: z.uuid(),
    ...subscriptionWriteFields,
  })
  .refine((value) => value.currentPeriodEnd >= value.currentPeriodStart, {
    message: "La fecha final debe ser igual o posterior a la fecha inicial.",
    path: ["currentPeriodEnd"],
  });

export const platformSubscriptionUpdateRequestSchema = z
  .object({
    ...subscriptionWriteFields,
    status: platformSubscriptionStatusSchema,
  })
  .refine((value) => value.currentPeriodEnd >= value.currentPeriodStart, {
    message: "La fecha final debe ser igual o posterior a la fecha inicial.",
    path: ["currentPeriodEnd"],
  });

export const platformSubscriptionResponseSchema = z.object({
  subscription: platformSubscriptionSchema,
});

export const platformOwnerCreatedResponseSchema = z.object({
  user: platformUserSchema,
  temporaryPassword: z.string().min(12),
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
  logoObjectKey: z.string().nullable(),
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
  phone: z.string().min(1).max(30).nullable(),
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
    /** Operational credit counters; they never represent accounting balances. */
    activeCredits: z.number().int().nonnegative().optional(),
    creditApplicationsInReview: z.number().int().nonnegative().optional(),
    overdueInstallments: z.number().int().nonnegative().optional(),
    dueTodayCredits: z.number().int().nonnegative().optional(),
    postponedCollections: z.number().int().nonnegative().optional(),
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

export const tenantMemberCreateRequestSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9._-]{2,31}$/),
  displayName: z.string().trim().min(2).max(160),
  phone: z.string().trim().min(7).max(30),
  password: z.string().min(12).max(256),
  role: z.enum(["supervisor", "collector"]),
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

export const verificationNetworkPurposeSchema = z.enum([
  "credit_evaluation",
  "portfolio_management",
  "customer_request",
]);

const verificationIdentityFields = {
  country: z.string().trim().length(2).toUpperCase(),
  documentType: z.string().trim().min(2).max(30),
  documentNumber: z.string().trim().min(4).max(32),
};

export const verificationNetworkConsentRequestSchema = z.object({
  ...verificationIdentityFields,
  purpose: verificationNetworkPurposeSchema,
  policyVersion: z.string().trim().min(1).max(40),
  evidenceRef: z.string().trim().min(1).max(240),
  expiresAt: z.iso.datetime(),
});

export const verificationNetworkConsentSchema = z.object({
  id: z.uuid(),
  expiresAt: z.iso.datetime(),
  policyVersion: z.string().min(1),
  purpose: verificationNetworkPurposeSchema,
  consentToken: z.string().min(40),
});

export const verificationNetworkQueryRequestSchema = z.object({
  ...verificationIdentityFields,
  consentToken: z.string().min(40).max(120),
  purpose: verificationNetworkPurposeSchema,
});

export const verificationNetworkQueryResponseSchema = z.object({
  result: z.enum(["not_found", "no_observation", "reported", "disputed", "no_consent"]),
  categories: z.array(z.enum(["late_payment", "payment_default"])),
  activeObservations: z.number().int().nonnegative(),
  lastUpdatedAt: z.iso.datetime().nullable(),
  correctionAvailable: z.boolean(),
});

export const verificationNetworkAssertionRequestSchema = z.object({
  ...verificationIdentityFields,
  consentToken: z.string().min(40).max(120),
  category: z.enum(["late_payment", "payment_default"]),
  observedFrom: z.iso.datetime(),
  observedTo: z.iso.datetime().nullable(),
  evidenceRef: z.string().trim().min(1).max(240),
  expiresAt: z.iso.datetime(),
});

export const verificationNetworkAssertionResponseSchema = z.object({
  id: z.uuid(),
  category: z.enum(["late_payment", "payment_default"]),
  status: z.literal("active"),
  expiresAt: z.iso.datetime(),
});

export const verificationNetworkCorrectionRequestSchema = z.object({
  ...verificationIdentityFields,
  consentToken: z.string().min(40).max(120),
  assertionId: z.uuid().nullable(),
  message: z.string().trim().min(10).max(1000),
});

export const verificationNetworkCorrectionResponseSchema = z.object({
  id: z.uuid(),
  status: z.literal("open"),
});

export const tenantMemberProfileRequestSchema = z
  .object({
    country: z.string().trim().length(2).toUpperCase().nullable().optional().default(null),
    documentType: z.string().trim().min(2).max(30).nullable().optional().default(null),
    documentNumber: z.string().trim().min(4).max(32).nullable().optional().default(null),
    phone: z.string().trim().min(7).max(30).nullable(),
    homeAddress: z.string().trim().min(3).max(240).nullable(),
    workAddress: z.string().trim().min(3).max(240).nullable(),
    profilePhotoObjectKey: z.string().trim().min(1).max(500).nullable(),
    bloodType: z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]).nullable(),
    bloodTypeConsentVersion: z.string().trim().min(1).max(40).nullable(),
    emergencyContacts: z
      .array(
        z.object({
          fullName: z.string().trim().min(2).max(120),
          relationship: z.string().trim().min(2).max(80),
          phone: z.string().trim().min(7).max(30),
        }),
      )
      .max(2),
  })
  .superRefine((value, context) => {
    const identityValues = [value.country, value.documentType, value.documentNumber];
    const hasAnyIdentityValue = identityValues.some((item) => item !== null);
    const hasCompleteIdentity = identityValues.every((item) => item !== null);
    if (hasAnyIdentityValue && !hasCompleteIdentity) {
      context.addIssue({
        code: "custom",
        path: ["documentNumber"],
        message: "Completa país, tipo y número del documento.",
      });
    }
    if (value.bloodType && !value.bloodTypeConsentVersion) {
      context.addIssue({
        code: "custom",
        path: ["bloodTypeConsentVersion"],
        message: "El consentimiento del tipo de sangre es obligatorio.",
      });
    }
    if (!value.bloodType && value.bloodTypeConsentVersion) {
      context.addIssue({
        code: "custom",
        path: ["bloodTypeConsentVersion"],
        message: "No se puede registrar consentimiento sin tipo de sangre.",
      });
    }
  });

export const tenantMemberEmergencyContactSchema = z.object({
  id: z.uuid(),
  fullName: z.string().min(2),
  relationship: z.string().min(2),
  phone: z.string().min(7),
});

export const tenantMemberProfileSchema = z.object({
  userId: z.uuid(),
  country: z.string().length(2),
  documentType: z.string().nullable(),
  documentLast4: z.string().nullable(),
  documentVerificationState: z.enum(["manual_pending", "reviewed", "rejected"]),
  identityFrontObjectKey: z.string().nullable(),
  identityBackObjectKey: z.string().nullable(),
  phone: z.string().nullable(),
  homeAddress: z.string().nullable(),
  workAddress: z.string().nullable(),
  profilePhotoObjectKey: z.string().nullable(),
  bloodType: z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]).nullable(),
  bloodTypeConsentVersion: z.string().nullable(),
  bloodTypeConsentedAt: z.iso.datetime().nullable(),
  emergencyContacts: z.array(tenantMemberEmergencyContactSchema).max(2),
});

export const tenantMemberProfileResponseSchema = z.object({
  profile: tenantMemberProfileSchema,
});

export const routeStatusSchema = z.enum(["draft", "active", "archived"]);
export const routeAddressKindSchema = z.enum(["home", "work"]);
export const routeStatusUpdateRequestSchema = z.object({
  status: z.enum(["active", "archived"]),
});
export const routeAssignmentUpdateRequestSchema = z.object({
  collectorId: z.uuid().nullable(),
});
export const routeCreateRequestSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(240).nullable(),
  branchId: z.uuid().nullable(),
});
export const routeStopCreateRequestSchema = z.object({
  borrowerId: z.uuid(),
  addressKind: routeAddressKindSchema,
  position: z.number().int().positive(),
});
export const routeStopReorderRequestSchema = z.object({
  stopIds: z.array(z.uuid()).min(1).max(500),
});
export const routeStopVisitStatusSchema = z.enum(["pending", "visited", "not_home"]);
export const routeStopVisitRequestSchema = z.object({
  status: routeStopVisitStatusSchema,
  notes: z.string().trim().max(500).nullable().optional(),
});
export const routeStopOptimizeRequestSchema = z.object({
  startStopId: z.uuid().nullable().optional(),
});
export const routeStopSchema = z.object({
  id: z.uuid(),
  borrowerId: z.uuid(),
  borrowerName: z.string().min(2),
  addressKind: routeAddressKindSchema,
  address: z.string().min(3),
  position: z.number().int().positive(),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  visitStatus: routeStopVisitStatusSchema,
  visitedAt: z.iso.datetime().nullable(),
  visitNotes: z.string().nullable(),
});
export const routeSchema = z.object({
  id: z.uuid(),
  name: z.string().min(2),
  description: z.string().nullable(),
  status: routeStatusSchema,
  serviceDate: z.iso.date().nullable(),
  generationMode: z.enum(["manual", "automatic"]),
  branchId: z.uuid().nullable(),
  branchName: z.string().nullable(),
  assignedCollectorId: z.uuid().nullable(),
  assignedCollectorName: z.string().nullable(),
  stops: z.array(routeStopSchema).max(500),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const routeDirectorySchema = z.object({ routes: z.array(routeSchema) });
export const routeResponseSchema = z.object({ route: routeSchema });

export const loanProductStatusSchema = z.enum(["draft", "under_review", "approved", "retired"]);
export const loanProductFrequencySchema = z.enum(["daily", "weekly", "fortnightly", "monthly"]);
export const loanProductRateBasisSchema = z.enum([
  "flat_total",
  "periodic_simple",
  "effective_annual",
]);
export const loanProductComplianceStatusSchema = z.enum(["pending", "approved", "expired"]);
const decimalAmountSchema = z.string().regex(/^\d{1,12}(?:\.\d{1,2})?$/, "Monto decimal inválido.");
const decimalRateSchema = z.string().regex(/^\d{1,4}(?:\.\d{1,8})?$/, "Tasa decimal inválida.");
const wholeRateSchema = z.string().regex(/^\d{1,4}$/, "El porcentaje debe ser un número entero.");

export const loanProductCreateRequestSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    principalMin: decimalAmountSchema,
    principalMax: decimalAmountSchema,
    termCount: z.number().int().min(1).max(365),
    paymentFrequency: loanProductFrequencySchema,
    rateBasis: loanProductRateBasisSchema,
    nominalRate: wholeRateSchema,
    documentationFeeRate: wholeRateSchema,
    complianceSourceRef: z.string().trim().min(3).max(240).nullable(),
  })
  .superRefine((value, context) => {
    if (Number(value.principalMax) < Number(value.principalMin)) {
      context.addIssue({
        code: "custom",
        path: ["principalMax"],
        message: "El máximo debe ser mayor o igual al mínimo.",
      });
    }
    const allowedTerms: Record<"daily" | "weekly" | "fortnightly" | "monthly", number[]> = {
      daily: [30, 35],
      weekly: [4, 5],
      fortnightly: [2],
      monthly: [1],
    };
    if (!allowedTerms[value.paymentFrequency].includes(value.termCount)) {
      context.addIssue({
        code: "custom",
        path: ["termCount"],
        message: "El plazo debe ser de un mes o de cinco semanas según la frecuencia.",
      });
    }
  });

export const loanProductUpdateRequestSchema = loanProductCreateRequestSchema;

export const loanProductSchema = z.object({
  id: z.uuid(),
  name: z.string().min(2),
  status: loanProductStatusSchema,
  currency: z.literal("COP"),
  principalMin: decimalAmountSchema,
  principalMax: decimalAmountSchema,
  termCount: z.number().int().positive(),
  paymentFrequency: loanProductFrequencySchema,
  rateBasis: loanProductRateBasisSchema,
  nominalRate: decimalRateSchema,
  documentationFeeRate: decimalRateSchema,
  complianceStatus: loanProductComplianceStatusSchema,
  complianceSourceRef: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const loanProductDirectorySchema = z.object({
  products: z.array(loanProductSchema),
});
export const loanProductResponseSchema = z.object({ product: loanProductSchema });

export const financialSchedulePreviewRequestSchema = z.object({
  principal: decimalAmountSchema,
  termCount: z.number().int().min(1).max(365),
  paymentFrequency: loanProductFrequencySchema.optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe usar AAAA-MM-DD."),
});
export const financialSchedulePeriodSchema = z.object({
  period: z.number().int().positive(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  principal: decimalAmountSchema,
  interest: decimalAmountSchema,
  installment: decimalAmountSchema,
  balance: decimalAmountSchema,
});
export const financialSchedulePreviewSchema = z.object({
  currency: z.literal("COP"),
  principal: decimalAmountSchema,
  documentationFee: decimalAmountSchema,
  netDisbursement: decimalAmountSchema,
  interestTotal: decimalAmountSchema,
  scheduledTotal: decimalAmountSchema,
  totalCost: decimalAmountSchema,
  periodicRate: decimalRateSchema,
  periods: z.array(financialSchedulePeriodSchema).min(1).max(365),
});
export const financialSchedulePreviewResponseSchema = z.object({
  preview: financialSchedulePreviewSchema,
});

export const loanApplicationStatusSchema = z.enum([
  "draft",
  "submitted",
  "under_review",
  "approved",
  "active",
  "paid",
  "rejected",
  "cancelled",
]);
export const loanApplicationCreateRequestSchema = z
  .object({
    borrowerId: z.uuid(),
    loanProductId: z.uuid(),
    requestedPrincipal: decimalAmountSchema,
    paymentFrequency: loanProductFrequencySchema,
    requestedTermCount: z.number().int().min(1).max(365),
    purpose: z.string().trim().min(3).max(240).nullable(),
  })
  .superRefine((value, context) => {
    const allowedTerms: Record<"daily" | "weekly" | "fortnightly" | "monthly", number[]> = {
      daily: [30, 35],
      weekly: [4, 5],
      fortnightly: [2],
      monthly: [1],
    };
    if (!allowedTerms[value.paymentFrequency].includes(value.requestedTermCount)) {
      context.addIssue({
        code: "custom",
        path: ["requestedTermCount"],
        message: "El plazo debe ser de un mes o de cinco semanas según la frecuencia.",
      });
    }
  });
export const loanApplicationSchema = z.object({
  id: z.uuid(),
  borrowerId: z.uuid(),
  borrowerName: z.string().min(2),
  loanProductId: z.uuid(),
  loanProductName: z.string().min(2),
  requestedPrincipal: decimalAmountSchema,
  paymentFrequency: loanProductFrequencySchema,
  requestedTermCount: z.number().int().positive(),
  rateBasis: loanProductRateBasisSchema,
  nominalRate: decimalRateSchema,
  documentationFeeRate: decimalRateSchema,
  interestTotal: decimalAmountSchema,
  scheduledTotal: decimalAmountSchema,
  installmentAmount: decimalAmountSchema,
  nextPaymentAmount: decimalAmountSchema.optional(),
  remainingAmount: decimalAmountSchema.optional(),
  paidInstallments: z.number().int().nonnegative().default(0),
  paidAmount: decimalAmountSchema.optional(),
  paidPercentage: z.number().min(0).max(100).optional(),
  renewalEligible: z.boolean().optional(),
  renewalRequiredPercentage: z.literal(40).optional(),
  /** Operational projection only; it is not a posted financial balance. */
  nextDueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  overdueInstallments: z.number().int().nonnegative().optional(),
  purpose: z.string().nullable(),
  status: loanApplicationStatusSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const loanApplicationDirectorySchema = z.object({
  applications: z.array(loanApplicationSchema),
});
export const loanApplicationResponseSchema = z.object({ application: loanApplicationSchema });

export const loanPaymentCreateRequestSchema = z.object({
  installmentNumber: z.number().int().min(1).max(365),
  amount: decimalAmountSchema,
  paymentMethod: z.enum(["cash", "transfer"]),
});
export const loanPaymentSchema = z.object({
  id: z.uuid(),
  installmentNumber: z.number().int().positive(),
  amount: decimalAmountSchema,
  paymentMethod: z.enum(["cash", "transfer"]),
  paidAt: z.iso.datetime(),
  receiptNumber: z.string().min(8),
  remainingAmount: decimalAmountSchema,
  recordedByName: z.string().min(2),
  hasTransferProof: z.boolean(),
  receiptUrl: z.url(),
});
export const loanPaymentDirectorySchema = z.object({ payments: z.array(loanPaymentSchema) });

const publicCompanySchema = z.object({
  name: z.string().min(2),
  phone: z.string().nullable(),
  address: z.string().nullable().optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});
const publicBorrowerSummarySchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(7),
  whatsappPhone: z.string().nullable(),
  documentType: z.string().min(2).nullable(),
  documentLast4: z.string().min(2).max(4).nullable(),
});
export const borrowerPortalProfileSchema = z.object({
  company: publicCompanySchema,
  borrower: publicBorrowerSummarySchema.extend({ id: z.uuid() }),
  credits: z.array(
    z.object({
      id: z.uuid(),
      productName: z.string().min(2),
      requestedPrincipal: decimalAmountSchema,
      scheduledTotal: decimalAmountSchema,
      remainingAmount: decimalAmountSchema,
      paymentFrequency: loanProductFrequencySchema,
      requestedTermCount: z.number().int().positive(),
      paidInstallments: z.number().int().nonnegative(),
      nominalRate: decimalRateSchema,
      status: z.enum(["active", "paid"]),
      nextDueDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable(),
      overdueInstallments: z.number().int().nonnegative(),
    }),
  ),
  payments: z.array(loanPaymentSchema.omit({ recordedByName: true, hasTransferProof: true })),
});
export const borrowerPortalLinkSchema = z.object({
  url: z.url(),
  active: z.boolean(),
});
export const paymentReceiptSchema = z.object({
  company: publicCompanySchema,
  borrower: publicBorrowerSummarySchema,
  payment: loanPaymentSchema.omit({ receiptUrl: true, hasTransferProof: true }),
  credit: z.object({
    productName: z.string().min(2),
    requestedPrincipal: decimalAmountSchema,
    requestedTermCount: z.number().int().positive(),
    paymentFrequency: loanProductFrequencySchema,
    nominalRate: decimalRateSchema,
  }),
});
export const loanRenewalRequestSchema = z.object({
  excessAmount: decimalAmountSchema,
});

export const loanAnalyticsPresetSchema = z.enum(["day", "week", "month", "custom"]);
export const loanAnalyticsQuerySchema = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe usar AAAA-MM-DD."),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe usar AAAA-MM-DD."),
    preset: loanAnalyticsPresetSchema.default("custom"),
  })
  .refine((value) => value.from <= value.to, {
    message: "La fecha inicial debe ser anterior o igual a la fecha final.",
  });
export const loanAnalyticsSchema = z.object({
  period: z.object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    preset: loanAnalyticsPresetSchema,
  }),
  metrics: z.object({
    activePrincipalOutstanding: decimalAmountSchema,
    activeInterestOutstanding: decimalAmountSchema,
    approvedPrincipal: decimalAmountSchema,
    collectedAmount: decimalAmountSchema,
    collectedInterest: decimalAmountSchema,
    weightedAverageNominalRate: decimalRateSchema,
    renewalCount: z.number().int().nonnegative(),
    activeCreditCount: z.number().int().nonnegative(),
  }),
  renewalsByMember: z.array(
    z.object({
      userId: z.uuid(),
      displayName: z.string().min(1),
      role: z.enum(["supervisor", "collector"]),
      total: z.number().int().nonnegative(),
      pending: z.number().int().nonnegative(),
      activated: z.number().int().nonnegative(),
    }),
  ),
});
export const loanAnalyticsResponseSchema = z.object({ analytics: loanAnalyticsSchema });

export const borrowerDocumentSideSchema = z.enum(["front", "back"]);
export const borrowerDocumentSchema = z.object({
  id: z.uuid(),
  category: z.enum(["identity", "profile_photo"]),
  side: borrowerDocumentSideSchema.nullable(),
  objectKey: z.string().min(1),
  mediaType: z.string().min(3),
  sizeBytes: z.number().int().positive(),
  sha256: z.string().length(64),
  scanStatus: z.enum(["pending", "accepted", "rejected"]),
  createdAt: z.iso.datetime(),
});

export const borrowerEmergencyContactInputSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  relationship: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(7).max(30),
});

export const borrowerDocumentInputSchema = z.object({
  category: z.enum(["identity", "profile_photo"]),
  side: borrowerDocumentSideSchema.nullable(),
  objectKey: z.string().trim().min(1).max(500),
  mediaType: z.string().trim().min(3).max(120),
  sizeBytes: z.number().int().positive().max(10_485_760),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i),
});

export const borrowerRegistrationTypeSchema = z.enum(["new", "legacy"]);

export const borrowerCreateRequestSchema = z
  .object({
    fullName: z.string().trim().min(2).max(160),
    registrationType: borrowerRegistrationTypeSchema.default("new"),
    /** Identity data may be entered without attaching a document image. */
    country: z.string().trim().length(2).toUpperCase().nullable().optional().default(null),
    documentType: z.string().trim().min(2).max(30).nullable().optional().default(null),
    documentNumber: z.string().trim().min(4).max(32).nullable().optional().default(null),
    phone: z.string().trim().min(7).max(30),
    whatsappPhone: z.string().trim().min(7).max(30).nullable().optional(),
    homeAddress: z.string().trim().min(3).max(240),
    workAddress: z.string().trim().min(3).max(240),
    /** The operator must verify both addresses with the client before saving the dossier. */
    homeAddressConfirmed: z.literal(true),
    workAddressConfirmed: z.literal(true),
    profilePhotoObjectKey: z.string().trim().min(1).max(500).nullable(),
    consentVersion: z.string().trim().min(1).max(40),
    consentEvidenceRef: z.string().trim().min(1).max(240),
    emergencyContacts: z.array(borrowerEmergencyContactInputSchema).max(2),
    documents: z.array(borrowerDocumentInputSchema).max(3),
  })
  .superRefine((value, context) => {
    const identityFields = [value.country, value.documentType, value.documentNumber];
    const hasSomeIdentityData = identityFields.some(
      (field) => field !== null && field !== undefined && field !== "",
    );
    const hasCompleteIdentityData = identityFields.every(
      (field) => field !== null && field !== undefined && field !== "",
    );
    if (hasSomeIdentityData && !hasCompleteIdentityData) {
      context.addIssue({
        code: "custom",
        path: ["documentNumber"],
        message:
          "Completa país, tipo y número del documento, o déjalos vacíos para registrarlo manualmente.",
      });
    }
    if (value.registrationType === "new" && value.emergencyContacts.length < 1) {
      context.addIssue({
        code: "custom",
        path: ["emergencyContacts"],
        message: "Un cliente nuevo requiere al menos un contacto de emergencia.",
      });
    }
    const identityDocuments = value.documents.filter(
      (document) => document.category === "identity",
    );
    const sides = new Set(identityDocuments.map((document) => document.side));
    if (identityDocuments.length > 0 && !sides.has("front")) {
      context.addIssue({
        code: "custom",
        path: ["documents"],
        message: "Los documentos de identidad deben incluir el frente.",
      });
    }
    if (
      value.profilePhotoObjectKey &&
      !value.documents.some((document) => document.category === "profile_photo")
    ) {
      context.addIssue({
        code: "custom",
        path: ["documents"],
        message: "La selfie del cliente debe registrarse también como documento privado.",
      });
    }
  });

export const borrowerIdentitySchema = z.object({
  country: z.string().length(2).nullable(),
  documentType: z.string().min(2).nullable(),
  documentLast4: z.string().min(2).max(4).nullable(),
  verificationState: z.enum(["manual_pending", "reviewed", "rejected"]),
});

export const borrowerAddressStatusSchema = z.enum(["pending", "confirmed"]);
export const borrowerAddressLocationSchema = z.object({
  status: z.enum(["pending", "ready", "failed"]),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  formattedAddress: z.string().nullable(),
  provider: z.string().nullable(),
  precision: z.string().nullable(),
  errorCode: z.string().nullable(),
  geocodedAt: z.iso.datetime().nullable(),
});
export const borrowerAddressGeocodeRequestSchema = z
  .object({
    addressKind: z.enum(["home", "work"]),
    /** Optional device coordinates captured explicitly by the field operator. */
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
  })
  .superRefine((value, context) => {
    if ((value.latitude === undefined) !== (value.longitude === undefined)) {
      context.addIssue({
        code: "custom",
        path: ["latitude"],
        message: "La ubicación debe incluir latitud y longitud.",
      });
    }
  });
/**
 * Corrects both operational addresses in one atomic action. Requiring both
 * confirmations prevents a stale address from being silently left behind
 * when a field operator corrects a client's record.
 */
export const borrowerAddressUpdateRequestSchema = z.object({
  homeAddress: z.string().trim().min(3).max(240),
  workAddress: z.string().trim().min(3).max(240),
  /** Corrections are accepted only after both addresses are confirmed again. */
  homeAddressConfirmed: z.literal(true),
  workAddressConfirmed: z.literal(true),
});
export const borrowerAddressLocationResponseSchema = z.object({
  location: borrowerAddressLocationSchema,
});

export const borrowerSchema = z.object({
  id: z.uuid(),
  fullName: z.string().min(2),
  registrationType: borrowerRegistrationTypeSchema.optional(),
  status: z.enum(["active", "archived"]),
  phone: z.string().min(7),
  whatsappPhone: z.string().min(7).nullable().optional(),
  homeAddress: z.string().min(3),
  workAddress: z.string().min(3),
  homeAddressStatus: borrowerAddressStatusSchema,
  workAddressStatus: borrowerAddressStatusSchema,
  addressLocations: z.object({
    home: borrowerAddressLocationSchema,
    work: borrowerAddressLocationSchema,
  }),
  profilePhotoObjectKey: z.string().nullable(),
  assignedCollectorId: z.uuid().nullable(),
  assignedCollectorName: z.string().nullable(),
  consentVersion: z.string().min(1),
  identity: borrowerIdentitySchema,
  emergencyContacts: z.array(borrowerEmergencyContactInputSchema.extend({ id: z.uuid() })).max(2),
  documents: z.array(borrowerDocumentSchema).max(3),
  createdAt: z.iso.datetime(),
});

export const borrowerAssignmentUpdateRequestSchema = z.object({
  collectorId: z.uuid().nullable(),
});

export const borrowerCollectionReportReasonSchema = z.enum([
  "payment_postponed",
  "refuses_payment",
  "unreachable",
]);
export const borrowerCollectionReportCreateRequestSchema = z
  .object({
    reason: borrowerCollectionReportReasonSchema,
    followUpDate: z.iso.date().nullable().optional().default(null),
    notes: z.string().trim().min(3).max(500).nullable().optional().default(null),
  })
  .superRefine((value, context) => {
    if (value.reason === "payment_postponed" && !value.followUpDate) {
      context.addIssue({
        code: "custom",
        path: ["followUpDate"],
        message: "Selecciona la nueva fecha de cobro.",
      });
    }
    if (value.reason !== "payment_postponed" && value.followUpDate) {
      context.addIssue({
        code: "custom",
        path: ["followUpDate"],
        message: "La fecha de seguimiento solo aplica a cobros aplazados.",
      });
    }
  });
export const borrowerCollectionReportSchema = z.object({
  id: z.uuid(),
  borrowerId: z.uuid(),
  reason: borrowerCollectionReportReasonSchema,
  followUpDate: z.iso.date().nullable(),
  notes: z.string().nullable(),
  reportedByName: z.string().min(2),
  createdAt: z.iso.datetime(),
});
export const borrowerCollectionReportResponseSchema = z.object({
  report: borrowerCollectionReportSchema,
});

export const borrowerResponseSchema = z.object({ borrower: borrowerSchema });
export const borrowerDocumentResponseSchema = z.object({ document: borrowerDocumentSchema });
export const borrowerOcrExtractionStatusSchema = z.enum([
  "pending",
  "processing",
  "ready",
  "confirmed",
  "rejected",
  "failed",
]);
export const identityDocumentFieldsSchema = z.object({
  firstNames: z.string().min(1).max(160).nullable(),
  lastNames: z.string().min(1).max(160).nullable(),
  fullName: z.string().min(2).max(160).nullable(),
  documentNumber: z.string().min(4).max(32).nullable(),
  country: z.string().length(2).nullable(),
  documentType: z.string().min(2).max(30).nullable(),
  nationality: z.string().min(1).max(80).nullable(),
  birthDate: z.iso.date().nullable(),
  birthPlace: z.string().min(1).max(160).nullable(),
  sex: z.string().min(1).max(30).nullable(),
  height: z.string().min(1).max(30).nullable(),
  bloodType: z.string().min(1).max(30).nullable(),
  issueDate: z.iso.date().nullable(),
  issuePlace: z.string().min(1).max(160).nullable(),
  expirationDate: z.iso.date().nullable(),
  serialNumber: z.string().min(1).max(120).nullable(),
  mrzLines: z.array(z.string().min(1).max(90)).max(3),
  barcodeData: z.string().min(1).max(2_000).nullable(),
});
export const borrowerOcrFieldsSchema = identityDocumentFieldsSchema;
export const identityDocumentExtractionSchema = z.object({
  fields: identityDocumentFieldsSchema,
  confidence: z.number().min(0).max(1),
  warnings: z.array(z.string().min(1).max(240)).max(12),
  sources: z.object({ front: z.boolean(), back: z.boolean() }),
});
export const identityDocumentExtractionResponseSchema = z.object({
  extraction: identityDocumentExtractionSchema,
});
export const borrowerOcrExtractionSchema = z.object({
  id: z.uuid(),
  documentId: z.uuid(),
  category: z.enum(["identity", "profile_photo"]),
  side: borrowerDocumentSideSchema.nullable(),
  status: borrowerOcrExtractionStatusSchema,
  fields: borrowerOcrFieldsSchema.nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  modelName: z.string().min(1).max(100),
  errorCode: z.string().min(1).max(120).nullable(),
  reviewedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const borrowerOcrResponseSchema = z.object({
  extractions: z.array(borrowerOcrExtractionSchema),
});
export const borrowerOcrConfirmRequestSchema = z
  .object({
    extractionId: z.uuid(),
    fullName: z.string().trim().min(2).max(160).nullable().optional(),
    documentNumber: z.string().trim().min(4).max(32).nullable().optional(),
  })
  .refine((value) => Boolean(value.fullName || value.documentNumber), {
    message: "Confirma al menos un dato extraído.",
  });
export const borrowerOcrConfirmResponseSchema = z.object({
  borrower: borrowerSchema,
  extraction: borrowerOcrExtractionSchema,
});
export const borrowerReviewRequestSchema = z
  .object({
    decision: z.enum(["reviewed", "rejected"]),
    notes: z.string().trim().min(10).max(500),
    legalNameConfirmed: z.boolean(),
    identityFrontConfirmed: z.boolean(),
    identityBackConfirmed: z.boolean(),
    profilePhotoConfirmed: z.boolean(),
  })
  .superRefine((value, context) => {
    if (value.decision === "reviewed" && !value.legalNameConfirmed) {
      context.addIssue({
        code: "custom",
        path: ["decision"],
        message: "La revisión aprobada debe confirmar el nombre del cliente.",
      });
    }
  });
export const borrowerReviewResponseSchema = z.object({ borrower: borrowerSchema });
export const borrowerDirectoryQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export const borrowerDirectorySchema = z.object({
  borrowers: z.array(borrowerSchema),
  pagination: z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().positive(),
  }),
  identitySummary: z
    .object({
      pending: z.number().int().nonnegative(),
      reviewed: z.number().int().nonnegative(),
      rejected: z.number().int().nonnegative(),
    })
    .default({ pending: 0, reviewed: 0, rejected: 0 }),
  borrowerSummary: z
    .object({
      active: z.number().int().nonnegative(),
      archived: z.number().int().nonnegative(),
    })
    .default({ active: 0, archived: 0 }),
});

export const sharedClientVerificationRequestSchema = z.object({
  documentNumber: z.string().trim().min(4).max(32),
  // A query may only be sent after the operator confirms that the client
  // authorized this lookup. Keeping this at the contract boundary prevents
  // web, mobile, and future clients from silently bypassing the consent step.
  consentConfirmed: z.literal(true),
});

export const sharedClientVerificationSchema = z.object({
  registered: z.boolean(),
  fullName: z.string().min(2).nullable(),
  activeCreditCount: z.number().int().nonnegative(),
  payerRating: z.enum(["good", "regular", "low", "no_data"]),
  negativeReport: z.boolean(),
  riskReportCount: z.number().int().nonnegative(),
  lastRiskReportedAt: z.iso.datetime().nullable(),
});

export const sharedClientVerificationResponseSchema = z.object({
  verification: sharedClientVerificationSchema,
});

export const verificationRiskCategorySchema = z.enum([
  "repeated_late_payment",
  "payment_default",
  "unreachable",
]);

export const verificationRiskEntryCreateRequestSchema = z.object({
  documentNumber: z.string().trim().min(4).max(32),
  category: verificationRiskCategorySchema,
  note: z.string().trim().min(10).max(500),
});

export const verificationRiskEntrySchema = z.object({
  id: z.uuid(),
  documentLast4: z.string().length(4),
  category: verificationRiskCategorySchema,
  note: z.string().min(10).max(500),
  status: z.enum(["active", "resolved", "expired"]),
  createdByName: z.string().min(1),
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  resolvedAt: z.iso.datetime().nullable(),
});

export const verificationRiskEntryResponseSchema = z.object({
  entry: verificationRiskEntrySchema,
});

export const verificationRiskDirectorySchema = z.object({
  entries: z.array(verificationRiskEntrySchema),
});

export type ServiceStatus = z.infer<typeof serviceStatusSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
export type TenantRole = z.infer<typeof tenantRoleSchema>;
export type TenantMembership = z.infer<typeof tenantMembershipSchema>;
export type CurrentUser = z.infer<typeof currentUserSchema>;
export type UserProfile = z.infer<typeof userProfileSchema>;
export type UserProfileUpdateRequest = z.infer<typeof userProfileUpdateRequestSchema>;
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
export type CreatePlatformOwnerRequest = z.infer<typeof createPlatformOwnerRequestSchema>;
export type CreateCompanyCreationCodeRequest = z.infer<
  typeof createCompanyCreationCodeRequestSchema
>;
export type CompanyCreationCode = z.infer<typeof companyCreationCodeSchema>;
export type OwnerSubscription = z.infer<typeof ownerSubscriptionSchema>;
export type OwnerSubscriptionSummary = z.infer<typeof ownerSubscriptionSummarySchema>;
export type PlatformOwnerCreatedResponse = z.infer<typeof platformOwnerCreatedResponseSchema>;
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
export type PlatformUserMembershipUpdateRequest = z.infer<
  typeof platformUserMembershipUpdateRequestSchema
>;
export type PlatformSubscriptionStatus = z.infer<typeof platformSubscriptionStatusSchema>;
export type PlatformSubscriptionBillingCycle = z.infer<
  typeof platformSubscriptionBillingCycleSchema
>;
export type PlatformSubscription = z.infer<typeof platformSubscriptionSchema>;
export type PlatformSubscriptionDirectory = z.infer<typeof platformSubscriptionDirectorySchema>;
export type PlatformSubscriptionCreateRequest = z.infer<
  typeof platformSubscriptionCreateRequestSchema
>;
export type PlatformSubscriptionUpdateRequest = z.infer<
  typeof platformSubscriptionUpdateRequestSchema
>;
export type PlatformSystemStatus = z.infer<typeof platformSystemStatusSchema>;
export type SupportAccessStatus = z.infer<typeof supportAccessStatusSchema>;
export type SupportAccessRecord = z.infer<typeof supportAccessRecordSchema>;
export type TenantOverview = z.infer<typeof tenantOverviewSchema>;
export type TenantSettingsUpdateRequest = z.infer<typeof tenantSettingsUpdateRequestSchema>;
export type CreateBranchRequest = z.infer<typeof createBranchRequestSchema>;
export type CreateTeamRequest = z.infer<typeof createTeamRequestSchema>;
export type OrganizationStatusUpdateRequest = z.infer<typeof organizationStatusUpdateRequestSchema>;
export type TenantMemberUpdateRequest = z.infer<typeof tenantMemberUpdateRequestSchema>;
export type TenantMemberCreateRequest = z.infer<typeof tenantMemberCreateRequestSchema>;
export type TenantInvitationRequest = z.infer<typeof tenantInvitationRequestSchema>;
export type MfaStatus = z.infer<typeof mfaStatusSchema>;
export type ReauthenticationRequest = z.infer<typeof reauthenticationRequestSchema>;
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;
export type VerificationNetworkPurpose = z.infer<typeof verificationNetworkPurposeSchema>;
export type VerificationNetworkConsentRequest = z.infer<
  typeof verificationNetworkConsentRequestSchema
>;
export type VerificationNetworkConsent = z.infer<typeof verificationNetworkConsentSchema>;
export type VerificationNetworkQueryRequest = z.infer<typeof verificationNetworkQueryRequestSchema>;
export type VerificationNetworkQueryResponse = z.infer<
  typeof verificationNetworkQueryResponseSchema
>;
export type VerificationNetworkAssertionRequest = z.infer<
  typeof verificationNetworkAssertionRequestSchema
>;
export type VerificationNetworkAssertionResponse = z.infer<
  typeof verificationNetworkAssertionResponseSchema
>;
export type VerificationNetworkCorrectionRequest = z.infer<
  typeof verificationNetworkCorrectionRequestSchema
>;
export type VerificationNetworkCorrectionResponse = z.infer<
  typeof verificationNetworkCorrectionResponseSchema
>;
export type TenantMemberProfileRequest = z.infer<typeof tenantMemberProfileRequestSchema>;
export type TenantMemberEmergencyContact = z.infer<typeof tenantMemberEmergencyContactSchema>;
export type TenantMemberProfile = z.infer<typeof tenantMemberProfileSchema>;
export type RouteStatus = z.infer<typeof routeStatusSchema>;
export type RouteAddressKind = z.infer<typeof routeAddressKindSchema>;
export type RouteStatusUpdateRequest = z.infer<typeof routeStatusUpdateRequestSchema>;
export type RouteAssignmentUpdateRequest = z.infer<typeof routeAssignmentUpdateRequestSchema>;
export type RouteCreateRequest = z.infer<typeof routeCreateRequestSchema>;
export type RouteStopCreateRequest = z.infer<typeof routeStopCreateRequestSchema>;
export type RouteStopReorderRequest = z.infer<typeof routeStopReorderRequestSchema>;
export type RouteStopVisitRequest = z.infer<typeof routeStopVisitRequestSchema>;
export type RouteStopOptimizeRequest = z.infer<typeof routeStopOptimizeRequestSchema>;
export type RouteStop = z.infer<typeof routeStopSchema>;
export type BorrowerAddressLocation = z.infer<typeof borrowerAddressLocationSchema>;
export type BorrowerAddressGeocodeRequest = z.infer<typeof borrowerAddressGeocodeRequestSchema>;
export type BorrowerAddressUpdateRequest = z.infer<typeof borrowerAddressUpdateRequestSchema>;
export type BorrowerAddressLocationResponse = z.infer<typeof borrowerAddressLocationResponseSchema>;
export type Route = z.infer<typeof routeSchema>;
export type RouteDirectory = z.infer<typeof routeDirectorySchema>;
export type LoanProductStatus = z.infer<typeof loanProductStatusSchema>;
export type LoanProductFrequency = z.infer<typeof loanProductFrequencySchema>;
export type LoanProductRateBasis = z.infer<typeof loanProductRateBasisSchema>;
export type LoanProductComplianceStatus = z.infer<typeof loanProductComplianceStatusSchema>;
export type LoanProductCreateRequest = z.infer<typeof loanProductCreateRequestSchema>;
export type LoanProductUpdateRequest = z.infer<typeof loanProductUpdateRequestSchema>;
export type LoanProduct = z.infer<typeof loanProductSchema>;
export type LoanProductDirectory = z.infer<typeof loanProductDirectorySchema>;
export type LoanApplicationStatus = z.infer<typeof loanApplicationStatusSchema>;
export type LoanApplicationCreateRequest = z.infer<typeof loanApplicationCreateRequestSchema>;
export type LoanApplication = z.infer<typeof loanApplicationSchema>;
export type LoanApplicationDirectory = z.infer<typeof loanApplicationDirectorySchema>;
export type LoanPaymentCreateRequest = z.infer<typeof loanPaymentCreateRequestSchema>;
export type LoanPayment = z.infer<typeof loanPaymentSchema>;
export type BorrowerPortalProfile = z.infer<typeof borrowerPortalProfileSchema>;
export type PaymentReceipt = z.infer<typeof paymentReceiptSchema>;
export type LoanRenewalRequest = z.infer<typeof loanRenewalRequestSchema>;
export type LoanAnalyticsPreset = z.infer<typeof loanAnalyticsPresetSchema>;
export type LoanAnalyticsQuery = z.infer<typeof loanAnalyticsQuerySchema>;
export type LoanAnalytics = z.infer<typeof loanAnalyticsSchema>;
export type FinancialSchedulePreviewRequest = z.infer<typeof financialSchedulePreviewRequestSchema>;
export type FinancialSchedulePeriod = z.infer<typeof financialSchedulePeriodSchema>;
export type FinancialSchedulePreview = z.infer<typeof financialSchedulePreviewSchema>;
export type BorrowerDocument = z.infer<typeof borrowerDocumentSchema>;
export type BorrowerCreateRequest = z.infer<typeof borrowerCreateRequestSchema>;
export type BorrowerAssignmentUpdateRequest = z.infer<typeof borrowerAssignmentUpdateRequestSchema>;
export type BorrowerCollectionReportReason = z.infer<typeof borrowerCollectionReportReasonSchema>;
export type BorrowerCollectionReportCreateRequest = z.infer<
  typeof borrowerCollectionReportCreateRequestSchema
>;
export type BorrowerCollectionReport = z.infer<typeof borrowerCollectionReportSchema>;
export type BorrowerReviewRequest = z.infer<typeof borrowerReviewRequestSchema>;
export type BorrowerDocumentResponse = z.infer<typeof borrowerDocumentResponseSchema>;
export type IdentityDocumentFields = z.infer<typeof identityDocumentFieldsSchema>;
export type IdentityDocumentExtraction = z.infer<typeof identityDocumentExtractionSchema>;
export type IdentityDocumentExtractionResponse = z.infer<
  typeof identityDocumentExtractionResponseSchema
>;
export type BorrowerOcrExtraction = z.infer<typeof borrowerOcrExtractionSchema>;
export type BorrowerOcrResponse = z.infer<typeof borrowerOcrResponseSchema>;
export type BorrowerOcrConfirmRequest = z.infer<typeof borrowerOcrConfirmRequestSchema>;
export type BorrowerOcrConfirmResponse = z.infer<typeof borrowerOcrConfirmResponseSchema>;
export type Borrower = z.infer<typeof borrowerSchema>;
export type BorrowerDirectory = z.infer<typeof borrowerDirectorySchema>;
export type SharedClientVerificationRequest = z.infer<typeof sharedClientVerificationRequestSchema>;
export type SharedClientVerification = z.infer<typeof sharedClientVerificationSchema>;
export type VerificationRiskCategory = z.infer<typeof verificationRiskCategorySchema>;
export type VerificationRiskEntryCreateRequest = z.infer<
  typeof verificationRiskEntryCreateRequestSchema
>;
export type VerificationRiskEntry = z.infer<typeof verificationRiskEntrySchema>;
