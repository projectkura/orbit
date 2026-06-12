import { createFileRoute } from "@tanstack/react-router"
import { dispatchApiRequest } from "@/lib/api-dispatch"

export const Route = createFileRoute("/api/v1/$")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        return dispatchApiRequest(request)
      },
      POST: async ({ request }: { request: Request }) => {
        return dispatchApiRequest(request)
      },
      PUT: async ({ request }: { request: Request }) => {
        return dispatchApiRequest(request)
      },
      PATCH: async ({ request }: { request: Request }) => {
        return dispatchApiRequest(request)
      },
      DELETE: async ({ request }: { request: Request }) => {
        return dispatchApiRequest(request)
      },
    },
  },
})
