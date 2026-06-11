import { db } from "./lib/db/connection"

function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

try {
  const result = await db.query(`SELECT * FROM drizzle.__drizzle_migrations`)
  console.log("Applied migrations:", result.rows)
} catch (error) {
  console.error("Error reading migrations table:", formatError(error))
} finally {
  process.exit()
}
