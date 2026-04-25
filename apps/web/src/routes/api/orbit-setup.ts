import { createFileRoute } from "@tanstack/react-router"
import { createInternalServiceToken } from "@orbit/shared"
import { getWebServerEnv } from "@/lib/server-env"

function buildInternalHeaders(request: Request) {
  const webServerEnv = getWebServerEnv()

  return {
    Authorization: `Bearer ${createInternalServiceToken(
      {
        iss: "orbit-web",
        aud: "orbit-api",
        scope: ["instance-config:manage"],
      },
      webServerEnv.internalJwtSecret
    )}`,
    Cookie: request.headers.get("cookie") ?? "",
    "Content-Type": request.headers.get("content-type") ?? "application/json",
  }
}

export const Route = createFileRoute("/api/orbit-setup")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const webServerEnv = getWebServerEnv()
        const response = await fetch(
          `${webServerEnv.apiUrl}/internal/v1/instance-config`,
          {
            method: "GET",
            headers: buildInternalHeaders(request),
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
          `${webServerEnv.apiUrl}/internal/v1/instance-config`,
          {
            method: "PUT",
            headers: buildInternalHeaders(request),
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
