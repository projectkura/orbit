import { createFileRoute } from "@tanstack/react-router"
import { dispatchApiRequest } from "@/lib/api-dispatch"

export const Route = createFileRoute("/api/resend-template/$templateId")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const url = new URL(request.url)
        const templateId = decodeURIComponent(
          url.pathname.slice("/api/resend-template/".length)
        )

        if (!templateId) {
          return new Response(
            JSON.stringify({ message: "Template ID is required." }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          )
        }

        return dispatchApiRequest(
          request,
          `/api/v1/admin/resend/templates/${encodeURIComponent(templateId)}`
        )
      },
    },
  },
})
