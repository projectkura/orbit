import { apiEnv } from "../lib/core/env"
import { reapExpiredUploadIntents } from "../lib/storage/uploads"
import { json } from "./utils"

export async function handleUploads(request: Request, pathname: string) {
  if (pathname === "/internal/uploads/reap-stale") {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 })
    }

    if (
      request.headers.get("authorization") !== `Bearer ${apiEnv.betterAuthSecret}`
    ) {
      return new Response("Unauthorized", { status: 401 })
    }

    return json(await reapExpiredUploadIntents())
  }

  return null
}
