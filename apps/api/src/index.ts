import { Hono } from "hono"
import { handleRequest } from "./router"
import { getCorsOrigin } from "./routes/utils"
import { prepareApiRuntime } from "./runtime"

const app = new Hono()

app.all("*", async (c) => {
  const request = c.req.raw

  if (request.method === "OPTIONS") {
    const origin = getCorsOrigin(request)
    if (!origin) return new Response(null, { status: 403 })
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        Vary: "Origin",
      },
    })
  }
  return handleRequest(request)
})

await prepareApiRuntime()

export default {
  port: Number(process.env.PORT) || 3001,
  fetch: app.fetch,
}
