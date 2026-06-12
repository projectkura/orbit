import { createFileRoute } from "@tanstack/react-router"
import { dispatchApiRequest } from "@/lib/api-dispatch"

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
        return dispatchApiRequest(
          request,
          `/api/v1/workspaces/${encodeURIComponent(params.identifier)}/api-keys/${encodeURIComponent(params.keyId)}`
        )
      },
    },
  },
})
