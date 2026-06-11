import { createHash } from "node:crypto"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { db, drizzleDb } from "./connection"

// @ts-ignore - JSON import
import journal from "../../../drizzle/meta/_journal.json"

// Bundle SQL files as static imports (inlined by the bundler at build time)
// Each migration is dynamically imported to keep the bundle tree-shakeable
const migrationModules: Record<string, { default: string }> = {}

async function loadMigrationSql(tag: string): Promise<string> {
  if (migrationModules[tag]) {
    return migrationModules[tag].default
  }

  // Dynamic import for each migration SQL file
  // The bundler will resolve these at build time
  try {
    const mod = await import(`../../../drizzle/${tag}.sql`)
    migrationModules[tag] = mod
    return mod.default
  } catch {
    return ""
  }
}

type MigrationJournal = {
  entries: Array<{
    idx: number
    when: number
    tag: string
    breakpoints: boolean
  }>
}

async function readMigrationHashes() {
  const entries = (journal as MigrationJournal).entries ?? []

  const hashes = await Promise.all(
    entries.map(async (entry) => {
      const contents = await loadMigrationSql(entry.tag)
      return {
        tag: entry.tag,
        hash: createHash("sha256").update(contents).digest("hex"),
      }
    })
  )

  return hashes
}

export async function getMigrationState() {
  const migrations = await readMigrationHashes()
  if (migrations.length === 0) {
    return { total: 0, pending: 0 }
  }
  const result = await db.query(
    `select hash from drizzle.__drizzle_migrations`
  ).catch(() => ({ rows: [] as Array<{ hash: string }> }))
  const applied = new Set(result.rows.map((row) => row.hash))
  const pending = migrations.filter((migration) => !applied.has(migration.hash))
  return { total: migrations.length, pending: pending.length }
}

export async function runDatabaseMigrations() {
  await migrate(drizzleDb, { migrationsFolder: "../../../drizzle" })
}
