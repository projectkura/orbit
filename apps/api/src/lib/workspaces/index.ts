import {
  adminWorkspaceListSchema,
  createWorkspaceSchema,
  workspaceSummarySchema,
  type CreateWorkspaceInput,
  type WorkspaceSummary,
} from "@orbit/shared"
import { and, asc, eq, inArray, sql } from "drizzle-orm"
import { drizzleDb } from "../db/connection"
import {
  users,
  workspaceAssets,
  workspaceDeletionCodes,
  workspaceMembers,
  workspaceUsageCounters,
  workspaces,
} from "../db/schema"
import { deleteR2Object } from "../storage/r2-storage"
import { createUploadIntentForWorkspace } from "../storage/uploads"

function toWorkspaceSummary(row: {
  id: string
  name: string
  identifier: string
  imageUrl: string | null
  storageTier: string
  role: string
  uploadsPaused?: boolean
  uploadsPausedReason?: string | null
  uploadsAllowed?: boolean
  uploadBlockReason?: string | null
  pendingUpload?: unknown
}): WorkspaceSummary {
  const uploadsAllowed =
    row.uploadsAllowed ?? (row.uploadsPaused === true ? false : true)
  const uploadBlockReason =
    row.uploadBlockReason ??
    (row.uploadsPaused === true
      ? row.uploadsPausedReason ?? "Uploads are paused for this workspace."
      : null)

  return workspaceSummarySchema.parse({
    id: row.id,
    name: row.name,
    identifier: row.identifier,
    imageUrl: row.imageUrl,
    storageTier: row.storageTier,
    role: row.role,
    uploadsAllowed,
    uploadBlockReason,
    pendingUpload: row.pendingUpload ?? null,
  })
}

export function isUniqueViolation(error: unknown, constraint?: string) {
  const candidate =
    typeof error === "object" &&
    error !== null &&
    "cause" in error &&
    typeof error.cause === "object" &&
    error.cause !== null
      ? error.cause
      : error

  return (
    typeof candidate === "object" &&
    candidate !== null &&
    "code" in candidate &&
    candidate.code === "23505" &&
    (!constraint ||
      !("constraint" in candidate) ||
      candidate.constraint === constraint)
  )
}

async function ensureUsageCounters(
  tx: Parameters<Parameters<typeof drizzleDb.transaction>[0]>[0],
  workspaceId: string
) {
  await tx
    .insert(workspaceUsageCounters)
    .values([
      {
        workspaceId,
        usageType: "general_storage",
        usedBytes: 0,
        reservedBytes: 0,
      },
      {
        workspaceId,
        usageType: "bandwidth",
        usedBytes: 0,
        reservedBytes: 0,
      },
      {
        workspaceId,
        usageType: "database",
        usedBytes: 0,
        reservedBytes: 0,
      },
    ])
    .onConflictDoNothing()
}

export async function listUserWorkspaces(userId: string) {
  const rows = await drizzleDb
    .select({
      id: workspaces.id,
      name: workspaces.name,
      identifier: workspaces.identifier,
      imageUrl: workspaces.imageUrl,
      storageTier: workspaces.storageTier,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(eq(workspaceMembers.userId, userId))
    .orderBy(asc(workspaces.createdAt))

  return {
    workspaces: rows.map(toWorkspaceSummary),
  }
}

export async function listAllWorkspacesForAdmin() {
  const rows = await drizzleDb
    .select({
      id: workspaces.id,
      name: workspaces.name,
      identifier: workspaces.identifier,
      imageUrl: workspaces.imageUrl,
      storageTier: workspaces.storageTier,
      uploadsPaused: workspaces.uploadsPaused,
      uploadsPausedReason: workspaces.uploadsPausedReason,
      ownerName: users.name,
      ownerEmail: users.email,
      memberCount: sql<number>`(
        select count(*)::int
        from ${workspaceMembers}
        where ${workspaceMembers.workspaceId} = ${workspaces.id}
      )`,
      createdAt: workspaces.createdAt,
    })
    .from(workspaces)
    .leftJoin(users, eq(workspaces.createdByUserId, users.id))
    .orderBy(asc(workspaces.createdAt))

  return adminWorkspaceListSchema.parse({
    workspaces: rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    })),
  })
}

export async function getWorkspaceForUser(userId: string, identifier: string) {
  const row = await drizzleDb
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

  return row[0] ? toWorkspaceSummary(row[0]) : null
}

export async function createWorkspaceForUser(
  userId: string,
  input: CreateWorkspaceInput
) {
  const data = createWorkspaceSchema.parse(input)

  return drizzleDb.transaction(async (tx) => {
    const inserted = await tx
      .insert(workspaces)
      .values({
        name: data.name,
        identifier: data.identifier,
        imageUrl: null,
        storageTier: "free",
        createdByUserId: userId,
      })
      .returning({
        id: workspaces.id,
        name: workspaces.name,
        identifier: workspaces.identifier,
        imageUrl: workspaces.imageUrl,
        storageTier: workspaces.storageTier,
        uploadsPaused: workspaces.uploadsPaused,
        uploadsPausedReason: workspaces.uploadsPausedReason,
      })

    const workspace = inserted[0]

    await tx.insert(workspaceMembers).values({
      workspaceId: workspace.id,
      userId,
      role: "Owner",
    })

    await ensureUsageCounters(tx, workspace.id)

    let pendingUpload: WorkspaceSummary["pendingUpload"] = null
    let uploadsAllowed = true
    let uploadBlockReason: string | null = null

    if (data.image) {
      const upload = await createUploadIntentForWorkspace(tx, {
        workspace: {
          ...workspace,
          role: "Owner",
        },
        userId,
        kind: "workspace_logo",
        fileName: data.image.fileName,
        contentType: data.image.contentType,
        sizeBytes: data.image.sizeBytes,
      })

      pendingUpload = upload.pendingUpload
      uploadsAllowed = upload.uploadsAllowed
      uploadBlockReason = upload.uploadBlockReason
    }

    return workspaceSummarySchema.parse({
      ...workspace,
      role: "Owner",
      pendingUpload,
      uploadsAllowed,
      uploadBlockReason,
    })
  })
}

export async function deleteWorkspaceAssetForUser(
  userId: string,
  identifier: string,
  assetId: string
) {
  const workspace = await getWorkspaceForUser(userId, identifier)

  if (!workspace) {
    return null
  }

  const rows = await drizzleDb
    .select()
    .from(workspaceAssets)
    .where(
      and(
        eq(workspaceAssets.id, assetId),
        eq(workspaceAssets.workspaceId, workspace.id),
        eq(workspaceAssets.status, "active")
      )
    )
    .limit(1)
  const asset = rows[0]

  if (!asset) {
    throw new Response(JSON.stringify({ message: "Asset not found." }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    })
  }

  const now = new Date()

  await drizzleDb.transaction(async (tx) => {
    await tx
      .update(workspaceAssets)
      .set({ status: "deleted", deletedAt: now, updatedAt: now })
      .where(eq(workspaceAssets.id, asset.id))

    await tx
      .update(workspaceUsageCounters)
      .set({
        usedBytes: sql`greatest(${workspaceUsageCounters.usedBytes} - ${asset.sizeBytes}, 0)`,
        updatedAt: now,
      })
      .where(
        and(
          eq(workspaceUsageCounters.workspaceId, workspace.id),
          eq(workspaceUsageCounters.usageType, "general_storage")
        )
      )

    if (asset.kind === "workspace_logo") {
      await tx
        .update(workspaces)
        .set({ imageUrl: null, updatedAt: now })
        .where(eq(workspaces.id, workspace.id))
    }
  })

  void deleteR2Object(asset.storageKey).catch((error) => {
    console.error("Failed to delete R2 object", error)
  })

  return { ok: true }
}

function generateVerificationCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let code = ""
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

export async function updateWorkspaceForUser(
  userId: string,
  identifier: string,
  updates: {
    name?: string
    imageUrl?: string | null
    uploadsPaused?: boolean
    uploadsPausedReason?: string | null
  }
) {
  const workspace = await getWorkspaceForUser(userId, identifier)

  if (!workspace) {
    return null
  }

  const now = new Date()
  const updateData: Record<string, unknown> = { updatedAt: now }

  if (updates.name !== undefined) {
    updateData.name = updates.name
  }

  if (updates.imageUrl !== undefined) {
    updateData.imageUrl = updates.imageUrl
  }

  if (updates.uploadsPaused !== undefined) {
    updateData.uploadsPaused = updates.uploadsPaused
    updateData.uploadsPausedReason = updates.uploadsPaused
      ? updates.uploadsPausedReason ?? "Uploads paused by an administrator."
      : null
  }

  await drizzleDb
    .update(workspaces)
    .set(updateData)
    .where(eq(workspaces.id, workspace.id))

  return getWorkspaceForUser(userId, identifier)
}

export async function requestWorkspaceDeletion(
  userId: string,
  identifier: string
) {
  const workspace = await getWorkspaceForUser(userId, identifier)

  if (!workspace) {
    return null
  }

  const code = generateVerificationCode()
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000)

  await drizzleDb
    .insert(workspaceDeletionCodes)
    .values({
      workspaceId: workspace.id,
      userId,
      code,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: [workspaceDeletionCodes.workspaceId],
      set: {
        code,
        expiresAt,
      },
    })

  return { code }
}

export async function confirmWorkspaceDeletion(
  userId: string,
  identifier: string,
  code: string
) {
  const workspace = await getWorkspaceForUser(userId, identifier)

  if (!workspace) {
    return null
  }

  const now = new Date()
  const codeRows = await drizzleDb
    .select()
    .from(workspaceDeletionCodes)
    .where(
      and(
        eq(workspaceDeletionCodes.workspaceId, workspace.id),
        eq(workspaceDeletionCodes.userId, userId),
        eq(workspaceDeletionCodes.code, code),
        sql`${workspaceDeletionCodes.expiresAt} > ${now}`
      )
    )
    .limit(1)

  if (!codeRows[0]) {
    throw new Response(
      JSON.stringify({ message: "Invalid or expired verification code." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    )
  }

  await drizzleDb.delete(workspaces).where(eq(workspaces.id, workspace.id))

  return { ok: true }
}

export async function updateWorkspaceForAdmin(
  workspaceId: string,
  updates: { uploadsPaused?: boolean; uploadsPausedReason?: string | null }
) {
  const rows = await drizzleDb
    .select({
      id: workspaces.id,
      identifier: workspaces.identifier,
    })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1)
  const workspace = rows[0]

  if (!workspace) {
    return null
  }

  await drizzleDb
    .update(workspaces)
    .set({
      uploadsPaused: updates.uploadsPaused ?? false,
      uploadsPausedReason:
        updates.uploadsPaused === false
          ? null
          : updates.uploadsPausedReason ?? "Uploads paused by an administrator.",
      updatedAt: new Date(),
    })
    .where(eq(workspaces.id, workspace.id))

  const refreshed = await drizzleDb
    .select({
      id: workspaces.id,
      name: workspaces.name,
      identifier: workspaces.identifier,
      imageUrl: workspaces.imageUrl,
      storageTier: workspaces.storageTier,
      uploadsPaused: workspaces.uploadsPaused,
      uploadsPausedReason: workspaces.uploadsPausedReason,
      ownerName: users.name,
      ownerEmail: users.email,
      memberCount: sql<number>`(
        select count(*)::int
        from ${workspaceMembers}
        where ${workspaceMembers.workspaceId} = ${workspaces.id}
      )`,
      createdAt: workspaces.createdAt,
    })
    .from(workspaces)
    .leftJoin(users, eq(workspaces.createdByUserId, users.id))
    .where(eq(workspaces.id, workspace.id))
    .limit(1)

  return refreshed[0]
    ? {
        ...refreshed[0],
        createdAt: refreshed[0].createdAt.toISOString(),
      }
    : null
}

export async function deleteWorkspaceForAdmin(workspaceId: string) {
  const rows = await drizzleDb
    .select({
      id: workspaces.id,
      identifier: workspaces.identifier,
      imageUrl: workspaces.imageUrl,
    })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1)
  const workspace = rows[0]

  if (!workspace) {
    return null
  }

  const activeAssets = await drizzleDb
    .select({ storageKey: workspaceAssets.storageKey })
    .from(workspaceAssets)
    .where(
      and(
        eq(workspaceAssets.workspaceId, workspace.id),
        inArray(workspaceAssets.status, ["active", "pending_intent", "uploading", "uploaded_unverified"])
      )
    )

  await drizzleDb.delete(workspaces).where(eq(workspaces.id, workspace.id))

  for (const asset of activeAssets) {
    void deleteR2Object(asset.storageKey).catch((error) => {
      console.error("Failed to delete workspace asset during admin delete", error)
    })
  }

  return { ok: true, identifier: workspace.identifier }
}
