import { createFileRoute } from "@tanstack/react-router"
import { getWebServerEnv } from "@/lib/server-env"

export const Route = createFileRoute("/api/workspaces/$identifier/assets/$assetId")({
  server: {
    handlers: {
      POST: async ({
        request,
        params,
      }: {
        request: Request
        params: { identifier: string; assetId: string }
      }) => {
        const webServerEnv = getWebServerEnv()
        const response = await fetch(
          `${webServerEnv.apiUrl}/api/v1/workspaces/${encodeURIComponent(params.identifier)}/assets/${encodeURIComponent(params.assetId)}/cancel`,
          {
            method: "POST",
            headers: request.headers,
            body: await request.text(),
          }
        )

        return new Response(response.body, {
          status: response.status,
          headers: response.headers,
        })
      },
      DELETE: async ({ request }: { request: Request }) => {
        const webServerEnv = getWebServerEnv()
        const url = new URL(request.url)
        const path = url.pathname.slice("/api/workspaces/".length)
        const response = await fetch(
          `${webServerEnv.apiUrl}/api/v1/workspaces/${path}`,
          {
            method: "DELETE",
            headers: request.headers,
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
