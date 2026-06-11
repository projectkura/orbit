import { z } from "zod"
import { workspaceStorageTierSchema } from "./workspaces"

export const masterAdminUsername = "admin"
export const masterAdminName = "admin"
export const masterAdminEmail = "admin@orbit-auth.local"

export function isMasterAdminEmail(value?: string | null) {
  return value?.trim().toLowerCase() === masterAdminEmail
}

export const masterAdminStatusSchema = z.object({
  freshInstall: z.boolean(),
  hasMasterAdmin: z.boolean(),
  databaseReachable: z.boolean(),
  requiresDatabaseSetup: z.boolean(),
  canBootstrap: z.boolean(),
  statusMessage: z.string().nullable(),
})

export type MasterAdminStatus = z.infer<typeof masterAdminStatusSchema>

export const masterAdminSetupSchema = z.object({
  password: z.string().min(8).max(128),
})

export type MasterAdminSetup = z.infer<typeof masterAdminSetupSchema>

export const setupProgressEventSchema = z.object({
  type: z.enum(["stage", "complete", "error"]),
  phase: z.string(),
  message: z.string(),
  progress: z.number().min(0).max(100),
})

export type SetupProgressEvent = z.infer<typeof setupProgressEventSchema>

export const adminWorkspaceRecordSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  identifier: z.string(),
  imageUrl: z.string().nullable(),
  storageTier: workspaceStorageTierSchema,
  uploadsPaused: z.boolean().default(false),
  uploadsPausedReason: z.string().nullable().default(null),
  ownerName: z.string().nullable(),
  ownerEmail: z.string().email().nullable(),
  memberCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
})

export type AdminWorkspaceRecord = z.infer<typeof adminWorkspaceRecordSchema>

export const adminWorkspaceListSchema = z.object({
  workspaces: z.array(adminWorkspaceRecordSchema),
})

export type AdminWorkspaceList = z.infer<typeof adminWorkspaceListSchema>
