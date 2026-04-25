import { createClient } from "@vercel/edge-config"
import {
  defaultInstanceConfig,
  instanceConfigUpdateSchema,
  normalizeInstanceConfig,
  storedInstanceConfigSchema,
  type InstanceConfig,
  type InstanceConfigUpdate,
  type StoredInstanceConfig,
} from "@orbit/shared"
import { db } from "./db"
import {
  getNonEmergencyUserCount,
  getTotalUserCount,
  hasEmergencyAdminAccount,
} from "./emergency-admin"
import { apiEnv } from "./env"

let memorySnapshot: StoredInstanceConfig | null = null

async function ensureTable() {
  await db.query(`
    create table if not exists instance_config (
      id text primary key,
      config_json jsonb not null,
      version integer not null default 1,
      updated_at timestamptz not null default now()
    )
  `)
}

function createDefaultStoredConfig(): StoredInstanceConfig {
  return {
    config: defaultInstanceConfig,
    version: 1,
    updatedAt: new Date().toISOString(),
  }
}

async function readFromDatabase(): Promise<StoredInstanceConfig> {
  await ensureTable()

  const result = await db.query(
    `select config_json, version, updated_at from instance_config where id = $1 limit 1`,
    ["default"]
  )

  const row = result.rows[0]

  if (!row) {
    const fallback = createDefaultStoredConfig()

    await db.query(
      `insert into instance_config (id, config_json, version, updated_at)
       values ($1, $2::jsonb, $3, $4::timestamptz)
       on conflict (id) do nothing`,
      [
        "default",
        JSON.stringify(fallback.config),
        fallback.version,
        fallback.updatedAt,
      ]
    )

    return fallback
  }

  return storedInstanceConfigSchema.parse({
    config: normalizeInstanceConfig(row.config_json),
    version: Number(row.version ?? 1),
    updatedAt: new Date(row.updated_at).toISOString(),
  })
}

async function writeToDatabase(
  update: InstanceConfigUpdate
): Promise<StoredInstanceConfig> {
  await ensureTable()

  const current = await readFromDatabase()
  const nextConfig: InstanceConfig = normalizeInstanceConfig({
    ...current.config,
    ...instanceConfigUpdateSchema.parse(update),
    onboardingComplete: true,
  })
  const next: StoredInstanceConfig = {
    config: nextConfig,
    version: current.version + 1,
    updatedAt: new Date().toISOString(),
  }

  await db.query(
    `insert into instance_config (id, config_json, version, updated_at)
     values ($1, $2::jsonb, $3, $4::timestamptz)
     on conflict (id)
     do update set
       config_json = excluded.config_json,
       version = excluded.version,
       updated_at = excluded.updated_at`,
    ["default", JSON.stringify(next.config), next.version, next.updatedAt]
  )

  return next
}

function getEdgeClient() {
  if (!apiEnv.vercelEdgeConfig) {
    return null
  }

  return createClient(apiEnv.vercelEdgeConfig)
}

async function readFromEdgeConfig(): Promise<StoredInstanceConfig | null> {
  const client = getEdgeClient()

  if (!client) {
    return null
  }

  try {
    const value = await client.get(apiEnv.vercelEdgeConfigItemKey)

    if (!value) {
      return null
    }

    return storedInstanceConfigSchema.parse(value)
  } catch {
    return null
  }
}

async function writeToEdgeConfig(config: StoredInstanceConfig) {
  if (!apiEnv.vercelEdgeConfigStoreId || !apiEnv.vercelApiToken) {
    return
  }

  const response = await fetch(
    `https://api.vercel.com/v1/edge-config/${apiEnv.vercelEdgeConfigStoreId}/items`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${apiEnv.vercelApiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [
          {
            operation: "upsert",
            key: apiEnv.vercelEdgeConfigItemKey,
            value: config,
          },
        ],
      }),
    }
  )

  if (!response.ok) {
    throw new Error(
      `Failed to sync Vercel Edge Config (${response.status})`
    )
  }
}

export async function getStoredInstanceConfig(): Promise<StoredInstanceConfig> {
  if (apiEnv.configMode === "edge") {
    const edgeValue = await readFromEdgeConfig()

    if (edgeValue) {
      memorySnapshot = edgeValue
      return edgeValue
    }
  }

  if (apiEnv.configMode === "memory" && memorySnapshot) {
    return memorySnapshot
  }

  const databaseValue = await readFromDatabase()
  memorySnapshot = databaseValue

  if (apiEnv.configMode === "edge") {
    try {
      await writeToEdgeConfig(databaseValue)
    } catch (error) {
      console.error("Failed to warm Vercel Edge Config", error)
    }
  }

  return databaseValue
}

export async function getRuntimeInstanceConfig(): Promise<InstanceConfig> {
  const stored = await getStoredInstanceConfig()
  return stored.config
}

export async function saveRuntimeInstanceConfig(
  update: InstanceConfigUpdate
): Promise<StoredInstanceConfig> {
  const next = await writeToDatabase(update)
  memorySnapshot = next

  if (apiEnv.configMode === "edge") {
    try {
      await writeToEdgeConfig(next)
    } catch (error) {
      console.error("Failed to sync Vercel Edge Config", error)
    }
  }

  return next
}

export async function isSignupAllowed(): Promise<boolean> {
  const config = await getRuntimeInstanceConfig()
  const [totalUserCount, nonEmergencyUserCount, hasEmergencyAdmin] = await Promise.all([
    getTotalUserCount(),
    getNonEmergencyUserCount(),
    hasEmergencyAdminAccount(),
  ])

  if (nonEmergencyUserCount === 0 && hasEmergencyAdmin) {
    return true
  }

  if (config.onboardingComplete) {
    return config.publicSignups
  }

  return totalUserCount === 0
}
