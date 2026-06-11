import { Hono } from "hono"
import { cors } from "hono/cors"
import { AwsClient } from "aws4fetch"

// Deprecated: the API-owned upload intent/finalize flow is the supported path.
type Bindings = {
  R2_ACCESS_KEY_ID: string
  R2_SECRET_ACCESS_KEY: string
  AUTH_SECRET: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use(
  "*",
  cors({
    origin: ["http://localhost:3000", "https://orbit.walteria.net"],
    allowMethods: ["POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
)

app.post("/presign", async (c) => {
  const authHeader = c.req.header("Authorization")
  const token = authHeader?.replace("Bearer ", "")
  
  if (!token || token !== c.env.AUTH_SECRET) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  const { key, contentType } = await c.req.json()
  
  if (!key || !contentType) {
    return c.json({ error: "Missing key or contentType" }, 400)
  }

  const r2 = new AwsClient({
    accessKeyId: c.env.R2_ACCESS_KEY_ID,
    secretAccessKey: c.env.R2_SECRET_ACCESS_KEY,
  })

  // Your Cloudflare Account ID
  const accountId = "550a4cdba4f336d289b5c39db4ceb9bc"
  const url = new URL(
    `https://${accountId}.r2.cloudflarestorage.com/orbit/${key}`
  )
  
  // Set expiration for the presigned URL (5 minutes)
  url.searchParams.set("X-Amz-Expires", "300")

  // Generate the signed request with caching headers
  const signed = await r2.sign(
    new Request(url.toString(), {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    }),
    { aws: { signQuery: true } }
  )

  return c.json({
    uploadUrl: signed.url,
    method: "PUT",
    headers: { "Content-Type": contentType },
  })
})

export default app
