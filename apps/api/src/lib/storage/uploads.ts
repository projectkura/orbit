import {
  MAX_WORKSPACE_IMAGE_BYTES,
  cancelWorkspaceAssetSchema,
  createWorkspaceAssetIntentSchema,
  finalizeWorkspaceAssetSchema,
  workspaceImageMimeTypes,
  workspaceAssetStatusSchema,
  workspaceSummarySchema,
  workspaceUsageResponseSchema,
  type CreateWorkspaceAssetIntentInput,
  type WorkspaceAssetKind,
  type WorkspaceSummary,
  type WorkspaceUsageType,
} from "@orbit/shared"
import { and, asc, eq, inArray, lt, sql } from "drizzle-orm"
import { drizzleDb } from "../db/connection"
import {
  users,
  workspaceAssets,
  workspaceUsageCounters,
  workspaceMembers,
  workspaces,
} from "../db/schema"
import { getRuntimeInstanceConfig } from "../core/config-store"
import {
  buildPublicAssetUrl,
  buildWorkspaceAssetKey,
  createPresignedUpload,
  deleteR2Object,
  headR2Object,
  readR2ObjectPrefix,
} from "./r2-storage"

const GENERAL_STORAGE = "general_storage" as const
const IMAGE_SIGNATURE_BYTES = 16
const PENDING_UPLOAD_STATUSES = [
  "pending_intent",
  "uploading",
  "uploaded_unverified",
] as const

type UploadErrorCode =
  | "UPLOAD_CONTENT_TYPE_NOT_ALLOWED"
  | "UPLOAD_FILE_TOO_LARGE"
  | "UPLOAD_ROLE_NOT_ALLOWED"
  | "UPLOADS_DISABLED_GLOBAL"
  | "UPLOADS_DISABLED_KIND"
  | "UPLOADS_DISABLED_WORKSPACE"
  | "UPLOAD_QUOTA_EXCEEDED"
  | "UPLOAD_TOO_MANY_PENDING"
  | "UPLOAD_INTENT_EXPIRED"
  | "UPLOAD_INTENT_NOT_FOUND"
  | "UPLOAD_OBJECT_MISSING"
  | "UPLOAD_METADATA_MISMATCH"
  | "UPLOAD_SIGNATURE_MISMATCH"
  | "UPLOAD_VALIDATION_FAILED"

type WorkspaceContext = {
  id: string
  name: string
  identifier: string
  imageUrl: string | null
  storageTier: string
  role: string
  uploadsPaused: boolean
  uploadsPausedReason: string | null
}

type UsageSnapshot = {
  usedBytes: number
  reservedBytes: number
  availableBytes: number
  limitBytes: number
  pendingUploads: number
}
type CreateUploadIntentResult =
  | {
      pendingUpload: NonNullable<WorkspaceSummary["pendingUpload"]>
      block?: undefined
      uploadsAllowed: true
      uploadBlockReason: null
      usageSnapshot: UsageSnapshot
    }
  | {
      pendingUpload: null
      block: UploadPolicyBlock
      uploadsAllowed: false
      uploadBlockReason: string
      usageSnapshot: UsageSnapshot
    }

type Tx = Parameters<Parameters<typeof drizzleDb.transaction>[0]>[0]
type UploadPolicyBlock = {
  status: number
  code: UploadErrorCode
  message: string
}
type AssetPolicy = {
  allowedContentTypes: readonly string[]
  maxSizeBytes: number
  visibility: "public" | "private"
  minimumRole: "member" | "owner"
  signatureCheck: "image" | "none"
  replaceActive: boolean
  syncWorkspaceImage: boolean
  deleteReplacedObjects: boolean
  label: string
}

const USAGE_TYPES: WorkspaceUsageType[] = [
  "general_storage",
  "bandwidth",
  "database",
]
const WORKSPACE_ROLE_RANK: Record<string, number> = {
  viewer: 0,
  member: 1,
  owner: 2,
  admin: 3,
}
const WORKSPACE_ASSET_POLICIES: Record<WorkspaceAssetKind, AssetPolicy> = {
  workspace_logo: {
    allowedContentTypes: workspaceImageMimeTypes,
    maxSizeBytes: MAX_WORKSPACE_IMAGE_BYTES,
    visibility: "public",
    minimumRole: "member",
    signatureCheck: "image",
    replaceActive: true,
    syncWorkspaceImage: true,
    deleteReplacedObjects: true,
    label: "Workspace image",
  },
  workspace_chart: {
    allowedContentTypes: workspaceImageMimeTypes,
    maxSizeBytes: 10 * 1024 * 1024,
    visibility: "private",
    minimumRole: "member",
    signatureCheck: "image",
    replaceActive: false,
    syncWorkspaceImage: false,
    deleteReplacedObjects: false,
    label: "Workspace chart",
  },
  workspace_backup: {
    allowedContentTypes: [
      "application/json",
      "application/zip",
      "application/x-zip-compressed",
      "application/gzip",
      "application/octet-stream",
      "text/plain",
    ],
    maxSizeBytes: 250 * 1024 * 1024,
    visibility: "private",
    minimumRole: "owner",
    signatureCheck: "none",
    replaceActive: false,
    syncWorkspaceImage: false,
    deleteReplacedObjects: false,
    label: "Workspace backup",
  },
}

function uploadError(
  status: number,
  code: UploadErrorCode,
  message: string,
  details?: string,
  usageSnapshot?: UsageSnapshot
) {
  return new Response(
    JSON.stringify({
      code,
      message,
      details,
      usageSnapshot,
    }),
    {
      status,
      headers: { "Content-Type": "application/json" },
    }
  )
}

function workspaceStorageLimitBytes(
  tier: string,
  config: Awaited<ReturnType<typeof getRuntimeInstanceConfig>>
) {
  return tier === "pro"
    ? config.usageSettings.storage.proBytes
    : config.usageSettings.storage.freeBytes
}

function getAssetPolicy(kind: WorkspaceAssetKind) {
  return WORKSPACE_ASSET_POLICIES[kind]
}

function normalizeWorkspaceRole(role: string) {
  return role.trim().toLowerCase()
}

function hasRequiredWorkspaceRole(
  role: string,
  minimumRole: AssetPolicy["minimumRole"]
) {
  const actualRank = WORKSPACE_ROLE_RANK[normalizeWorkspaceRole(role)] ?? 0
  const minimumRank = WORKSPACE_ROLE_RANK[minimumRole] ?? Number.MAX_SAFE_INTEGER
  return actualRank >= minimumRank
}

function assertImageSignature(contentType: string, bytes: Uint8Array | null) {
  if (!bytes || bytes.length < 4) {
    throw uploadError(
      400,
      "UPLOAD_VALIDATION_FAILED",
      "Unable to verify uploaded image content."
    )
  }

  const isPng =
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  const isGif =
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38
  const isWebp =
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50

  const valid =
    (contentType === "image/png" && isPng) ||
    (contentType === "image/jpeg" && isJpeg) ||
    (contentType === "image/gif" && isGif) ||
    (contentType === "image/webp" && isWebp)

  if (!valid) {
    throw uploadError(
      400,
      "UPLOAD_SIGNATURE_MISMATCH",
      "Uploaded file content does not match its image type."
    )
  }
}

async function ensureUsageCounterRow(tx: Tx, workspaceId: string) {
  await tx
    .insert(workspaceUsageCounters)
    .values(
      USAGE_TYPES.map((usageType) => ({
        workspaceId,
        usageType,
        usedBytes: 0,
        reservedBytes: 0,
      }))
    )
    .onConflictDoNothing()
}

async function getWorkspaceForUser(
  userId: string,
  identifier: string
): Promise<WorkspaceContext | null> {
  const rows = await drizzleDb
    .select({
      id: workspaces.id,
      name: workspaces.name,
      identifier: workspaces.identifier,
      imageUrl: workspaces.imageUrl,
      storageTier: workspaces.storageTier,
      role: workspaceMembers.role,
      uploadsPaused: workspaces.uploadsPaused,
      uploadsPausedReason: workspaces.uploadsPausedReason,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(
      and(
        eq(workspaceMembers.userId, userId),
        eq(workspaces.identifier, identifier)
      )
    )
    .limit(1)

  return rows[0] ?? null
}

async function getUsageSnapshot(
  tx: Tx,
  workspace: Pick<WorkspaceContext, "id" | "storageTier">
) {
  await ensureUsageCounterRow(tx, workspace.id)

  const usageRows = await tx
    .select({
      usedBytes: workspaceUsageCounters.usedBytes,
      reservedBytes: workspaceUsageCounters.reservedBytes,
    })
    .from(workspaceUsageCounters)
    .where(
      and(
        eq(workspaceUsageCounters.workspaceId, workspace.id),
        eq(workspaceUsageCounters.usageType, GENERAL_STORAGE)
      )
    )
    .limit(1)

  const pendingRows = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(workspaceAssets)
    .where(
      and(
        eq(workspaceAssets.workspaceId, workspace.id),
        inArray(workspaceAssets.status, [...PENDING_UPLOAD_STATUSES])
      )
    )

  const config = await getRuntimeInstanceConfig()
  const usedBytes = usageRows[0]?.usedBytes ?? 0
  const reservedBytes = usageRows[0]?.reservedBytes ?? 0
  const limitBytes = workspaceStorageLimitBytes(workspace.storageTier, config)

  return {
    usedBytes,
    reservedBytes,
    limitBytes,
    availableBytes: Math.max(limitBytes - usedBytes - reservedBytes, 0),
    pendingUploads: pendingRows[0]?.count ?? 0,
  }
}

function resolveUploadPolicyBlock(input: {
  workspace: Pick<
    WorkspaceContext,
    "uploadsPaused" | "uploadsPausedReason" | "role"
  >
  kind: WorkspaceAssetKind
  requestedSizeBytes: number
  usageSnapshot: UsageSnapshot
  config: Awaited<ReturnType<typeof getRuntimeInstanceConfig>>
}): UploadPolicyBlock | null {
  const { workspace, kind, requestedSizeBytes, usageSnapshot, config } = input
  const policy = getAssetPolicy(kind)

  if (!config.uploadSettings.uploadsEnabled) {
    return {
      status: 403,
      code: "UPLOADS_DISABLED_GLOBAL",
      message: "Uploads are currently disabled for this Orbit instance.",
    }
  }

  if (
    kind === "workspace_logo" &&
    !config.uploadSettings.workspaceImageUploadsEnabled
  ) {
    return {
      status: 403,
      code: "UPLOADS_DISABLED_KIND",
      message: "Workspace image uploads are currently disabled.",
    }
  }

  if (workspace.uploadsPaused) {
    return {
      status: 403,
      code: "UPLOADS_DISABLED_WORKSPACE",
      message:
        workspace.uploadsPausedReason?.trim() ||
        "Uploads are paused for this workspace.",
    }
  }

  if (!hasRequiredWorkspaceRole(workspace.role, policy.minimumRole)) {
    return {
      status: 403,
      code: "UPLOAD_ROLE_NOT_ALLOWED",
      message: `Your workspace role cannot upload ${policy.label.toLowerCase()}.`,
    }
  }

  if (
    usageSnapshot.pendingUploads >=
    config.uploadSettings.maxPendingUploadsPerWorkspace
  ) {
    return {
      status: 429,
      code: "UPLOAD_TOO_MANY_PENDING",
      message: "Too many pending uploads already exist for this workspace.",
    }
  }

  if (
    usageSnapshot.usedBytes + usageSnapshot.reservedBytes + requestedSizeBytes >
    usageSnapshot.limitBytes
  ) {
    return {
      status: 413,
      code: "UPLOAD_QUOTA_EXCEEDED",
      message: "Workspace storage quota would be exceeded.",
    }
  }

  return null
}

function assertUploadIntentMatchesPolicy(input: {
  kind: WorkspaceAssetKind
  contentType: string
  sizeBytes: number
}) {
  const policy = getAssetPolicy(input.kind)

  if (!policy.allowedContentTypes.includes(input.contentType)) {
    throw uploadError(
      400,
      "UPLOAD_CONTENT_TYPE_NOT_ALLOWED",
      `${policy.label} uploads do not support ${input.contentType}.`
    )
  }

  if (input.sizeBytes > policy.maxSizeBytes) {
    throw uploadError(
      413,
      "UPLOAD_FILE_TOO_LARGE",
      `${policy.label} uploads must be ${Math.ceil(policy.maxSizeBytes / 1024 / 1024)} MB or smaller.`
    )
  }
}

function toWorkspaceSummary(
  row: WorkspaceContext & {
    pendingUpload?: WorkspaceSummary["pendingUpload"]
    uploadsAllowed?: boolean
    uploadBlockReason?: string | null
  }
) {
  return workspaceSummarySchema.parse({
    id: row.id,
    name: row.name,
    identifier: row.identifier,
    imageUrl: row.imageUrl,
    storageTier: row.storageTier,
    role: row.role,
    pendingUpload: row.pendingUpload ?? null,
    uploadsAllowed: row.uploadsAllowed ?? true,
    uploadBlockReason: row.uploadBlockReason ?? null,
  })
}

function getWorkspaceAssetLabel(kind: WorkspaceAssetKind, originalFileName: string | null) {
  const policy = getAssetPolicy(kind)

  if (kind === "workspace_logo") {
    return policy.label
  }

  return originalFileName ?? policy.label
}

export async function createUploadIntentForWorkspace(
  tx: Tx,
  input: {
    workspace: WorkspaceContext
    userId: string
    kind: WorkspaceAssetKind
    fileName: string
    contentType: string
    sizeBytes: number
  }
): Promise<CreateUploadIntentResult> {
  const config = await getRuntimeInstanceConfig()
  const policy = getAssetPolicy(input.kind)
  assertUploadIntentMatchesPolicy({
    kind: input.kind,
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
  })
  const usageSnapshot = await getUsageSnapshot(tx, input.workspace)
  const block = resolveUploadPolicyBlock({
    workspace: input.workspace,
    kind: input.kind,
    requestedSizeBytes: input.sizeBytes,
    usageSnapshot,
    config,
  })

  if (block) {
    return {
      pendingUpload: null,
      block,
      uploadsAllowed: false,
      uploadBlockReason: block.message,
      usageSnapshot,
    }
  }

  const now = new Date()
  const reservationExpiresAt = new Date(
    now.getTime() + config.uploadSettings.intentTtlSeconds * 1000
  )
  const storageKey = buildWorkspaceAssetKey({
    workspaceId: input.workspace.id,
    kind: input.kind,
    contentType: input.contentType,
    fileName: input.fileName,
  })
  const upload = await createPresignedUpload({
    storageKey,
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
    expiresInSeconds: config.uploadSettings.intentTtlSeconds,
  })
  const publicUrl =
    policy.visibility === "public" ? buildPublicAssetUrl(storageKey) : null
  const asset = await tx
    .insert(workspaceAssets)
    .values({
      workspaceId: input.workspace.id,
      kind: input.kind,
      status: "pending_intent",
      visibility: policy.visibility,
      encryptionMode: "none",
      storageKey,
      publicUrl,
      originalFileName: input.fileName,
      expectedContentType: input.contentType,
      expectedSizeBytes: input.sizeBytes,
      reservedBytes: input.sizeBytes,
      uploadedByUserId: input.userId,
      uploadExpiresAt: upload.expiresAt,
      reservationExpiresAt,
    })
    .returning({ id: workspaceAssets.id })

  await tx
    .update(workspaceUsageCounters)
    .set({
      reservedBytes: sql`${workspaceUsageCounters.reservedBytes} + ${input.sizeBytes}`,
      updatedAt: now,
    })
    .where(
      and(
        eq(workspaceUsageCounters.workspaceId, input.workspace.id),
        eq(workspaceUsageCounters.usageType, GENERAL_STORAGE)
      )
    )

  return {
    pendingUpload: {
      assetId: asset[0].id,
      kind: input.kind,
      status: "pending_intent" as const,
      uploadUrl: upload.uploadUrl,
      publicUrl,
      storageKey,
      expiresAt: upload.expiresAt.toISOString(),
      reservationBytes: input.sizeBytes,
      reservationExpiresAt: reservationExpiresAt.toISOString(),
      headers: upload.headers,
    },
    uploadsAllowed: true,
    uploadBlockReason: null,
    usageSnapshot: {
      ...usageSnapshot,
      reservedBytes: usageSnapshot.reservedBytes + input.sizeBytes,
      availableBytes: Math.max(
        usageSnapshot.availableBytes - input.sizeBytes,
        0
      ),
      pendingUploads: usageSnapshot.pendingUploads + 1,
    },
  }
}

export async function createWorkspaceAssetIntentForUser(
  userId: string,
  identifier: string,
  input: CreateWorkspaceAssetIntentInput
) {
  const data = createWorkspaceAssetIntentSchema.parse(input)
  const workspace = await getWorkspaceForUser(userId, identifier)

  if (!workspace) {
    return null
  }

  return drizzleDb.transaction(async (tx) => {
    const result = await createUploadIntentForWorkspace(tx, {
      workspace,
      userId,
      kind: data.kind,
      fileName: data.fileName,
      contentType: data.contentType,
      sizeBytes: data.sizeBytes,
    })

    if (result.pendingUpload === null) {
      throw uploadError(
        result.block.status,
        result.block.code,
        result.uploadBlockReason,
        undefined,
        result.usageSnapshot
      )
    }

    return result.pendingUpload
  })
}

async function getActiveWorkspaceSummary(
  userId: string,
  identifier: string
): Promise<WorkspaceSummary | null> {
  const workspace = await getWorkspaceForUser(userId, identifier)
  return workspace ? toWorkspaceSummary(workspace) : null
}

export async function finalizeWorkspaceAssetForUser(
  userId: string,
  identifier: string,
  input: unknown
) {
  const data = finalizeWorkspaceAssetSchema.parse(input)
  const workspace = await getWorkspaceForUser(userId, identifier)

  if (!workspace) {
    return null
  }

  const rows = await drizzleDb
    .select()
    .from(workspaceAssets)
    .where(
      and(
        eq(workspaceAssets.id, data.assetId),
        eq(workspaceAssets.workspaceId, workspace.id)
      )
    )
    .limit(1)
  const asset = rows[0]

  if (
    !asset ||
    !PENDING_UPLOAD_STATUSES.includes(
      asset.status as (typeof PENDING_UPLOAD_STATUSES)[number]
    )
  ) {
    throw uploadError(
      404,
      "UPLOAD_INTENT_NOT_FOUND",
      "Upload intent not found or already finalized."
    )
  }
  const policy = getAssetPolicy(asset.kind as WorkspaceAssetKind)

  const now = new Date()
  const reservationExpiresAt =
    asset.reservationExpiresAt ?? asset.uploadExpiresAt ?? null
  if (reservationExpiresAt && reservationExpiresAt.getTime() < now.getTime()) {
    await drizzleDb.transaction(async (tx) => {
      await tx
        .update(workspaceAssets)
        .set({
          status: "expired",
          failedReason: "UPLOAD_INTENT_EXPIRED",
          updatedAt: now,
        })
        .where(eq(workspaceAssets.id, asset.id))

      await tx
        .update(workspaceUsageCounters)
        .set({
          reservedBytes: sql`greatest(${workspaceUsageCounters.reservedBytes} - ${asset.reservedBytes}, 0)`,
          updatedAt: now,
        })
        .where(
          and(
            eq(workspaceUsageCounters.workspaceId, workspace.id),
            eq(workspaceUsageCounters.usageType, GENERAL_STORAGE)
          )
        )
    })

    throw uploadError(
      410,
      "UPLOAD_INTENT_EXPIRED",
      "Upload intent expired."
    )
  }

  const object = await headR2Object(asset.storageKey)
  if (!object) {
    console.error("Finalize: R2 object not found via HEAD", asset.storageKey)
    throw uploadError(
      400,
      "UPLOAD_OBJECT_MISSING",
      "Uploaded object was not found."
    )
  }

  const contentType = object.contentType
  if (
    !contentType ||
    contentType !== asset.expectedContentType ||
    object.sizeBytes !== asset.expectedSizeBytes ||
    object.sizeBytes !== asset.reservedBytes
  ) {
    await drizzleDb.transaction(async (tx) => {
      await tx
        .update(workspaceAssets)
        .set({
          status: "validation_failed",
          validationFailedAt: now,
          failedReason: "UPLOAD_METADATA_MISMATCH",
          failedDetail:
            "Uploaded object metadata does not match the original upload intent.",
          updatedAt: now,
        })
        .where(eq(workspaceAssets.id, asset.id))
      await tx
        .update(workspaceUsageCounters)
        .set({
          reservedBytes: sql`greatest(${workspaceUsageCounters.reservedBytes} - ${asset.reservedBytes}, 0)`,
          updatedAt: now,
        })
        .where(
          and(
            eq(workspaceUsageCounters.workspaceId, workspace.id),
            eq(workspaceUsageCounters.usageType, GENERAL_STORAGE)
          )
        )
    })
    void deleteR2Object(asset.storageKey).catch((error) => {
      console.error("Failed to delete invalid R2 object", error)
    })
    throw uploadError(
      400,
      "UPLOAD_METADATA_MISMATCH",
      "Uploaded object metadata does not match the upload intent."
    )
  }

  if (policy.signatureCheck === "image") {
    const prefix = await readR2ObjectPrefix(asset.storageKey, IMAGE_SIGNATURE_BYTES)
    try {
      assertImageSignature(contentType, prefix)
    } catch (error) {
      await drizzleDb.transaction(async (tx) => {
        await tx
          .update(workspaceAssets)
          .set({
            status: "validation_failed",
            validationFailedAt: now,
            failedReason: "UPLOAD_SIGNATURE_MISMATCH",
            failedDetail:
              "Uploaded object signature did not match its content type.",
            updatedAt: now,
          })
          .where(eq(workspaceAssets.id, asset.id))
        await tx
          .update(workspaceUsageCounters)
          .set({
            reservedBytes: sql`greatest(${workspaceUsageCounters.reservedBytes} - ${asset.reservedBytes}, 0)`,
            updatedAt: now,
          })
          .where(
            and(
              eq(workspaceUsageCounters.workspaceId, workspace.id),
              eq(workspaceUsageCounters.usageType, GENERAL_STORAGE)
            )
          )
      })
      void deleteR2Object(asset.storageKey).catch((deleteError) => {
        console.error("Failed to delete invalid R2 object", deleteError)
      })
      throw error
    }
  }

  await drizzleDb.transaction(async (tx) => {
    const replacedAssetRows = policy.replaceActive
      ? await tx
          .select({
            id: workspaceAssets.id,
            storageKey: workspaceAssets.storageKey,
            sizeBytes: workspaceAssets.sizeBytes,
          })
          .from(workspaceAssets)
          .where(
            and(
              eq(workspaceAssets.workspaceId, workspace.id),
              eq(workspaceAssets.kind, asset.kind),
              eq(workspaceAssets.status, "active")
            )
          )
      : []

    const replacedAssetBytes = replacedAssetRows.reduce(
      (total, row) => total + (row.sizeBytes ?? 0),
      0
    )

    if (policy.replaceActive) {
      await tx
        .update(workspaceAssets)
        .set({
          status: "deleted",
          deletedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(workspaceAssets.workspaceId, workspace.id),
            eq(workspaceAssets.kind, asset.kind),
            eq(workspaceAssets.status, "active")
          )
        )
    }

    await tx
      .update(workspaceAssets)
      .set({
        status: "active",
        contentType,
        sizeBytes: object.sizeBytes,
        reservedBytes: 0,
        etag: object.etag,
        uploadCompletedAt: now,
        finalizedAt: now,
        updatedAt: now,
        failedReason: null,
        failedDetail: null,
      })
      .where(eq(workspaceAssets.id, asset.id))

    await tx
      .update(workspaceUsageCounters)
      .set({
        reservedBytes: sql`greatest(${workspaceUsageCounters.reservedBytes} - ${asset.reservedBytes}, 0)`,
        usedBytes: sql`greatest(${workspaceUsageCounters.usedBytes} - ${replacedAssetBytes}, 0) + ${object.sizeBytes}`,
        updatedAt: now,
      })
      .where(
        and(
          eq(workspaceUsageCounters.workspaceId, workspace.id),
          eq(workspaceUsageCounters.usageType, GENERAL_STORAGE)
        )
      )

    if (policy.syncWorkspaceImage) {
      await tx
        .update(workspaces)
        .set({
          imageUrl: asset.publicUrl,
          updatedAt: now,
        })
        .where(eq(workspaces.id, workspace.id))
    }

    if (policy.deleteReplacedObjects) {
      for (const replaced of replacedAssetRows) {
        void deleteR2Object(replaced.storageKey).catch((error) => {
          console.error("Failed to delete replaced R2 object", error)
        })
      }
    }
  })

  return getActiveWorkspaceSummary(userId, identifier)
}

export async function cancelWorkspaceAssetForUser(
  userId: string,
  identifier: string,
  input: unknown
) {
  const data = cancelWorkspaceAssetSchema.parse(input)
  const workspace = await getWorkspaceForUser(userId, identifier)

  if (!workspace) {
    return null
  }

  const rows = await drizzleDb
    .select()
    .from(workspaceAssets)
    .where(
      and(
        eq(workspaceAssets.id, data.assetId),
        eq(workspaceAssets.workspaceId, workspace.id)
      )
    )
    .limit(1)
  const asset = rows[0]

  if (!asset || !PENDING_UPLOAD_STATUSES.includes(asset.status as (typeof PENDING_UPLOAD_STATUSES)[number])) {
    throw uploadError(
      404,
      "UPLOAD_INTENT_NOT_FOUND",
      "Pending upload intent not found."
    )
  }

  const now = new Date()
  await drizzleDb.transaction(async (tx) => {
    await tx
      .update(workspaceAssets)
      .set({
        status: "canceled",
        canceledAt: now,
        failedReason: "UPLOAD_VALIDATION_FAILED",
        updatedAt: now,
      })
      .where(eq(workspaceAssets.id, asset.id))
    await tx
      .update(workspaceUsageCounters)
      .set({
        reservedBytes: sql`greatest(${workspaceUsageCounters.reservedBytes} - ${asset.reservedBytes}, 0)`,
        updatedAt: now,
      })
      .where(
        and(
          eq(workspaceUsageCounters.workspaceId, workspace.id),
          eq(workspaceUsageCounters.usageType, GENERAL_STORAGE)
        )
      )
  })

  void deleteR2Object(asset.storageKey).catch(() => {
    // Ignore missing objects for canceled pending uploads.
  })

  return { ok: true }
}

export async function reapExpiredUploadIntents() {
  const now = new Date()
  const staleRows = await drizzleDb
    .select()
    .from(workspaceAssets)
    .where(
      and(
        inArray(workspaceAssets.status, [...PENDING_UPLOAD_STATUSES]),
        lt(workspaceAssets.reservationExpiresAt, now)
      )
    )

  if (staleRows.length === 0) {
    return { expired: 0 }
  }

  const expiredByWorkspace = new Map<string, number>()
  for (const row of staleRows) {
    expiredByWorkspace.set(
      row.workspaceId,
      (expiredByWorkspace.get(row.workspaceId) ?? 0) + row.reservedBytes
    )
  }

  await drizzleDb.transaction(async (tx) => {
    for (const row of staleRows) {
      await tx
        .update(workspaceAssets)
        .set({
          status: "expired",
          failedReason: "UPLOAD_INTENT_EXPIRED",
          updatedAt: now,
        })
        .where(eq(workspaceAssets.id, row.id))
    }

    for (const [workspaceId, reservedBytes] of expiredByWorkspace.entries()) {
      await tx
        .update(workspaceUsageCounters)
        .set({
          reservedBytes: sql`greatest(${workspaceUsageCounters.reservedBytes} - ${reservedBytes}, 0)`,
          updatedAt: now,
        })
        .where(
          and(
            eq(workspaceUsageCounters.workspaceId, workspaceId),
            eq(workspaceUsageCounters.usageType, GENERAL_STORAGE)
          )
        )
    }
  })

  for (const row of staleRows) {
    void deleteR2Object(row.storageKey).catch(() => {
      // Ignore missing objects for expired pending uploads.
    })
  }

  return { expired: staleRows.length }
}

export async function getWorkspaceUsageForUser(
  userId: string,
  identifier: string
) {
  const workspace = await getWorkspaceForUser(userId, identifier)

  if (!workspace) {
    return null
  }

  const config = await getRuntimeInstanceConfig()
  const [usageRows, assetRows] = await Promise.all([
    drizzleDb
      .select()
      .from(workspaceUsageCounters)
      .where(eq(workspaceUsageCounters.workspaceId, workspace.id)),
    drizzleDb
      .select({
        id: workspaceAssets.id,
        kind: workspaceAssets.kind,
        status: workspaceAssets.status,
        visibility: workspaceAssets.visibility,
        publicUrl: workspaceAssets.publicUrl,
        sizeBytes: workspaceAssets.sizeBytes,
        reservedBytes: workspaceAssets.reservedBytes,
        contentType: workspaceAssets.contentType,
        expectedContentType: workspaceAssets.expectedContentType,
        failedReason: workspaceAssets.failedReason,
        createdAt: workspaceAssets.createdAt,
        originalFileName: workspaceAssets.originalFileName,
        uploadedByUserId: workspaceAssets.uploadedByUserId,
        uploadedByName: users.name,
        uploadedByEmail: users.email,
      })
      .from(workspaceAssets)
      .innerJoin(users, eq(workspaceAssets.uploadedByUserId, users.id))
      .where(
        and(
          eq(workspaceAssets.workspaceId, workspace.id),
          inArray(workspaceAssets.status, [
            "active",
            "pending_intent",
            "uploading",
            "uploaded_unverified",
            "validation_failed",
            "expired",
          ])
        )
      )
      .orderBy(asc(workspaceAssets.createdAt)),
  ])
  const usageByType = new Map(
    usageRows.map((row) => [row.usageType, row.usedBytes])
  )
  const storageRow = usageRows.find((row) => row.usageType === GENERAL_STORAGE)
  const limitBytes = workspaceStorageLimitBytes(workspace.storageTier, config)
  const usedBytes = storageRow?.usedBytes ?? 0
  const reservedBytes = storageRow?.reservedBytes ?? 0

  return workspaceUsageResponseSchema.parse({
    workspace: toWorkspaceSummary(workspace),
    metrics: USAGE_TYPES.map((type) => ({
      type,
      usedBytes: usageByType.get(type) ?? 0,
      limitBytes: type === GENERAL_STORAGE ? limitBytes : null,
    })),
    reservedBytes,
    availableBytes: Math.max(limitBytes - usedBytes - reservedBytes, 0),
    pendingUploads: assetRows.filter((asset) =>
      PENDING_UPLOAD_STATUSES.includes(asset.status as (typeof PENDING_UPLOAD_STATUSES)[number])
    ).length,
    items: assetRows.map((asset) => ({
      id: asset.id,
      kind: asset.kind as WorkspaceAssetKind,
      status: workspaceAssetStatusSchema.parse(asset.status),
      label: getWorkspaceAssetLabel(
        asset.kind as WorkspaceAssetKind,
        asset.originalFileName
      ),
      visibility: asset.visibility === "public" ? "public" : "private",
      publicUrl: asset.publicUrl,
      sizeBytes: asset.sizeBytes,
      reservedBytes: asset.reservedBytes,
      contentType: asset.contentType ?? asset.expectedContentType,
      failedReason: asset.failedReason ?? null,
      uploadedBy: {
        userId: asset.uploadedByUserId,
        name: asset.uploadedByName,
        email: asset.uploadedByEmail,
      },
      createdAt: asset.createdAt.toISOString(),
    })),
  })
}
