import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { db, drizzleDb } from "./connection"

const drizzleDir = resolve(import.meta.dirname, "../../../drizzle")

type MigrationJournal = {
  entries: Array<{
    idx: number
    when: number
    tag: string
    breakpoints: boolean
  }>
}

function readJournal(): MigrationJournal {
  const path = resolve(drizzleDir, "meta/_journal.json")
  return JSON.parse(readFileSync(path, "utf-8"))
}

function readMigrationSql(tag: string): string {
  const path = resolve(drizzleDir, `${tag}.sql`)
  return readFileSync(path, "utf-8")
}

async function readMigrationHashes() {
  const journal = readJournal()
  const entries = journal.entries ?? []

  const hashes = await Promise.all(
    entries.map(async (entry) => {
      const contents = readMigrationSql(entry.tag)
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
  await migrate(drizzleDb, { migrationsFolder: drizzleDir })
}
