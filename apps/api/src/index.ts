import { runDatabaseMigrations } from "./lib/db/migrations"
import { apiEnv } from "./lib/core/env"
import { handleRequest } from "./router"
import { getCorsOrigin } from "./routes/utils"
import { getDragonflyClient } from "./lib/core/dragonfly"

await runDatabaseMigrations()

// Eagerly connect to Dragonfly on startup so the health check reflects the
// real connection state from the first request.
getDragonflyClient()

Bun.serve({
  port: apiEnv.port,
  async fetch(request) {
    if (request.method === "OPTIONS") {
      const origin = getCorsOrigin(request)
      if (!origin) return new Response(null, { status: 403 })
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Credentials": "true",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
          Vary: "Origin",
        },
      })
    }
    return handleRequest(request)
  },
})

console.log("Orbit API listening on " + apiEnv.apiUrl)
