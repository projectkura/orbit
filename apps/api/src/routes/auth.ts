import { isMasterAdminEmail } from "@orbit/shared"
import { auth } from "../lib/auth"
import { getClientIp } from "./utils"

const MASTER_ADMIN_RATE_WINDOW_MS = 15 * 60 * 1000
const MASTER_ADMIN_RATE_LIMIT = 5
type RateEntry = { count: number; firstAttemptAt: number }
const masterAdminAttempts = new Map<string, RateEntry>()

function isMasterAdminRateLimited(ip: string) {
  const entry = masterAdminAttempts.get(ip)
  const now = Date.now()

  if (!entry) {
    return { limited: false as const, retryAfterSeconds: 0 }
  }

  if (now - entry.firstAttemptAt > MASTER_ADMIN_RATE_WINDOW_MS) {
    masterAdminAttempts.delete(ip)
    return { limited: false as const, retryAfterSeconds: 0 }
  }

  if (entry.count >= MASTER_ADMIN_RATE_LIMIT) {
    const retryAfterMs =
      MASTER_ADMIN_RATE_WINDOW_MS - (now - entry.firstAttemptAt)
    return {
      limited: true as const,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    }
  }

  return { limited: false as const, retryAfterSeconds: 0 }
}

function recordMasterAdminAttempt(ip: string, success: boolean) {
  if (success) {
    masterAdminAttempts.delete(ip)
    return
  }

  const now = Date.now()
  const existing = masterAdminAttempts.get(ip)

  if (!existing || now - existing.firstAttemptAt > MASTER_ADMIN_RATE_WINDOW_MS) {
    masterAdminAttempts.set(ip, { count: 1, firstAttemptAt: now })
    return
  }

  existing.count += 1
}

export async function maybeInterceptMasterAdminSignIn(request: Request) {
  const url = new URL(request.url)

  if (
    !url.pathname.startsWith("/api/auth/sign-in/email") ||
    request.method !== "POST"
  ) {
    return null
  }

  let payload: unknown

  try {
    payload = await request.clone().json()
  } catch {
    return null
  }

  const email =
    typeof payload === "object" && payload !== null && "email" in payload
      ? (payload as { email?: unknown }).email
      : null

  if (typeof email !== "string" || !isMasterAdminEmail(email)) {
    return null
  }

  const ip = getClientIp(request)
  const rate = isMasterAdminRateLimited(ip)

  if (rate.limited) {
    return new Response(
      JSON.stringify({
        message: `Too many attempts. Try again in ${Math.ceil(
          rate.retryAfterSeconds / 60
        )} minute(s).`,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(rate.retryAfterSeconds),
        },
      }
    )
  }

  const response = await auth.handler(request)
  recordMasterAdminAttempt(ip, response.ok)
  return response
}

export async function handleAuth(request: Request) {
  return await auth.handler(request)
}
