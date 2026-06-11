import { createHash } from "node:crypto"
import { eq } from "drizzle-orm"
import { getDragonflyClient } from "../core/dragonfly"
import { drizzleDb } from "../db/connection"
import { workspaceApiKeys, workspaces } from "../db/schema"

export interface ResolvedApiKey {
  keyId: string
  workspaceId: string
  name: string
  type: string
}

const CACHE_TTL_SECONDS = 24 * 60 * 60

export async function resolveApiKey(request: Request): Promise<ResolvedApiKey> {
  const header = request.headers.get("x-api-key")

  if (!header || !header.trim()) {
    throw new Response(JSON.stringify({ message: "API key is required." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  const secretHash = createHash("sha256").update(header.trim()).digest("hex")
  const redis = getDragonflyClient()
  const cacheKey = `apikey:${secretHash}`

  try {
    const cached = await redis.get(cacheKey)
    if (cached) {
      const parsed = JSON.parse(cached) as ResolvedApiKey
      void touchApiKeyLastUsed(parsed.keyId)
      return parsed
    }
  } catch {
    // cache miss or parse error — fall through to DB
  }

  const rows = await drizzleDb
    .select({
      id: workspaceApiKeys.id,
      workspaceId: workspaceApiKeys.workspaceId,
      name: workspaceApiKeys.name,
      type: workspaceApiKeys.type,
    })
    .from(workspaceApiKeys)
    .where(eq(workspaceApiKeys.secretHash, secretHash))
    .limit(1)

  const row = rows[0]

  if (!row) {
    throw new Response(JSON.stringify({ message: "Invalid API key." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  const resolved: ResolvedApiKey = {
    keyId: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    type: row.type,
  }

  try {
    await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(resolved))
  } catch {
    // cache write failure is non-fatal
  }

  void touchApiKeyLastUsed(row.id)
  return resolved
}

export async function invalidateApiKeyCache(secretHash: string) {
  const redis = getDragonflyClient()
  try {
    await redis.del(`apikey:${secretHash}`)
  } catch {
    // swallow
  }
}

export async function warmApiKeyCache(secretHash: string) {
  // Called after creation so the next lookup is instant
  // The actual data will be filled on first resolve
  const redis = getDragonflyClient()
  try {
    await redis.del(`apikey:${secretHash}`)
  } catch {
    // swallow
  }
}

function touchApiKeyLastUsed(keyId: string) {
  const now = new Date()
  drizzleDb
    .update(workspaceApiKeys)
    .set({ lastUsedAt: now })
    .where(eq(workspaceApiKeys.id, keyId))
    .catch((err) => {
      console.error("[api-key-auth] failed to update lastUsedAt:", err)
    })
}

export async function getWorkspaceById(workspaceId: string) {
  const rows = await drizzleDb
    .select({
      id: workspaces.id,
      name: workspaces.name,
      identifier: workspaces.identifier,
      storageTier: workspaces.storageTier,
      rateLimits: workspaces.rateLimits,
    })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1)

  return rows[0] ?? null
}
