import "../core/env"
import { Pool } from "pg"
import { drizzle } from "drizzle-orm/node-postgres"
import * as schema from "./schema"

declare global {
  var orbitPgPool: Pool | undefined
}

const env = (globalThis as Record<string, unknown>).__env__ as
  | Record<string, unknown>
  | undefined
const hyperdrive = env?.HYPERDRIVE as
  | { connectionString?: string }
  | undefined
const connectionString =
  hyperdrive?.connectionString || process.env.DATABASE_URL

export const db =
  globalThis.orbitPgPool ??
  new Pool({
    connectionString,
    ssl:
      process.env.DATABASE_SSL === "true"
        ? {
            rejectUnauthorized: false,
          }
        : undefined,
  })

if (process.env.NODE_ENV !== "production") {
  globalThis.orbitPgPool = db
}

export const drizzleDb = drizzle(db, { schema })
