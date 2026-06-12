import { existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { parse } from "dotenv"

// Detect Cloudflare Workers runtime — no filesystem, no .env files
// navigator.userAgent is "Cloudflare-Workers" in Workers runtime
const isWorkersRuntime =
  typeof globalThis.caches !== "undefined" &&
  typeof navigator !== "undefined" &&
  navigator.userAgent === "Cloudflare-Workers"

let projectRoot = ""

if (!isWorkersRuntime) {
  try {
    const moduleDir = dirname(fileURLToPath(import.meta.url))
    projectRoot = resolve(moduleDir, "../../..")
  } catch {
    // import.meta.url may be undefined in some runtimes
  }
}

let envLoaded = false

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
