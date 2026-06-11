import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { db, drizzleDb } from "./connection"

type MigrationJournal = {
  entries: Array<{
    idx: number
    when: number
    tag: string
    breakpoints: boolean
  }>
}

const migrationsFolder = resolve(import.meta.dirname, "../../../drizzle")
const journalPath = resolve(migrationsFolder, "meta/_journal.json")

function readJournal(): MigrationJournal {
  if (!existsSync(journalPath)) {
    return { entries: [] }
  }

  return JSON.parse(readFileSync(journalPath, "utf8")) as MigrationJournal
}

function readMigrationHashes() {
  return readJournal().entries.map((entry) => {
    const sqlPath = resolve(migrationsFolder, `${entry.tag}.sql`)
    const contents = readFileSync(sqlPath, "utf8")

    return {
      tag: entry.tag,
      hash: createHash("sha256").update(contents).digest("hex"),
    }
  })
}

export async function getMigrationState() {
  const migrations = readMigrationHashes()

  if (migrations.length === 0) {
    return {
      total: 0,
      pending: 0,
    }
  }

  const result = await db.query(
    `select hash from drizzle.__drizzle_migrations`
  ).catch(() => ({ rows: [] as Array<{ hash: string }> }))
  const applied = new Set(result.rows.map((row) => row.hash))
  const pending = migrations.filter((migration) => !applied.has(migration.hash))

  return {
    total: migrations.length,
    pending: pending.length,
  }
}

export async function runDatabaseMigrations() {
  await migrate(drizzleDb, { migrationsFolder })
}
