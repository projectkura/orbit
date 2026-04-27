import {
  emergencyAdminEmail,
  emergencyAdminStatusSchema,
  emergencyAdminUsername,
  setupProgressEventSchema,
  type EmergencyAdminStatus,
  type SetupProgressEvent,
} from "@orbit/shared"
import { getMigrations } from "better-auth/db/migration"
import { auth } from "./auth"
import { db } from "./db"
import { getEmergencyAdminStatus } from "./emergency-admin"

type MigrationState = Awaited<ReturnType<typeof getMigrations>>

function formatSetupError(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim()
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error.trim()
  }

  return "Unknown setup error"
}

async function assertDatabaseReachable() {
  await db.query("select 1")
}

async function getMigrationState() {
  return getMigrations(auth.options)
}

function requiresDatabaseSetup(migrations: MigrationState) {
  return migrations.toBeCreated.length > 0 || migrations.toBeAdded.length > 0
}

function isUserTableMissing(migrations: MigrationState) {
  return migrations.toBeCreated.some((entry) => entry.table === "user")
}

function summarizeMigrations(migrations: MigrationState) {
  const tableCount = migrations.toBeCreated.length
  const columnCount = migrations.toBeAdded.reduce(
    (count, entry) => count + Object.keys(entry.fields).length,
    0
  )

  if (tableCount === 0 && columnCount === 0) {
    return "Database schema is ready."
  }

  const parts: string[] = []

  if (tableCount > 0) {
    parts.push(`${tableCount} table${tableCount === 1 ? "" : "s"} to create`)
  }

  if (columnCount > 0) {
    parts.push(`${columnCount} column${columnCount === 1 ? "" : "s"} to add`)
  }

  return `Database setup required: ${parts.join(", ")}.`
}

function emitProgress(
  onProgress: (event: SetupProgressEvent) => void,
  event: SetupProgressEvent
) {
  onProgress(setupProgressEventSchema.parse(event))
}

export async function getSetupStatus(): Promise<EmergencyAdminStatus> {
  try {
    await assertDatabaseReachable()
  } catch (error) {
    return emergencyAdminStatusSchema.parse({
      freshInstall: true,
      hasEmergencyAdmin: false,
      databaseReachable: false,
      requiresDatabaseSetup: true,
      canBootstrap: true,
      statusMessage: formatSetupError(error),
    })
  }

  try {
    const migrations = await getMigrationState()
    const pendingSetup = requiresDatabaseSetup(migrations)

    if (pendingSetup && isUserTableMissing(migrations)) {
      return emergencyAdminStatusSchema.parse({
        freshInstall: true,
        hasEmergencyAdmin: false,
        databaseReachable: true,
        requiresDatabaseSetup: true,
        canBootstrap: true,
        statusMessage: summarizeMigrations(migrations),
      })
    }

    const status = await getEmergencyAdminStatus()

    return emergencyAdminStatusSchema.parse({
      ...status,
      databaseReachable: true,
      requiresDatabaseSetup: pendingSetup,
      canBootstrap: status.freshInstall,
      statusMessage: pendingSetup ? summarizeMigrations(migrations) : null,
    })
  } catch (error) {
    return emergencyAdminStatusSchema.parse({
      freshInstall: true,
      hasEmergencyAdmin: false,
      databaseReachable: true,
      requiresDatabaseSetup: true,
      canBootstrap: true,
      statusMessage: formatSetupError(error),
    })
  }
}

export async function runEmergencyAdminBootstrap(
  password: string,
  onProgress: (event: SetupProgressEvent) => void
) {
  emitProgress(onProgress, {
    type: "stage",
    phase: "database",
    message: "Checking database connection.",
    progress: 10,
  })
  await assertDatabaseReachable()

  emitProgress(onProgress, {
    type: "stage",
    phase: "schema-check",
    message: "Inspecting the auth schema.",
    progress: 24,
  })
  const migrations = await getMigrationState()

  if (requiresDatabaseSetup(migrations)) {
    emitProgress(onProgress, {
      type: "stage",
      phase: "migrations",
      message: summarizeMigrations(migrations),
      progress: 38,
    })
    await migrations.runMigrations()
    emitProgress(onProgress, {
      type: "stage",
      phase: "migrations-complete",
      message: "Database migrations finished.",
      progress: 68,
    })
  } else {
    emitProgress(onProgress, {
      type: "stage",
      phase: "migrations-complete",
      message: "Database schema is already up to date.",
      progress: 68,
    })
  }

  emitProgress(onProgress, {
    type: "stage",
    phase: "verification",
    message: "Verifying the install state.",
    progress: 78,
  })
  const status = await getSetupStatus()

  if (!status.freshInstall) {
    throw new Error("This Orbit instance is already initialized.")
  }

  if (status.hasEmergencyAdmin) {
    throw new Error("The recovery admin already exists for this instance.")
  }

  emitProgress(onProgress, {
    type: "stage",
    phase: "admin",
    message: "Creating the master admin account.",
    progress: 88,
  })
  await auth.api.signUpEmail({
    body: {
      name: emergencyAdminUsername,
      email: emergencyAdminEmail,
      password,
    },
  })

  emitProgress(onProgress, {
    type: "complete",
    phase: "done",
    message: "Orbit is ready. Signing in as the new admin next.",
    progress: 100,
  })
}

export { formatSetupError }
