import { createFileRoute } from "@tanstack/react-router"
import { getWebServerEnv } from "@/lib/server-env"

export const Route = createFileRoute(
  "/api/workspaces/$identifier/api-keys/$keyId"
)({
  server: {
    handlers: {
      DELETE: async ({
        request,
        params,
      }: {
        request: Request
        params: { identifier: string; keyId: string }
      }) => {
        const webServerEnv = getWebServerEnv()
        const response = await fetch(
          `${webServerEnv.apiUrl}/api/v1/workspaces/${encodeURIComponent(params.identifier)}/api-keys/${encodeURIComponent(params.keyId)}`,
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
