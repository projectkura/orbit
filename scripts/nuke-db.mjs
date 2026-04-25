import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { config } from "dotenv"
import { Pool } from "pg"

const candidates = [
  resolve(process.cwd(), "apps/api/.env.local"),
  resolve(process.cwd(), "apps/api/.env"),
  resolve(process.cwd(), ".env.local"),
  resolve(process.cwd(), ".env"),
]

for (const path of candidates) {
  if (existsSync(path)) {
    config({ path, override: false, quiet: true })
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing")
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DATABASE_SSL === "true"
      ? {
          rejectUnauthorized: false,
        }
      : undefined,
})

const client = await pool.connect()

try {
  const result = await client.query("select current_schema() as schema_name")

  const schema = result.rows[0]?.schema_name ?? "public"
  const safeSchema = String(schema).replaceAll('"', '""')

  console.log(`Nuking PostgreSQL schema: ${schema}`)

  await client.query("begin")
  await client.query(`drop schema if exists \"${safeSchema}\" cascade`)
  await client.query(`create schema \"${safeSchema}\"`)

  if (schema === "public") {
    await client.query("grant all on schema public to public")
    await client.query("grant all on schema public to current_user")
  }

  await client.query("commit")

  console.log("Database schema dropped and recreated successfully.")
} catch (error) {
  await client.query("rollback")
  throw error
} finally {
  client.release()
  await pool.end()
}
