import { createFileRoute } from "@tanstack/react-router"
import { getWebServerEnv } from "@/lib/server-env"

export const Route = createFileRoute("/api/workspaces/$identifier/usage")({
  server: {
    handlers: {
      GET: async ({ request, params }: { request: Request; params: { identifier: string } }) => {
        const webServerEnv = getWebServerEnv()
        const response = await fetch(
          `${webServerEnv.apiUrl}/api/v1/workspaces/${params.identifier}/usage`,
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
    },
  },
})
