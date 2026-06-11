import { createFileRoute } from "@tanstack/react-router"
import { getWebServerEnv } from "@/lib/server-env"

export const Route = createFileRoute("/api/workspaces")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const webServerEnv = getWebServerEnv()
        const response = await fetch(`${webServerEnv.apiUrl}/api/v1/workspaces`, {
          method: "GET",
          headers: request.headers,
        })

        return new Response(response.body, {
          status: response.status,
          headers: response.headers,
        })
      },
      POST: async ({ request }: { request: Request }) => {
        const webServerEnv = getWebServerEnv()
        const response = await fetch(`${webServerEnv.apiUrl}/api/v1/workspaces`, {
          method: "POST",
          headers: request.headers,
          body: await request.text(),
        })

        return new Response(response.body, {
          status: response.status,
          headers: response.headers,
        })
      },
    },
  },
})
