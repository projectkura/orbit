import { existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { config } from "dotenv"
import {
  resolveConfigMode,
  resolveDeploymentMode,
} from "@orbit/config"
import { loadApiRuntimeSecrets } from "./runtime-secrets"

const moduleDir = dirname(fileURLToPath(import.meta.url))
const apiRoot = resolve(moduleDir, "../..")
const projectRoot = resolve(apiRoot, "../..")

const candidates = [
  resolve(apiRoot, ".env.local"),
  resolve(apiRoot, ".env"),
  resolve(projectRoot, ".env.local"),
  resolve(projectRoot, ".env"),
  resolve(process.cwd(), ".env.local"),
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "apps/api/.env.local"),
  resolve(process.cwd(), "apps/api/.env"),
]

for (const path of candidates) {
  if (existsSync(path)) {
    config({ path, override: false, quiet: true })
  }
}

loadApiRuntimeSecrets()

function required(name: string) {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

const port = Number(process.env.ORBIT_API_PORT ?? 3001)
const apiUrl =
  process.env.ORBIT_API_URL ??
  (process.env.NODE_ENV === "production" ? required("ORBIT_API_URL") : `http://localhost:${port}`)
const webUrl =
  process.env.ORBIT_WEB_URL ??
  (process.env.NODE_ENV === "production" ? required("ORBIT_WEB_URL") : "http://localhost:3000")
const webHost = new URL(webUrl).hostname

export const apiEnv = {
  port,
  appName: process.env.ORBIT_APP_NAME ?? "Orbit",
  deploymentMode: resolveDeploymentMode(process.env.ORBIT_DEPLOYMENT_MODE),
  configMode: resolveConfigMode(process.env.ORBIT_CONFIG_MODE),
  apiUrl,
  webUrl,
  cookieDomain: process.env.ORBIT_COOKIE_DOMAIN,
  internalJwtSecret: required("ORBIT_INTERNAL_JWT_SECRET"),
  databaseUrl: required("DATABASE_URL"),
  databaseSsl: process.env.DATABASE_SSL === "true",
  betterAuthSecret: required("BETTER_AUTH_SECRET"),
  passkeyRpId: process.env.PASSKEY_RP_ID ?? webHost,
  passkeyRpName: process.env.PASSKEY_RP_NAME ?? process.env.ORBIT_APP_NAME ?? "Orbit",
  passkeyOrigin: process.env.PASSKEY_ORIGIN ?? webUrl,
  vercelEdgeConfig: process.env.ORBIT_VERCEL_EDGE_CONFIG,
  vercelEdgeConfigStoreId: process.env.ORBIT_VERCEL_EDGE_CONFIG_STORE_ID,
  vercelApiToken: process.env.ORBIT_VERCEL_API_TOKEN,
  vercelEdgeConfigItemKey:
    process.env.ORBIT_VERCEL_EDGE_CONFIG_ITEM_KEY ?? "instance-config",
} as const
