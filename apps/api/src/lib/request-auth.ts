import type { OrbitSessionUser } from "@orbit/shared"
import { verifyInternalServiceToken } from "@orbit/shared"
import { auth } from "./auth"
import { apiEnv } from "./env"

export async function requireAdminSession(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  })
  const user = session?.user as OrbitSessionUser | undefined

  if (!user || user.role !== "admin") {
    throw new Response("Unauthorized", { status: 401 })
  }

  return user
}

export function requireInternalRequest(request: Request, scope: string) {
  const header = request.headers.get("authorization")

  if (!header?.startsWith("Bearer ")) {
    throw new Response("Unauthorized", { status: 401 })
  }

  verifyInternalServiceToken(header.slice("Bearer ".length), apiEnv.internalJwtSecret, {
    iss: "orbit-web",
    aud: "orbit-api",
    scope,
  })
}
