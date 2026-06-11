import { createClient } from "@vercel/edge-config"
import { sql } from "drizzle-orm"
import {
  defaultInstanceConfig,
  instanceConfigUpdateSchema,
  normalizeInstanceConfig,
  storedInstanceConfigSchema,
  type InstanceConfig,
  type InstanceConfigUpdate,
  type StoredInstanceConfig,
} from "@orbit/shared"
import { eq } from "drizzle-orm"
import { drizzleDb } from "../db/connection"
import { instanceConfig } from "../db/schema"
import {
  getNonMasterAdminUserCount,
  getTotalUserCount,
  hasMasterAdminAccount,
} from "./master-admin"
import { apiEnv } from "./env"

let memorySnapshot: StoredInstanceConfig | null = null

function createDefaultStoredConfig(): StoredInstanceConfig {
  return {
    config: defaultInstanceConfig,
    version: 1,
    updatedAt: new Date().toISOString(),
  }
}

async function readFromDatabase(): Promise<StoredInstanceConfig> {
  const result = await drizzleDb
    .select()
    .from(instanceConfig)
    .where(eq(instanceConfig.id, "default"))
    .limit(1)

  const row = result[0]

  if (!row) {
    const fallback = createDefaultStoredConfig()

    await drizzleDb
      .insert(instanceConfig)
      .values({
        id: "default",
        configJson: fallback.config,
        version: fallback.version,
        updatedAt: new Date(fallback.updatedAt),
      })
      .onConflictDoNothing()

    return fallback
  }

  return storedInstanceConfigSchema.parse({
    config: normalizeInstanceConfig(row.configJson),
    version: Number(row.version ?? 1),
    updatedAt: new Date(row.updatedAt).toISOString(),
  })
}

async function writeToDatabase(
  update: InstanceConfigUpdate
): Promise<StoredInstanceConfig> {
  const current = await readFromDatabase()
  const parsedUpdate = instanceConfigUpdateSchema.parse(update)
  
  // Deep merge emailSettings to preserve all events
  const nextConfig: InstanceConfig = normalizeInstanceConfig({
    ...current.config,
    ...parsedUpdate,
    emailSettings: parsedUpdate.emailSettings ? {
      ...current.config.emailSettings,
      ...parsedUpdate.emailSettings,
    } : current.config.emailSettings,
    onboardingComplete: true,
  })
  const next: StoredInstanceConfig = {
    config: nextConfig,
    version: current.version + 1,
    updatedAt: new Date().toISOString(),
  }

  await drizzleDb
    .insert(instanceConfig)
    .values({
      id: "default",
      configJson: next.config,
      version: next.version,
      updatedAt: new Date(next.updatedAt),
    })
    .onConflictDoUpdate({
      target: instanceConfig.id,
      set: {
        configJson: next.config,
        version: next.version,
        updatedAt: sql`excluded.updated_at`,
      },
    })

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
  const [totalUserCount, nonMasterAdminUserCount, hasMasterAdmin] = await Promise.all([
    getTotalUserCount(),
    getNonMasterAdminUserCount(),
    hasMasterAdminAccount(),
  ])

  // Fresh install: allow master admin to be created.
  if (totalUserCount === 0) {
    return true
  }

  // Force onboarding completion before any new sign ups.
  if (!config.onboardingComplete) {
    return false
  }

  // Once onboarding is complete, allow the first user (who becomes the personal admin) to sign up regardless of publicSignups.
  if (nonMasterAdminUserCount === 0 && hasMasterAdmin) {
    return true
  }

  return config.publicSignups
}
