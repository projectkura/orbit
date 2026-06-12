import { createFileRoute } from "@tanstack/react-router"
import { dispatchApiRequest } from "@/lib/api-dispatch"

export const Route = createFileRoute("/health")({
  server: {
    handlers: {
      GET: async () => {
        return dispatchApiRequest(new Request("http://orbit.local/health"))
      },
    },
  },
})
