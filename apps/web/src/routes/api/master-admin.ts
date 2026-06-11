import { createFileRoute } from "@tanstack/react-router"
import { getWebServerEnv } from "@/lib/server-env"

export const Route = createFileRoute("/api/master-admin")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const webServerEnv = getWebServerEnv()
        const response = await fetch(
          `${webServerEnv.apiUrl}/api/v1/setup/master-admin`,
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
      POST: async ({ request }: { request: Request }) => {
        const webServerEnv = getWebServerEnv()
        const response = await fetch(
          `${webServerEnv.apiUrl}/api/v1/setup/master-admin`,
          {
            method: "POST",
            headers: {
              Cookie: request.headers.get("cookie") ?? "",
              "Content-Type":
                request.headers.get("content-type") ?? "application/json",
            },
            body: await request.text(),
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
