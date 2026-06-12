import { createFileRoute } from "@tanstack/react-router"
import { dispatchApiRequest } from "@/lib/api-dispatch"

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
        return dispatchApiRequest(
          request,
          `/api/v1/workspaces/${encodeURIComponent(params.identifier)}/assets/${encodeURIComponent(params.assetId)}/cancel`
        )
      },
      DELETE: async ({ request }: { request: Request }) => {
        return dispatchApiRequest(request)
      },
    },
  },
})
