import { createFileRoute } from "@tanstack/react-router"
import { dispatchApiRequest } from "@/lib/api-dispatch"

export const Route = createFileRoute("/api/admin/workspaces/$workspaceId")({
  server: {
    handlers: {
      PATCH: async ({
        request,
        params,
      }: {
        request: Request
        params: { workspaceId: string }
      }) => {
        return dispatchApiRequest(
          request,
          `/api/v1/admin/workspaces/${encodeURIComponent(params.workspaceId)}`
        )
      },
      DELETE: async ({
        request,
        params,
      }: {
        request: Request
        params: { workspaceId: string }
      }) => {
        return dispatchApiRequest(
          request,
          `/api/v1/admin/workspaces/${encodeURIComponent(params.workspaceId)}`
        )
      },
    },
  },
})
