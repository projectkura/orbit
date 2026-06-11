import { z } from "zod"

export const ORBIT_EMAIL_VARIABLES = {
  firstName: { label: "First name", description: "User's first name" },
  lastName: { label: "Last name", description: "User's last name" },
  username: { label: "Username", description: "User's username" },
  email: { label: "Email", description: "User's email address" },
  workspaceName: {
    label: "Workspace name",
    description: "Name of the related workspace",
  },
  verificationCode: {
    label: "Verification code",
    description: "2FA verification code for sensitive actions",
  },
} as const

export type OrbitEmailVariableKey = keyof typeof ORBIT_EMAIL_VARIABLES

export const orbitEmailVariableKeys = Object.keys(
  ORBIT_EMAIL_VARIABLES
) as [OrbitEmailVariableKey, ...OrbitEmailVariableKey[]]

const orbitEmailVariableKeySchema = z.enum(orbitEmailVariableKeys)

export const EMAIL_EVENT_KEYS = ["workspaceCreated", "workspaceInvite", "workspaceDeletion"] as const
export type EmailEventKey = (typeof EMAIL_EVENT_KEYS)[number]

export const EMAIL_EVENT_DEFINITIONS: Record<
  EmailEventKey,
  {
    title: string
    description: string
    availableVariables: ReadonlyArray<OrbitEmailVariableKey>
  }
> = {
  workspaceCreated: {
    title: "Workspace created",
    description:
      "Sent to the workspace creator when a new workspace is provisioned.",
    availableVariables: [
      "firstName",
      "lastName",
      "username",
      "email",
      "workspaceName",
    ],
  },
  workspaceInvite: {
    title: "Workspace invite",
    description: "Sent when an admin invites a user to a workspace.",
    availableVariables: [
      "firstName",
      "lastName",
      "username",
      "email",
      "workspaceName",
    ],
  },
  workspaceDeletion: {
    title: "Workspace deletion",
    description: "Sent when a workspace owner requests deletion of a workspace.",
    availableVariables: [
      "firstName",
      "lastName",
      "username",
      "email",
      "workspaceName",
      "verificationCode",
    ],
  },
}

const emailEventConfigSchema = z.object({
  enabled: z.boolean().default(false),
  templateId: z.string().trim().max(120).default(""),
  fromAddress: z.string().trim().max(200).default(""),
  variableMappings: z
    .record(z.string(), orbitEmailVariableKeySchema)
    .default({}),
})

export type EmailEventConfig = z.infer<typeof emailEventConfigSchema>

const defaultEmailEventConfig: EmailEventConfig = {
  enabled: false,
  templateId: "",
  fromAddress: "",
  variableMappings: {},
}

const emailSettingsSchema = z.object({
  workspaceCreated: emailEventConfigSchema.default(defaultEmailEventConfig),
  workspaceInvite: emailEventConfigSchema.default(defaultEmailEventConfig),
  workspaceDeletion: emailEventConfigSchema.default(defaultEmailEventConfig),
})

export type EmailSettings = z.infer<typeof emailSettingsSchema>

export const RATE_LIMIT_DEFAULTS = {
  free: {
    apiRequestsPerMinute: 60,
    apiRequestsPerMonth: 10_000,
    networkEgressBytesPerMonth: null as number | null,
    storageBytesMax: null as number | null,
  },
  pro: {
    apiRequestsPerMinute: 600,
    apiRequestsPerMonth: 100_000,
    networkEgressBytesPerMonth: null as number | null,
    storageBytesMax: null as number | null,
  },
} as const

export const STORAGE_QUOTA_DEFAULTS = {
  free: 500 * 1024 * 1024,
  pro: 5 * 1024 * 1024 * 1024,
} as const

export const UPLOAD_SETTINGS_DEFAULTS = {
  uploadsEnabled: true,
  workspaceImageUploadsEnabled: true,
  maxPendingUploadsPerWorkspace: 3,
  intentTtlSeconds: 10 * 60,
  staleUploadGraceSeconds: 15 * 60,
} as const

const storageQuotaSchema = z.coerce
  .number()
  .int()
  .min(1 * 1024 * 1024, "Storage quota must be at least 1 MB.")
  .max(1024 * 1024 * 1024 * 1024, "Storage quota must be 1 TB or less.")

const rateLimitTierSchema = z.object({
  apiRequestsPerMinute: z.coerce
    .number()
    .int()
    .min(1)
    .max(1_000_000)
    .default(60),
  apiRequestsPerMonth: z.coerce
    .number()
    .int()
    .min(1)
    .max(1_000_000_000)
    .default(10_000),
  networkEgressBytesPerMonth: z.coerce
    .number()
    .int()
    .min(0)
    .max(1024 * 1024 * 1024 * 1024)
    .nullable()
    .default(null),
  storageBytesMax: z.coerce
    .number()
    .int()
    .min(0)
    .max(1024 * 1024 * 1024 * 1024)
    .nullable()
    .default(null),
})

export const rateLimitSettingsSchema = z.object({
  free: rateLimitTierSchema.default(RATE_LIMIT_DEFAULTS.free),
  pro: rateLimitTierSchema.default(RATE_LIMIT_DEFAULTS.pro),
})

export type RateLimitSettings = z.infer<typeof rateLimitSettingsSchema>

export const usageSettingsSchema = z.object({
  storage: z
    .object({
      freeBytes: storageQuotaSchema.default(STORAGE_QUOTA_DEFAULTS.free),
      proBytes: storageQuotaSchema.default(STORAGE_QUOTA_DEFAULTS.pro),
    })
    .default({
      freeBytes: STORAGE_QUOTA_DEFAULTS.free,
      proBytes: STORAGE_QUOTA_DEFAULTS.pro,
    }),
})

export type UsageSettings = z.infer<typeof usageSettingsSchema>

const pendingUploadCountSchema = z.coerce
  .number()
  .int()
  .min(1, "Pending upload cap must be at least 1.")
  .max(100, "Pending upload cap must be 100 or less.")

const uploadTtlSecondsSchema = z.coerce
  .number()
  .int()
  .min(60, "Upload TTL must be at least 60 seconds.")
  .max(24 * 60 * 60, "Upload TTL must be 24 hours or less.")

export const uploadSettingsSchema = z.object({
  uploadsEnabled: z
    .boolean()
    .default(UPLOAD_SETTINGS_DEFAULTS.uploadsEnabled),
  workspaceImageUploadsEnabled: z
    .boolean()
    .default(UPLOAD_SETTINGS_DEFAULTS.workspaceImageUploadsEnabled),
  maxPendingUploadsPerWorkspace: pendingUploadCountSchema.default(
    UPLOAD_SETTINGS_DEFAULTS.maxPendingUploadsPerWorkspace
  ),
  intentTtlSeconds: uploadTtlSecondsSchema.default(
    UPLOAD_SETTINGS_DEFAULTS.intentTtlSeconds
  ),
  staleUploadGraceSeconds: uploadTtlSecondsSchema.default(
    UPLOAD_SETTINGS_DEFAULTS.staleUploadGraceSeconds
  ),
})

export type UploadSettings = z.infer<typeof uploadSettingsSchema>

export const instanceConfigSchema = z.object({
  domain: z.string().trim().default(""),
  publicSignups: z.boolean().default(false),
  homePageEnabled: z.boolean().default(true),
  onboardingComplete: z.boolean().default(false),
  rateLimitSettings: rateLimitSettingsSchema.default({
    free: RATE_LIMIT_DEFAULTS.free,
    pro: RATE_LIMIT_DEFAULTS.pro,
  }),
  emailSettings: emailSettingsSchema.default({
    workspaceCreated: defaultEmailEventConfig,
    workspaceInvite: defaultEmailEventConfig,
    workspaceDeletion: defaultEmailEventConfig,
  }),
  usageSettings: usageSettingsSchema.default({
    storage: {
      freeBytes: STORAGE_QUOTA_DEFAULTS.free,
      proBytes: STORAGE_QUOTA_DEFAULTS.pro,
    },
  }),
  uploadSettings: uploadSettingsSchema.default({
    uploadsEnabled: UPLOAD_SETTINGS_DEFAULTS.uploadsEnabled,
    workspaceImageUploadsEnabled:
      UPLOAD_SETTINGS_DEFAULTS.workspaceImageUploadsEnabled,
    maxPendingUploadsPerWorkspace:
      UPLOAD_SETTINGS_DEFAULTS.maxPendingUploadsPerWorkspace,
    intentTtlSeconds: UPLOAD_SETTINGS_DEFAULTS.intentTtlSeconds,
    staleUploadGraceSeconds: UPLOAD_SETTINGS_DEFAULTS.staleUploadGraceSeconds,
  }),
})

export type InstanceConfig = z.infer<typeof instanceConfigSchema>

export const defaultInstanceConfig: InstanceConfig = {
  domain: "",
  publicSignups: false,
  homePageEnabled: true,
  onboardingComplete: false,
  rateLimitSettings: {
    free: { ...RATE_LIMIT_DEFAULTS.free },
    pro: { ...RATE_LIMIT_DEFAULTS.pro },
  },
  emailSettings: {
    workspaceCreated: { ...defaultEmailEventConfig },
    workspaceInvite: { ...defaultEmailEventConfig },
    workspaceDeletion: { ...defaultEmailEventConfig },
  },
  usageSettings: {
    storage: {
      freeBytes: STORAGE_QUOTA_DEFAULTS.free,
      proBytes: STORAGE_QUOTA_DEFAULTS.pro,
    },
  },
  uploadSettings: {
    uploadsEnabled: UPLOAD_SETTINGS_DEFAULTS.uploadsEnabled,
    workspaceImageUploadsEnabled:
      UPLOAD_SETTINGS_DEFAULTS.workspaceImageUploadsEnabled,
    maxPendingUploadsPerWorkspace:
      UPLOAD_SETTINGS_DEFAULTS.maxPendingUploadsPerWorkspace,
    intentTtlSeconds: UPLOAD_SETTINGS_DEFAULTS.intentTtlSeconds,
    staleUploadGraceSeconds: UPLOAD_SETTINGS_DEFAULTS.staleUploadGraceSeconds,
  },
}

export const instanceConfigUpdateSchema = instanceConfigSchema.pick({
  domain: true,
  publicSignups: true,
  homePageEnabled: true,
  onboardingComplete: true,
  rateLimitSettings: true,
  emailSettings: true,
  usageSettings: true,
  uploadSettings: true,
})

export type InstanceConfigUpdate = z.infer<typeof instanceConfigUpdateSchema>

export const storedInstanceConfigSchema = z.object({
  config: instanceConfigSchema,
  version: z.number().int().positive(),
  updatedAt: z.string(),
})

export type StoredInstanceConfig = z.infer<typeof storedInstanceConfigSchema>

/**
 * Schema for a Resend template variable (as returned by `resend.templates.get`).
 */
export const resendTemplateVariableSchema = z.object({
  id: z.string().optional(),
  key: z.string(),
  type: z.string().optional(),
  fallback_value: z.union([z.string(), z.number(), z.null()]).optional(),
})

export type ResendTemplateVariable = z.infer<
  typeof resendTemplateVariableSchema
>

export const resendTemplateInfoSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  variables: z.array(resendTemplateVariableSchema).default([]),
})

export type ResendTemplateInfo = z.infer<typeof resendTemplateInfoSchema>

function coerceLegacyEmailEvent(value: unknown): unknown {
  if (typeof value !== "object" || value === null) {
    return defaultEmailEventConfig
  }

  const record = value as Record<string, unknown>
  const next: Record<string, unknown> = { ...record }

  // Migrate legacy `templateName` -> `templateId`.
  if (typeof record.templateName === "string" && next.templateId === undefined) {
    next.templateId = record.templateName
  }

  return next
}

function coerceLegacyEmailSettings(value: unknown): EmailSettings {
  if (typeof value !== "object" || value === null) {
    return {
      workspaceCreated: { ...defaultEmailEventConfig },
      workspaceInvite: { ...defaultEmailEventConfig },
      workspaceDeletion: { ...defaultEmailEventConfig },
    }
  }

  const record = value as Record<string, unknown>

  return emailSettingsSchema.parse({
    workspaceCreated: coerceLegacyEmailEvent(record.workspaceCreated),
    workspaceInvite: coerceLegacyEmailEvent(record.workspaceInvite),
    workspaceDeletion: coerceLegacyEmailEvent(record.workspaceDeletion),
  })
}

export function normalizeInstanceConfig(input: unknown): InstanceConfig {
  const merged: Record<string, unknown> = {
    ...defaultInstanceConfig,
    ...(typeof input === "object" && input !== null ? input : {}),
  }

  if (typeof input === "object" && input !== null) {
    merged.emailSettings = coerceLegacyEmailSettings(
      (input as Record<string, unknown>).emailSettings
    )
    merged.usageSettings = usageSettingsSchema.parse(
      (input as Record<string, unknown>).usageSettings ?? {}
    )
    merged.uploadSettings = uploadSettingsSchema.parse(
      (input as Record<string, unknown>).uploadSettings ?? {}
    )
    merged.rateLimitSettings = rateLimitSettingsSchema.parse(
      (input as Record<string, unknown>).rateLimitSettings ?? {}
    )
  }

  return instanceConfigSchema.parse(merged)
}
