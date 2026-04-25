import { createFileRoute } from "@tanstack/react-router"
import { getWebServerEnv } from "@/lib/server-env"

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const webServerEnv = getWebServerEnv()
        const url = new URL(request.url)
        const target = `${webServerEnv.apiUrl}${url.pathname}${url.search}`
        const response = await fetch(target, {
          method: "GET",
          headers: request.headers,
        })

        return new Response(response.body, {
          status: response.status,
          headers: response.headers,
        })
      },
      POST: async ({ request }: { request: Request }) => {
        const webServerEnv = getWebServerEnv()
        const url = new URL(request.url)
        const target = `${webServerEnv.apiUrl}${url.pathname}${url.search}`
        const response = await fetch(target, {
          method: "POST",
          headers: request.headers,
          body: await request.text(),
        })

        return new Response(response.body, {
          status: response.status,
          headers: response.headers,
        })
      },
    },
  },
})
