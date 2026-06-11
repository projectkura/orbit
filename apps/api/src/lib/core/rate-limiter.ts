import { getDragonflyClient, isDragonflyConnected } from "./dragonfly"
import type { InstanceConfig, WorkspaceRateLimits } from "@orbit/shared"

export type RateLimitBucket =
  | "api_requests_per_minute"
  | "api_requests_per_month"
  | "network_egress_bytes_per_month"
  | "storage_bytes_max"

const WINDOW_SECONDS: Record<RateLimitBucket, number> = {
  api_requests_per_minute: 60,
  api_requests_per_month: 0,
  network_egress_bytes_per_month: 0,
  storage_bytes_max: 0,
}

export interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  resetAt: number
}

function getWindowKey(bucket: RateLimitBucket, now = Date.now()): string {
  if (bucket === "api_requests_per_minute") {
    const minuteBlock = Math.floor(now / 60_000)
    return String(minuteBlock)
  }
  if (bucket === "api_requests_per_month") {
    const d = new Date(now)
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
  }
  return "all"
}

function getResetAt(bucket: RateLimitBucket, now = Date.now()): number {
  if (bucket === "api_requests_per_minute") {
    return (Math.floor(now / 60_000) + 1) * 60_000
  }
  if (bucket === "api_requests_per_month") {
    const d = new Date(now)
    const nextMonth = d.getUTCMonth() + 1
    const nextYear = d.getUTCFullYear() + (nextMonth > 11 ? 1 : 0)
    return Date.UTC(nextYear, nextMonth % 12, 1, 0, 0, 0, 0)
  }
  return now + 60_000
}

// In-memory fallback when Dragonfly is unavailable
// key -> { count, expiresAt }
const memCounters = new Map<string, { count: number; expiresAt: number }>()

function memGet(key: string): number {
  const entry = memCounters.get(key)
  if (!entry) return 0
  if (Date.now() > entry.expiresAt) {
    memCounters.delete(key)
    return 0
  }
  return entry.count
}

function memIncr(key: string, ttlMs: number): number {
  const now = Date.now()
  const existing = memCounters.get(key)
  if (!existing || now > existing.expiresAt) {
    const count = 1
    memCounters.set(key, { count, expiresAt: now + ttlMs })
    return count
  }
  existing.count += 1
  return existing.count
}

export async function checkRateLimit(
  workspaceId: string,
  bucket: RateLimitBucket,
  limit: number
): Promise<RateLimitResult> {
  const windowKey = getWindowKey(bucket)
  const redisKey = `rl:${workspaceId}:${bucket}:${windowKey}`
  const now = Date.now()

  if (limit <= 0) {
    return { allowed: false, limit: 0, remaining: 0, resetAt: getResetAt(bucket, now) }
  }

  // If Dragonfly is not connected, use in-memory fallback
  if (!isDragonflyConnected()) {
    const ttlMs =
      bucket === "api_requests_per_minute"
        ? 60_000
        : bucket === "api_requests_per_month"
          ? getResetAt(bucket, now) - now
          : 60_000
    const count = memIncr(redisKey, ttlMs)
    const remaining = Math.max(0, limit - count)
    return {
      allowed: count <= limit,
      limit,
      remaining,
      resetAt: getResetAt(bucket, now),
    }
  }

  const redis = getDragonflyClient()

  try {
    const pipeline = redis.pipeline()
    pipeline.incr(redisKey)
    pipeline.pttl(redisKey)

    const results = await pipeline.exec()
    if (!results) {
      return { allowed: true, limit, remaining: limit, resetAt: getResetAt(bucket, now) }
    }

    const count = Number(results[0]?.[1] ?? 0)
    const ttl = Number(results[1]?.[1] ?? -1)

    if (ttl === -1) {
      const windowSec = WINDOW_SECONDS[bucket]
      if (windowSec > 0) {
        await redis.pexpire(redisKey, windowSec * 1000)
      } else {
        await redis.pexpire(redisKey, getResetAt(bucket, now) - now)
      }
    }

    const remaining = Math.max(0, limit - count)
    const allowed = count <= limit

    return {
      allowed,
      limit,
      remaining,
      resetAt: getResetAt(bucket, now),
    }
  } catch {
    return { allowed: true, limit, remaining: limit, resetAt: getResetAt(bucket, now) }
  }
}

export function resolveWorkspaceRateLimits(
  storageTier: "free" | "pro",
  workspaceLimits: WorkspaceRateLimits | null,
  instanceConfig: InstanceConfig
): Record<RateLimitBucket, number> {
  const defaults = instanceConfig.rateLimitSettings?.[storageTier] ?? {}

  return {
    api_requests_per_minute:
      workspaceLimits?.apiRequestsPerMinute ?? defaults.apiRequestsPerMinute ?? 60,
    api_requests_per_month:
      workspaceLimits?.apiRequestsPerMonth ?? defaults.apiRequestsPerMonth ?? 10_000,
    network_egress_bytes_per_month:
      workspaceLimits?.networkEgressBytesPerMonth ?? defaults.networkEgressBytesPerMonth ?? 0,
    storage_bytes_max:
      workspaceLimits?.storageBytesMax ?? defaults.storageBytesMax ?? 0,
  }
}

export async function getRateLimitCounters(
  workspaceId: string,
  limits: Record<RateLimitBucket, number>
): Promise<Record<RateLimitBucket, { used: number; remaining: number; resetAt: number }>> {
  const now = Date.now()
  const entries = Object.entries(limits) as [RateLimitBucket, number][]
  const result: Record<
    RateLimitBucket,
    { used: number; remaining: number; resetAt: number }
  > = {
    api_requests_per_minute: { used: 0, remaining: 0, resetAt: 0 },
    api_requests_per_month: { used: 0, remaining: 0, resetAt: 0 },
    network_egress_bytes_per_month: { used: 0, remaining: 0, resetAt: 0 },
    storage_bytes_max: { used: 0, remaining: 0, resetAt: 0 },
  }

  // In-memory fallback
  if (!isDragonflyConnected()) {
    for (const [bucket, limit] of entries) {
      const windowKey = getWindowKey(bucket, now)
      const redisKey = `rl:${workspaceId}:${bucket}:${windowKey}`
      const used = memGet(redisKey)
      result[bucket] = {
        used,
        remaining: Math.max(0, limit - used),
        resetAt: getResetAt(bucket, now),
      }
    }
    return result
  }

  const redis = getDragonflyClient()
  const pipeline = redis.pipeline()
  const keys: { bucket: RateLimitBucket; key: string; limit: number }[] = []

  for (const [bucket, limit] of entries) {
    const windowKey = getWindowKey(bucket, now)
    const redisKey = `rl:${workspaceId}:${bucket}:${windowKey}`
    keys.push({ bucket, key: redisKey, limit })
    pipeline.get(redisKey)
  }

  try {
    const execResults = await pipeline.exec()
    if (execResults) {
      keys.forEach((k, i) => {
        const used = Number(execResults[i]?.[1] ?? 0)
        result[k.bucket] = {
          used,
          remaining: Math.max(0, k.limit - used),
          resetAt: getResetAt(k.bucket, now),
        }
      })
    }
  } catch {
    // swallow
  }

  return result
}
