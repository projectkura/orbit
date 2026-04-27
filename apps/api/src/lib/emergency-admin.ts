import {
  emergencyAdminEmail,
  emergencyAdminName,
  emergencyAdminStatusSchema,
  emergencyAdminUsername,
  isEmergencyAdminEmail,
  type EmergencyAdminStatus,
} from "@orbit/shared"
import { db } from "./db"

async function getUserCount(query?: string, params: string[] = []) {
  const result = await db.query(query ?? 'select count(*)::int as count from "user"', params)
  return Number(result.rows[0]?.count ?? 0)
}

export async function getTotalUserCount() {
  return getUserCount()
}

export async function getNonEmergencyUserCount() {
  return getUserCount('select count(*)::int as count from "user" where email <> $1', [
    emergencyAdminEmail,
  ])
}

export async function hasEmergencyAdminAccount() {
  const result = await db.query(
    'select 1 from "user" where email = $1 limit 1',
    [emergencyAdminEmail]
  )

  return Boolean(result.rows[0])
}

export async function getEmergencyAdminStatus(): Promise<EmergencyAdminStatus> {
  const [totalUserCount, hasEmergencyAdmin] = await Promise.all([
    getTotalUserCount(),
    hasEmergencyAdminAccount(),
  ])

  return emergencyAdminStatusSchema.parse({
    databaseReachable: true,
    requiresDatabaseSetup: false,
    freshInstall: totalUserCount === 0,
    hasEmergencyAdmin,
    canBootstrap: totalUserCount === 0,
    statusMessage: null,
  })
}

export function getEmergencyAdminProfile() {
  return {
    email: emergencyAdminEmail,
    name: emergencyAdminName,
    username: emergencyAdminUsername,
  }
}

export { isEmergencyAdminEmail }
