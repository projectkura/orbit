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
})

export type EmergencyAdminStatus = z.infer<typeof emergencyAdminStatusSchema>

export const emergencyAdminSetupSchema = z.object({
  password: z.string().min(8).max(128),
})

export type EmergencyAdminSetup = z.infer<typeof emergencyAdminSetupSchema>
