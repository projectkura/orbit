import { createFileRoute } from "@tanstack/react-router"
import { getWebServerEnv } from "@/lib/server-env"

export const Route = createFileRoute("/api/public-config")({
  server: {
    handlers: {
      GET: async () => {
        const webServerEnv = getWebServerEnv()
        const response = await fetch(`${webServerEnv.apiUrl}/api/v1/public-config`)

        return new Response(response.body, {
          status: response.status,
          headers: response.headers,
        })
      },
    },
  },
})
