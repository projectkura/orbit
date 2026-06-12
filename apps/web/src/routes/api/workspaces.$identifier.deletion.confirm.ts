import { createFileRoute } from "@tanstack/react-router"
import { dispatchApiRequest } from "@/lib/api-dispatch"

export const Route = createFileRoute(
  "/api/workspaces/$identifier/deletion/confirm"
)({
  server: {
    handlers: {
      POST: async ({
        request,
        params,
      }: {
        request: Request
        params: { identifier: string }
      }) => {
        return dispatchApiRequest(
          request,
          `/api/v1/workspaces/${encodeURIComponent(params.identifier)}/deletion/confirm`
        )
      },
    },
  },
})
