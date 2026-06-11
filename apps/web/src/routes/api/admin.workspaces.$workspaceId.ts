import { createFileRoute } from "@tanstack/react-router"
import { getWebServerEnv } from "@/lib/server-env"

export const Route = createFileRoute("/api/admin/workspaces/$workspaceId")({
  server: {
    handlers: {
      PATCH: async ({
        request,
        params,
      }: {
        request: Request
        params: { workspaceId: string }
      }) => {
        const webServerEnv = getWebServerEnv()
        const response = await fetch(
          `${webServerEnv.apiUrl}/api/v1/admin/workspaces/${encodeURIComponent(params.workspaceId)}`,
          {
            method: "PATCH",
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
      DELETE: async ({
        request,
        params,
      }: {
        request: Request
        params: { workspaceId: string }
      }) => {
        const webServerEnv = getWebServerEnv()
        const response = await fetch(
          `${webServerEnv.apiUrl}/api/v1/admin/workspaces/${encodeURIComponent(params.workspaceId)}`,
          {
            method: "DELETE",
            headers: request.headers,
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
