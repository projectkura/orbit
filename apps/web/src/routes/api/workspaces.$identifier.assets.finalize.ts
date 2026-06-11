import { createFileRoute } from "@tanstack/react-router"
import { getWebServerEnv } from "@/lib/server-env"

export const Route = createFileRoute("/api/workspaces/$identifier/assets/finalize")({
  server: {
    handlers: {
      POST: async ({ request, params }: { request: Request; params: { identifier: string } }) => {
        const webServerEnv = getWebServerEnv()
        const response = await fetch(
          `${webServerEnv.apiUrl}/api/v1/workspaces/${params.identifier}/assets/finalize`,
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
    },
  },
})
