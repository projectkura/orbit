import { migrate } from "drizzle-orm/node-postgres/migrator"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { drizzleDb } from "./lib/db/connection"

const moduleDir = dirname(fileURLToPath(import.meta.url))

await migrate(drizzleDb, {
  migrationsFolder: resolve(moduleDir, "../drizzle"),
})

console.log("Drizzle migrations applied.")
