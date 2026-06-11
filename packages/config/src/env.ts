import { z } from "zod"
import { loadRootEnv } from "./load-env"

export type OrbitConfigMode = "memory" | "edge"

export type ApiEnv = {
  port: number
  appName: string
  configMode: OrbitConfigMode
  apiUrl: string
  webUrl: string
  cookieDomain?: string
  databaseUrl: string
  databaseSsl: boolean
  betterAuthSecret: string
  passkeyRpId: string
  passkeyRpName: string
  passkeyOrigin: string
  resendApiKey?: string
  vercelEdgeConfig?: string
  vercelEdgeConfigStoreId?: string
  vercelApiToken?: string
  vercelEdgeConfigItemKey: string
  r2AccountId?: string
  r2AccessKeyId?: string
  r2SecretAccessKey?: string
  r2Bucket?: string
  r2PublicUrl?: string
  dragonflyUrl?: string
}

export type WebServerEnv = {
  apiUrl: string
  publicApiUrl: string
}

const apiEnvSchema = z.object({
  ORBIT_API_PORT: z.coerce.number().int().positive(),
  ORBIT_APP_NAME: z.string().min(1),
  ORBIT_CONFIG_MODE: z.enum(["memory", "edge"]),
  ORBIT_API_URL: z.string().url(),
  ORBIT_WEB_URL: z.string().url(),
  ORBIT_COOKIE_DOMAIN: z.string().optional(),
  DATABASE_URL: z.string().min(1),
  DATABASE_SSL: z.enum(["true", "false"]),
  BETTER_AUTH_SECRET: z.string().min(1),
  PASSKEY_RP_ID: z.string().optional(),
  PASSKEY_RP_NAME: z.string().optional(),
  PASSKEY_ORIGIN: z.string().url().optional(),
  RESEND_API_KEY: z.string().optional(),
  ORBIT_VERCEL_EDGE_CONFIG: z.string().optional(),
  ORBIT_VERCEL_EDGE_CONFIG_STORE_ID: z.string().optional(),
  ORBIT_VERCEL_API_TOKEN: z.string().optional(),
  ORBIT_VERCEL_EDGE_CONFIG_ITEM_KEY: z.string().min(1),
  ORBIT_R2_ACCOUNT_ID: z.string().optional(),
  ORBIT_R2_ACCESS_KEY_ID: z.string().optional(),
  ORBIT_R2_SECRET_ACCESS_KEY: z.string().optional(),
  ORBIT_R2_BUCKET: z.string().optional(),
  ORBIT_R2_PUBLIC_URL: z.string().url().optional(),
  DRAGONFLY_URL: z.string().optional(),
})

const webEnvSchema = z.object({
  ORBIT_API_URL: z.string().url(),
  ORBIT_API_INTERNAL_URL: z.string().url(),
})

let cachedApiEnv: ApiEnv | null = null
let cachedWebEnv: WebServerEnv | null = null

function normalizeEnvValue(value: string | undefined) {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : undefined
}

function formatEnvError(label: string, error: z.ZodError) {
  const details = error.issues
    .map((issue) => {
      const path = issue.path.join(".") || "unknown"
      return `- ${path}: ${issue.message}`
    })
    .join("\n")

  return new Error(`Invalid ${label} environment:\n${details}`)
}

function parseWithSchema<T>(
  label: string,
  schema: z.ZodType<T>,
  input: Record<string, string | number | undefined>
) {
  const result = schema.safeParse(input)

  if (!result.success) {
    throw formatEnvError(label, result.error)
  }

  return result.data
}

function isProduction() {
  return process.env.NODE_ENV === "production"
}

export function resolveConfigMode(input?: string | null): OrbitConfigMode {
  return input === "edge" ? "edge" : "memory"
}

export function getApiEnv(): ApiEnv {
  loadRootEnv()

  if (cachedApiEnv) {
    return cachedApiEnv
  }

  const port = Number(normalizeEnvValue(process.env.ORBIT_API_PORT) ?? "3001")
  const defaultApiUrl = !isProduction() ? `http://localhost:${port}` : undefined
  const defaultWebUrl = !isProduction() ? "http://localhost:3000" : undefined

  const parsed = parseWithSchema("API", apiEnvSchema, {
    ORBIT_API_PORT: port,
    ORBIT_APP_NAME: normalizeEnvValue(process.env.ORBIT_APP_NAME) ?? "Orbit",
    ORBIT_CONFIG_MODE:
      normalizeEnvValue(process.env.ORBIT_CONFIG_MODE) ?? "memory",
    ORBIT_API_URL: normalizeEnvValue(process.env.ORBIT_API_URL) ?? defaultApiUrl,
    ORBIT_WEB_URL: normalizeEnvValue(process.env.ORBIT_WEB_URL) ?? defaultWebUrl,
    ORBIT_COOKIE_DOMAIN: normalizeEnvValue(process.env.ORBIT_COOKIE_DOMAIN),
    DATABASE_URL: normalizeEnvValue(process.env.DATABASE_URL),
    DATABASE_SSL: normalizeEnvValue(process.env.DATABASE_SSL) ?? "false",
    BETTER_AUTH_SECRET: normalizeEnvValue(process.env.BETTER_AUTH_SECRET),
    PASSKEY_RP_ID: normalizeEnvValue(process.env.PASSKEY_RP_ID),
    PASSKEY_RP_NAME: normalizeEnvValue(process.env.PASSKEY_RP_NAME),
    PASSKEY_ORIGIN: normalizeEnvValue(process.env.PASSKEY_ORIGIN),
    RESEND_API_KEY: normalizeEnvValue(process.env.RESEND_API_KEY),
    ORBIT_VERCEL_EDGE_CONFIG: normalizeEnvValue(
      process.env.ORBIT_VERCEL_EDGE_CONFIG
    ),
    ORBIT_VERCEL_EDGE_CONFIG_STORE_ID: normalizeEnvValue(
      process.env.ORBIT_VERCEL_EDGE_CONFIG_STORE_ID
    ),
    ORBIT_VERCEL_API_TOKEN: normalizeEnvValue(
      process.env.ORBIT_VERCEL_API_TOKEN
    ),
    ORBIT_VERCEL_EDGE_CONFIG_ITEM_KEY:
      normalizeEnvValue(process.env.ORBIT_VERCEL_EDGE_CONFIG_ITEM_KEY) ??
      "instance-config",
    ORBIT_R2_ACCOUNT_ID: normalizeEnvValue(process.env.ORBIT_R2_ACCOUNT_ID),
    ORBIT_R2_ACCESS_KEY_ID: normalizeEnvValue(
      process.env.ORBIT_R2_ACCESS_KEY_ID
    ),
    ORBIT_R2_SECRET_ACCESS_KEY: normalizeEnvValue(
      process.env.ORBIT_R2_SECRET_ACCESS_KEY
    ),
    ORBIT_R2_BUCKET: normalizeEnvValue(process.env.ORBIT_R2_BUCKET),
    ORBIT_R2_PUBLIC_URL: normalizeEnvValue(process.env.ORBIT_R2_PUBLIC_URL),
    DRAGONFLY_URL: normalizeEnvValue(process.env.DRAGONFLY_URL),
  })

  const webHost = new URL(parsed.ORBIT_WEB_URL).hostname

  cachedApiEnv = {
    port: parsed.ORBIT_API_PORT,
    appName: parsed.ORBIT_APP_NAME,
    configMode: resolveConfigMode(parsed.ORBIT_CONFIG_MODE),
    apiUrl: parsed.ORBIT_API_URL,
    webUrl: parsed.ORBIT_WEB_URL,
    cookieDomain: parsed.ORBIT_COOKIE_DOMAIN,
    databaseUrl: parsed.DATABASE_URL,
    databaseSsl: parsed.DATABASE_SSL === "true",
    betterAuthSecret: parsed.BETTER_AUTH_SECRET,
    passkeyRpId: parsed.PASSKEY_RP_ID ?? webHost,
    passkeyRpName: parsed.PASSKEY_RP_NAME ?? parsed.ORBIT_APP_NAME,
    passkeyOrigin: parsed.PASSKEY_ORIGIN ?? parsed.ORBIT_WEB_URL,
    resendApiKey: parsed.RESEND_API_KEY,
    vercelEdgeConfig: parsed.ORBIT_VERCEL_EDGE_CONFIG,
    vercelEdgeConfigStoreId: parsed.ORBIT_VERCEL_EDGE_CONFIG_STORE_ID,
    vercelApiToken: parsed.ORBIT_VERCEL_API_TOKEN,
    vercelEdgeConfigItemKey: parsed.ORBIT_VERCEL_EDGE_CONFIG_ITEM_KEY,
    r2AccountId: parsed.ORBIT_R2_ACCOUNT_ID,
    r2AccessKeyId: parsed.ORBIT_R2_ACCESS_KEY_ID,
    r2SecretAccessKey: parsed.ORBIT_R2_SECRET_ACCESS_KEY,
    r2Bucket: parsed.ORBIT_R2_BUCKET,
    r2PublicUrl: parsed.ORBIT_R2_PUBLIC_URL,
    dragonflyUrl: parsed.DRAGONFLY_URL,
  }

  return cachedApiEnv
}

export function getWebEnv(): WebServerEnv {
  loadRootEnv()

  if (cachedWebEnv) {
    return cachedWebEnv
  }

  const defaultApiUrl = !isProduction() ? "http://localhost:3001" : undefined
  const publicApiUrl =
    normalizeEnvValue(process.env.ORBIT_API_URL) ?? defaultApiUrl
  const internalApiUrl =
    normalizeEnvValue(process.env.ORBIT_API_INTERNAL_URL) ?? publicApiUrl

  const parsed = parseWithSchema("web", webEnvSchema, {
    ORBIT_API_URL: publicApiUrl,
    ORBIT_API_INTERNAL_URL: internalApiUrl,
  })

  cachedWebEnv = {
    apiUrl: parsed.ORBIT_API_INTERNAL_URL,
    publicApiUrl: parsed.ORBIT_API_URL,
  }

  return cachedWebEnv
}
