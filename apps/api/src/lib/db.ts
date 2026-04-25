import "./env"
import { Pool } from "pg"

declare global {
  var orbitPgPool: Pool | undefined
}

export const db =
  globalThis.orbitPgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
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
