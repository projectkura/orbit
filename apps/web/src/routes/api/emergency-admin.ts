import { createFileRoute } from "@tanstack/react-router"
import { createInternalServiceToken } from "@orbit/shared"
import { getWebServerEnv } from "@/lib/server-env"

function buildInternalHeaders(request: Request, scope: string) {
  const webServerEnv = getWebServerEnv()

  return {
    Authorization: `Bearer ${createInternalServiceToken(
      {
        iss: "orbit-web",
        aud: "orbit-api",
        scope: [scope],
      },
      webServerEnv.internalJwtSecret
    )}`,
    Cookie: request.headers.get("cookie") ?? "",
    "Content-Type": request.headers.get("content-type") ?? "application/json",
  }
}

export const Route = createFileRoute("/api/emergency-admin")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const webServerEnv = getWebServerEnv()
        const response = await fetch(
          `${webServerEnv.apiUrl}/internal/v1/emergency-admin`,
          {
            method: "GET",
            headers: buildInternalHeaders(request, "emergency-admin:manage"),
          }
        )

        return new Response(response.body, {
          status: response.status,
          headers: response.headers,
        })
      },
      POST: async ({ request }: { request: Request }) => {
        const webServerEnv = getWebServerEnv()
        const response = await fetch(
          `${webServerEnv.apiUrl}/internal/v1/emergency-admin`,
          {
            method: "POST",
            headers: buildInternalHeaders(request, "emergency-admin:manage"),
            body: await request.text(),
          }
        )

        return new Response(response.body, {
          status: response.status,
          headers: response.headers,
        })
      },
    },
  },
})
