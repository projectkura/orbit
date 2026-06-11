import { apiEnv } from "../lib/core/env"

export function getCorsOrigin(request: Request) {
  const origin = request.headers.get("origin")

  if (!origin) {
    return null
  }

  return origin === apiEnv.webUrl || origin === apiEnv.apiUrl ? origin : null
}

export function withCors(response: Response, request: Request) {
  const origin = getCorsOrigin(request)

  if (!origin) {
    return response
  }

  const headers = new Headers(response.headers)
  headers.set("Access-Control-Allow-Origin", origin)
  headers.set("Access-Control-Allow-Credentials", "true")
  headers.set("Vary", "Origin")

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

export function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init)
}

export function getClientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  )
}

type RateEntry = { count: number; firstAttemptAt: number }
const apiRateAttempts = new Map<string, RateEntry>()

export function takeRateLimit(
  bucket: string,
  limit: number,
  windowMs: number
) {
  const now = Date.now()
  const existing = apiRateAttempts.get(bucket)

  if (!existing || now - existing.firstAttemptAt > windowMs) {
    apiRateAttempts.set(bucket, { count: 1, firstAttemptAt: now })
    return null
  }

  if (existing.count >= limit) {
    const retryAfterMs = windowMs - (now - existing.firstAttemptAt)
    return Math.max(1, Math.ceil(retryAfterMs / 1000))
  }

  existing.count += 1
  return null
}

export function enforceApiRateLimit(
  request: Request,
  scope: string,
  limit = 20,
  windowMs = 60 * 1000
) {
  const retryAfter = takeRateLimit(
    `${scope}:${getClientIp(request)}`,
    limit,
    windowMs
  )

  if (!retryAfter) {
    return null
  }

  return json(
    { message: "Too many requests. Try again shortly." },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfter) },
    }
  )
}
