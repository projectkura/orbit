import { createFileRoute } from "@tanstack/react-router"
import { getWebServerEnv } from "@/lib/server-env"

export const Route = createFileRoute("/api/workspaces/$identifier")({
  server: {
    handlers: {
      GET: async ({ request, params }: { request: Request; params: { identifier: string } }) => {
        const webServerEnv = getWebServerEnv()
        const response = await fetch(
          `${webServerEnv.apiUrl}/api/v1/workspaces/${params.identifier}`,
          {
            method: "GET",
            headers: request.headers,
          }
        )

        return new Response(response.body, {
          status: response.status,
          headers: response.headers,
        })
      },
      PATCH: async ({ request, params }: { request: Request; params: { identifier: string } }) => {
        const webServerEnv = getWebServerEnv()
        const response = await fetch(
          `${webServerEnv.apiUrl}/api/v1/workspaces/${params.identifier}`,
          {
            method: "PATCH",
            headers: request.headers,
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
