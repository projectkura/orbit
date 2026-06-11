import { z } from "zod"

export const workspaceRoleSchema = z.literal("Owner")

export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>

export const workspaceRateLimitsSchema = z.object({
  apiRequestsPerMinute: z.number().int().min(1).optional(),
  apiRequestsPerMonth: z.number().int().min(1).optional(),
  networkEgressBytesPerMonth: z.number().int().min(0).nullable().optional(),
  storageBytesMax: z.number().int().min(0).nullable().optional(),
})

export type WorkspaceRateLimits = z.infer<typeof workspaceRateLimitsSchema>

export const workspaceStorageTierSchema = z.enum(["free", "pro"])

export type WorkspaceStorageTier = z.infer<typeof workspaceStorageTierSchema>

export const WORKSPACE_ASSET_KINDS = [
  "workspace_logo",
  "workspace_chart",
  "workspace_backup",
] as const

export const workspaceUsageTypeSchema = z.enum([
  "general_storage",
  "bandwidth",
  "database",
])

export type WorkspaceUsageType = z.infer<typeof workspaceUsageTypeSchema>

export const workspaceAssetKindSchema = z.enum(WORKSPACE_ASSET_KINDS)

export type WorkspaceAssetKind = z.infer<typeof workspaceAssetKindSchema>

export const workspaceAssetStatusSchema = z.enum([
  "pending_intent",
  "uploading",
  "uploaded_unverified",
  "active",
  "expired",
  "canceled",
  "validation_failed",
  "deleted",
])

export type WorkspaceAssetStatus = z.infer<typeof workspaceAssetStatusSchema>

export const workspaceAssetVisibilitySchema = z.enum(["public", "private"])

export const workspaceAssetEncryptionSchema = z.enum(["none", "managed"])

export const workspaceImageMimeTypes = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const

export const MAX_WORKSPACE_IMAGE_BYTES = 5 * 1024 * 1024
export const MAX_WORKSPACE_ASSET_BYTES = 1024 * 1024 * 1024

export const workspaceIdentifierSchema = z
  .string()
  .trim()
  .min(1, "Identifier is required.")
  .max(20, "Identifier must be 20 characters or fewer.")
  .transform((value) => value.toLowerCase().replace(/\s+/g, "_"))
  .refine(
    (value) => /^[a-z0-9_]+$/.test(value),
    "Identifier can only contain lowercase letters, numbers, and underscores."
  )

export const workspaceNameSchema = z
  .string()
  .trim()
  .min(1, "Workspace name is required.")
  .max(20, "Workspace name must be 20 characters or fewer.")
  .refine(
    (value) => /^[A-Za-z0-9]+$/.test(value),
    "Workspace name can only contain letters and numbers."
  )

export const workspaceUploadImageSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  contentType: z.enum(workspaceImageMimeTypes),
  sizeBytes: z.coerce
    .number()
    .int()
    .positive()
    .max(
      MAX_WORKSPACE_IMAGE_BYTES,
      "Workspace images must be 5 MB or smaller."
    ),
})

export const createWorkspaceSchema = z.object({
  name: workspaceNameSchema,
  identifier: workspaceIdentifierSchema,
  image: workspaceUploadImageSchema.optional(),
})

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>

export const workspaceUploadIntentSchema = z.object({
  assetId: z.string(),
  kind: workspaceAssetKindSchema,
  status: workspaceAssetStatusSchema,
  uploadUrl: z.string().url(),
  publicUrl: z.string().url().nullable(),
  storageKey: z.string(),
  expiresAt: z.string(),
  reservationBytes: z.number().int().positive(),
  reservationExpiresAt: z.string(),
  headers: z.record(z.string()),
})

export type WorkspaceUploadIntent = z.infer<typeof workspaceUploadIntentSchema>

export const workspaceSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  identifier: z.string(),
  imageUrl: z.string().nullable(),
  storageTier: workspaceStorageTierSchema,
  role: workspaceRoleSchema,
  uploadsAllowed: z.boolean().default(true),
  uploadBlockReason: z.string().nullable().default(null),
  pendingUpload: workspaceUploadIntentSchema.nullable().optional(),
  rateLimits: workspaceRateLimitsSchema.nullable().optional(),
})

export type WorkspaceSummary = z.infer<typeof workspaceSummarySchema>

export const workspaceListResponseSchema = z.object({
  workspaces: z.array(workspaceSummarySchema),
})

export type WorkspaceListResponse = z.infer<typeof workspaceListResponseSchema>

export const finalizeWorkspaceAssetSchema = z.object({
  assetId: z.string().uuid(),
})

export type FinalizeWorkspaceAssetInput = z.infer<
  typeof finalizeWorkspaceAssetSchema
>

export const createWorkspaceAssetIntentSchema = z.object({
  kind: workspaceAssetKindSchema,
  fileName: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(1).max(255),
  sizeBytes: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_WORKSPACE_ASSET_BYTES, "Workspace assets must be 1 GB or smaller."),
})

export type CreateWorkspaceAssetIntentInput = z.infer<
  typeof createWorkspaceAssetIntentSchema
>

export const cancelWorkspaceAssetSchema = z.object({
  assetId: z.string().uuid(),
})

export type CancelWorkspaceAssetInput = z.infer<
  typeof cancelWorkspaceAssetSchema
>

export const uploadUsageSnapshotSchema = z.object({
  usedBytes: z.number().int().nonnegative(),
  reservedBytes: z.number().int().nonnegative(),
  availableBytes: z.number().int().nonnegative(),
  limitBytes: z.number().int().nonnegative(),
  pendingUploads: z.number().int().nonnegative(),
})

export type UploadUsageSnapshot = z.infer<typeof uploadUsageSnapshotSchema>

export const workspaceAssetActorSchema = z.object({
  userId: z.string(),
  name: z.string().nullable(),
  email: z.string().email(),
})

export type WorkspaceAssetActor = z.infer<typeof workspaceAssetActorSchema>

export const workspaceUsageItemSchema = z.object({
  id: z.string(),
  kind: workspaceAssetKindSchema,
  status: workspaceAssetStatusSchema,
  label: z.string(),
  visibility: workspaceAssetVisibilitySchema,
  publicUrl: z.string().nullable(),
  sizeBytes: z.number().int().nonnegative(),
  reservedBytes: z.number().int().nonnegative().default(0),
  contentType: z.string().nullable(),
  failedReason: z.string().nullable().default(null),
  uploadedBy: workspaceAssetActorSchema,
  createdAt: z.string(),
})

export const workspaceUsageMetricSchema = z.object({
  type: workspaceUsageTypeSchema,
  usedBytes: z.number().int().nonnegative(),
  limitBytes: z.number().int().nonnegative().nullable(),
})

export const workspaceUsageResponseSchema = z.object({
  workspace: workspaceSummarySchema.omit({ pendingUpload: true }),
  metrics: z.array(workspaceUsageMetricSchema),
  reservedBytes: z.number().int().nonnegative(),
  availableBytes: z.number().int().nonnegative(),
  pendingUploads: z.number().int().nonnegative(),
  items: z.array(workspaceUsageItemSchema),
})

export type WorkspaceUsageResponse = z.infer<
  typeof workspaceUsageResponseSchema
>
