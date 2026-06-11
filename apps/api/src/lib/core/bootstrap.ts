import {
  masterAdminEmail,
  masterAdminStatusSchema,
  masterAdminUsername,
  setupProgressEventSchema,
  type MasterAdminStatus,
  type SetupProgressEvent,
} from "@orbit/shared"
import { auth } from "../auth"
import { db } from "../db/connection"
import { getMigrationState, runDatabaseMigrations } from "../db/migrations"
import { getMasterAdminStatus } from "./master-admin"

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

function requiresDatabaseSetup(migrations: Awaited<ReturnType<typeof getMigrationState>>) {
  return migrations.pending > 0
}

function summarizeMigrations(
  migrations: Awaited<ReturnType<typeof getMigrationState>>
) {
  if (migrations.pending === 0) {
    return "Database schema is ready."
  }

  return `Database setup required: ${migrations.pending} migration${
    migrations.pending === 1 ? "" : "s"
  } pending.`
}

function emitProgress(
  onProgress: (event: SetupProgressEvent) => void,
  event: SetupProgressEvent
) {
  onProgress(setupProgressEventSchema.parse(event))
}

export async function getSetupStatus(): Promise<MasterAdminStatus> {
  try {
    await assertDatabaseReachable()
  } catch (error) {
    return masterAdminStatusSchema.parse({
      freshInstall: true,
      hasMasterAdmin: false,
      databaseReachable: false,
      requiresDatabaseSetup: true,
      canBootstrap: true,
      statusMessage: formatSetupError(error),
    })
  }

  try {
    const migrations = await getMigrationState()
    const pendingSetup = requiresDatabaseSetup(migrations)

    const status = await getMasterAdminStatus()

    return masterAdminStatusSchema.parse({
      ...status,
      databaseReachable: true,
      requiresDatabaseSetup: pendingSetup,
      canBootstrap: status.freshInstall,
      statusMessage: pendingSetup ? summarizeMigrations(migrations) : null,
    })
  } catch (error) {
    return masterAdminStatusSchema.parse({
      freshInstall: true,
      hasMasterAdmin: false,
      databaseReachable: true,
      requiresDatabaseSetup: true,
      canBootstrap: true,
      statusMessage: formatSetupError(error),
    })
  }
}

export async function runMasterAdminBootstrap(
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
    await runDatabaseMigrations()
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

  if (status.hasMasterAdmin) {
    throw new Error("The master admin already exists for this instance.")
  }

  emitProgress(onProgress, {
    type: "stage",
    phase: "admin",
    message: "Creating the master admin account.",
    progress: 88,
  })
  await auth.api.signUpEmail({
    body: {
      name: masterAdminUsername,
      email: masterAdminEmail,
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
