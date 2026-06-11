import { drizzleDb } from "./lib/db/connection"
import { sql } from "drizzle-orm"

function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

try {
  const result = await drizzleDb.execute(sql`SELECT count(*) FROM workspace_deletion_codes`)
  console.log("Table exists. Row count:", result.rows[0].count)
} catch (error) {
  console.error("Table does NOT exist or error:", formatError(error))
} finally {
  process.exit()
}
