import { createFileRoute } from "@tanstack/react-router"
import { dispatchApiRequest } from "@/lib/api-dispatch"

export const Route = createFileRoute("/api/instance-config")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        return dispatchApiRequest(request, "/api/v1/admin/instance-config")
      },
      POST: async ({ request }: { request: Request }) => {
        return dispatchApiRequest(
          new Request(request.url, {
            method: "PUT",
            headers: request.headers,
            body: await request.text(),
          }),
          "/api/v1/admin/instance-config"
        )
      },
    },
  },
})
