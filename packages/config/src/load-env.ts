import { existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { parse } from "dotenv"

const moduleDir = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(moduleDir, "../../..")

let envLoaded = false

// Detect Cloudflare Workers runtime (no filesystem available)
const isWorkersRuntime =
  typeof globalThis.caches !== "undefined" &&
  typeof process === "undefined"

function loadFile(path: string, inheritedKeys: ReadonlySet<string>) {
  if (!existsSync(path)) {
    return
  }

  const parsed = parse(readFileSync(path, "utf8"))

  for (const [key, value] of Object.entries(parsed)) {
    if (inheritedKeys.has(key)) {
      continue
    }

    process.env[key] = value
  }
}

export function getProjectRoot() {
  return projectRoot
}

export function loadRootEnv() {
  if (envLoaded) {
    return
  }

  // In Cloudflare Workers, env vars are injected at runtime via wrangler.toml
  // or the dashboard — there's no filesystem to read .env files from.
  if (isWorkersRuntime) {
    envLoaded = true
    return
  }

  const inheritedKeys = new Set(Object.keys(process.env))

  loadFile(resolve(projectRoot, ".env"), inheritedKeys)
  loadFile(resolve(projectRoot, ".env.local"), inheritedKeys)

  envLoaded = true
}
