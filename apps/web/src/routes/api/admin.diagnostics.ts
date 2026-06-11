import { createFileRoute } from "@tanstack/react-router"
import { getWebServerEnv } from "@/lib/server-env"

export const Route = createFileRoute("/api/admin/diagnostics")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const webServerEnv = getWebServerEnv()
        const response = await fetch(
          `${webServerEnv.apiUrl}/api/v1/admin/diagnostics`,
          {
            method: "GET",
            headers: request.headers,
          }
        )
        return response
      },
    },
  },
})
