import { createFileRoute } from "@tanstack/react-router"
import { getWebServerEnv } from "@/lib/server-env"

export const Route = createFileRoute("/api/resend-template/$templateId")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const webServerEnv = getWebServerEnv()
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

        const response = await fetch(
          `${webServerEnv.apiUrl}/api/v1/admin/resend/templates/${encodeURIComponent(
            templateId
          )}`,
          {
            method: "GET",
            headers: {
              Cookie: request.headers.get("cookie") ?? "",
            },
          }
        )

        return new Response(response.body, {
          status: response.status,
          headers: response.headers,
        })
      },
    },
  },
})
