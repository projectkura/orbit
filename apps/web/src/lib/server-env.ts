import { existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { config } from "dotenv"
import { loadWebRuntimeSecrets } from "./runtime-secrets"

const moduleDir = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(moduleDir, "../..")
const projectRoot = resolve(webRoot, "../..")

const candidates = [
  resolve(webRoot, ".env.local"),
  resolve(webRoot, ".env"),
  resolve(projectRoot, ".env.local"),
  resolve(projectRoot, ".env"),
  resolve(process.cwd(), ".env.local"),
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "apps/web/.env.local"),
  resolve(process.cwd(), "apps/web/.env"),
]

for (const path of candidates) {
  if (existsSync(path)) {
    config({ path, override: false, quiet: true })
  }
}

loadWebRuntimeSecrets()

function required(name: string) {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

export function getWebServerEnv() {
  return {
    apiUrl:
      process.env.ORBIT_API_URL ??
      (process.env.NODE_ENV === "production" ? required("ORBIT_API_URL") : "http://localhost:3001"),
    internalJwtSecret: required("ORBIT_INTERNAL_JWT_SECRET"),
  }
}
