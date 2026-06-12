import { createFileRoute } from "@tanstack/react-router"
import { dispatchApiRequest } from "@/lib/api-dispatch"

export const Route = createFileRoute("/api/users/me/onboarding")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        return dispatchApiRequest(request, "/api/v1/users/me/onboarding")
      },
      POST: async ({ request }: { request: Request }) => {
        return dispatchApiRequest(request, "/api/v1/users/me/onboarding")
      },
    },
  },
})
