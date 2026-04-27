import {
  emergencyAdminSetupSchema,
  instanceConfigUpdateSchema,
} from "@orbit/shared"
import { auth } from "./lib/auth"
import {
  formatSetupError,
  getSetupStatus,
  runEmergencyAdminBootstrap,
} from "./lib/bootstrap"
import {
  getRuntimeInstanceConfig,
  saveRuntimeInstanceConfig,
} from "./lib/config-store"
import { apiEnv } from "./lib/env"
import {
  requireAdminSession,
  requireInternalRequest,
} from "./lib/request-auth"

function getCorsOrigin(request: Request) {
  const origin = request.headers.get("origin")

  if (!origin) {
    return null
  }

  return origin === apiEnv.webUrl || origin === apiEnv.apiUrl ? origin : null
}

function withCors(response: Response, request: Request) {
  const origin = getCorsOrigin(request)

  if (!origin) {
    return response
  }

  const headers = new Headers(response.headers)
  headers.set("Access-Control-Allow-Origin", origin)
  headers.set("Access-Control-Allow-Credentials", "true")
  headers.set("Vary", "Origin")

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init)
}

function createSetupStream(password: string) {
  const encoder = new TextEncoder()

  return new Response(
    new ReadableStream({
      async start(controller) {
        const push = (payload: unknown) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`))
        }

        try {
          await runEmergencyAdminBootstrap(password, (event) => {
            push(event)
          })
        } catch (error) {
          push({
            type: "error",
            phase: "failed",
            message: formatSetupError(error),
            progress: 100,
          })
        } finally {
          controller.close()
        }
      },
    }),
    {
      headers: {
        "Cache-Control": "no-store, no-transform",
        Connection: "keep-alive",
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "X-Accel-Buffering": "no",
      },
    }
  )
}

Bun.serve({
  port: apiEnv.port,
  async fetch(request: Request) {
    const { pathname } = new URL(request.url)

    if (request.method === "OPTIONS") {
      const origin = getCorsOrigin(request)

      if (!origin) {
        return new Response(null, { status: 403 })
      }

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

    try {
      if (pathname === "/health") {
        return json({ ok: true, service: "api" })
      }

      if (pathname.startsWith("/api/auth/")) {
        return withCors(await auth.handler(request), request)
      }

      if (pathname === "/api/v1/public-config" && request.method === "GET") {
        const config = await getRuntimeInstanceConfig()
        return withCors(
          json({ homePageEnabled: config.homePageEnabled, domain: config.domain }),
          request
        )
      }

      if (pathname === "/internal/v1/instance-config") {
        requireInternalRequest(request, "instance-config:manage")
        await requireAdminSession(request)

        if (request.method === "GET") {
          return json(await getRuntimeInstanceConfig())
        }

        if (request.method === "PUT" || request.method === "POST") {
          const body = instanceConfigUpdateSchema.parse(await request.json())
          const stored = await saveRuntimeInstanceConfig(body)
          return json(stored.config)
        }

        return new Response("Method not allowed", { status: 405 })
      }

      if (pathname === "/internal/v1/emergency-admin") {
        requireInternalRequest(request, "emergency-admin:manage")

        if (request.method === "GET") {
          return json(await getSetupStatus())
        }

        if (request.method === "POST") {
          const body = emergencyAdminSetupSchema.parse(await request.json())
          return createSetupStream(body.password)
        }

        return new Response("Method not allowed", { status: 405 })
      }

      if (pathname === "/api/v1/instance-config") {
        await requireAdminSession(request)

        if (request.method === "GET") {
          return withCors(json(await getRuntimeInstanceConfig()), request)
        }

        if (request.method === "PUT" || request.method === "POST") {
          const body = instanceConfigUpdateSchema.parse(await request.json())
          const stored = await saveRuntimeInstanceConfig(body)
          return withCors(json(stored.config), request)
        }

        return new Response("Method not allowed", { status: 405 })
      }

      return new Response("Not found", { status: 404 })
    } catch (error) {
      if (error instanceof Response) {
        return error
      }

      console.error(error)
      return new Response("Internal server error", { status: 500 })
    }
  },
})

console.log(`Orbit API listening on ${apiEnv.apiUrl}`)
