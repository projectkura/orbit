import type { OrbitSessionUser } from "@orbit/shared"
import { auth } from "./index"

export async function requireSession(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  })
  const user = session?.user as OrbitSessionUser | undefined

  if (!user) {
    throw new Response("Unauthorized", { status: 401 })
  }

  return user
}

export async function requireAdminSession(request: Request) {
  const user = await requireSession(request)

  if (user.role !== "admin") {
    throw new Response("Unauthorized", { status: 401 })
  }

  return user
}
