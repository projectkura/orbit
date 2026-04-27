import { z } from "zod"

export const emergencyAdminUsername = "admin"
export const emergencyAdminName = "admin"
export const emergencyAdminEmail = "admin@orbit-auth.local"

export function isEmergencyAdminEmail(value?: string | null) {
  return value?.trim().toLowerCase() === emergencyAdminEmail
}

export const emergencyAdminStatusSchema = z.object({
  freshInstall: z.boolean(),
  hasEmergencyAdmin: z.boolean(),
  databaseReachable: z.boolean(),
  requiresDatabaseSetup: z.boolean(),
  canBootstrap: z.boolean(),
  statusMessage: z.string().nullable(),
})

export type EmergencyAdminStatus = z.infer<typeof emergencyAdminStatusSchema>

export const emergencyAdminSetupSchema = z.object({
  password: z.string().min(8).max(128),
})

export type EmergencyAdminSetup = z.infer<typeof emergencyAdminSetupSchema>

export const setupProgressEventSchema = z.object({
  type: z.enum(["stage", "complete", "error"]),
  phase: z.string(),
  message: z.string(),
  progress: z.number().min(0).max(100),
})

export type SetupProgressEvent = z.infer<typeof setupProgressEventSchema>
