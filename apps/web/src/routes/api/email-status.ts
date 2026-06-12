import { createFileRoute } from "@tanstack/react-router"
import { dispatchApiRequest } from "@/lib/api-dispatch"

export const Route = createFileRoute("/api/email-status")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        return dispatchApiRequest(request, "/api/v1/admin/email-status")
      },
    },
  },
})
