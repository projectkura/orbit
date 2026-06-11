import {
  isMasterAdminEmail,
  masterAdminEmail,
  masterAdminName,
  masterAdminStatusSchema,
  masterAdminUsername,
  type MasterAdminStatus,
} from "@orbit/shared"
import { count, eq, ne } from "drizzle-orm"
import { drizzleDb } from "../db/connection"
import { users } from "../db/schema"

export async function getTotalUserCount() {
  const result = await drizzleDb.select({ count: count() }).from(users)
  return Number(result[0]?.count ?? 0)
}

export async function getNonMasterAdminUserCount() {
  const result = await drizzleDb
    .select({ count: count() })
    .from(users)
    .where(ne(users.email, masterAdminEmail))

  return Number(result[0]?.count ?? 0)
}

export async function hasMasterAdminAccount() {
  const result = await drizzleDb
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, masterAdminEmail))
    .limit(1)

  return Boolean(result[0])
}

export async function getMasterAdminStatus(): Promise<MasterAdminStatus> {
  const [totalUserCount, hasMasterAdmin] = await Promise.all([
    getTotalUserCount(),
    hasMasterAdminAccount(),
  ])

  return masterAdminStatusSchema.parse({
    databaseReachable: true,
    requiresDatabaseSetup: false,
    freshInstall: totalUserCount === 0,
    hasMasterAdmin,
    canBootstrap: totalUserCount === 0,
    statusMessage: null,
  })
}

export function getMasterAdminProfile() {
  return {
    email: masterAdminEmail,
    name: masterAdminName,
    username: masterAdminUsername,
  }
}

export { isMasterAdminEmail }
