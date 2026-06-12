import { createFileRoute } from "@tanstack/react-router"
import { dispatchApiRequest } from "@/lib/api-dispatch"

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        return dispatchApiRequest(request)
      },
      POST: async ({ request }: { request: Request }) => {
        return dispatchApiRequest(request)
      },
    },
  },
})
