import { randomBytes } from "node:crypto"
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeFileSync,
} from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { parse } from "dotenv"

type RuntimeSecrets = {
  ORBIT_INTERNAL_JWT_SECRET: string
  BETTER_AUTH_SECRET: string
}

const moduleDir = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(moduleDir, "../..")
const projectRoot = resolve(webRoot, "../..")

function resolveRuntimeDir() {
  if (process.env.ORBIT_RUNTIME_DIR) {
    return process.env.ORBIT_RUNTIME_DIR
  }

  return process.env.NODE_ENV === "production"
    ? "/var/lib/orbit"
    : resolve(projectRoot, ".orbit-runtime")
}

function getRuntimeSecretsPath() {
  return resolve(resolveRuntimeDir(), "generated-secrets.env")
}

function readRuntimeSecrets(path: string): Partial<RuntimeSecrets> {
  if (!existsSync(path)) {
    return {}
  }

  return parse(readFileSync(path, "utf8")) as Partial<RuntimeSecrets>
}

function createSecret() {
  return randomBytes(32).toString("hex")
}

function serializeRuntimeSecrets(secrets: RuntimeSecrets) {
  return [
    "# Generated automatically by Orbit. Persist this file.",
    `ORBIT_INTERNAL_JWT_SECRET=${secrets.ORBIT_INTERNAL_JWT_SECRET}`,
    `BETTER_AUTH_SECRET=${secrets.BETTER_AUTH_SECRET}`,
    "",
  ].join("\n")
}

function persistRuntimeSecrets(path: string, secrets: RuntimeSecrets) {
  mkdirSync(dirname(path), { recursive: true })

  if (!existsSync(path)) {
    try {
      const fd = openSync(path, "wx")
      writeFileSync(fd, serializeRuntimeSecrets(secrets), "utf8")
      closeSync(fd)
      return secrets
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code

      if (code !== "EEXIST") {
        throw error
      }
    }
  }

  const existing = readRuntimeSecrets(path)
  const next: RuntimeSecrets = {
    ORBIT_INTERNAL_JWT_SECRET:
      existing.ORBIT_INTERNAL_JWT_SECRET ?? secrets.ORBIT_INTERNAL_JWT_SECRET,
    BETTER_AUTH_SECRET: existing.BETTER_AUTH_SECRET ?? secrets.BETTER_AUTH_SECRET,
  }

  if (
    next.ORBIT_INTERNAL_JWT_SECRET !== existing.ORBIT_INTERNAL_JWT_SECRET ||
    next.BETTER_AUTH_SECRET !== existing.BETTER_AUTH_SECRET
  ) {
    writeFileSync(path, serializeRuntimeSecrets(next), "utf8")
  }

  return next
}

export function loadWebRuntimeSecrets() {
  const runtimeDir = resolveRuntimeDir()
  const secretsPath = getRuntimeSecretsPath()
  const existing = readRuntimeSecrets(secretsPath)

  const generated: RuntimeSecrets = {
    ORBIT_INTERNAL_JWT_SECRET:
      process.env.ORBIT_INTERNAL_JWT_SECRET ??
      existing.ORBIT_INTERNAL_JWT_SECRET ??
      createSecret(),
    BETTER_AUTH_SECRET:
      process.env.BETTER_AUTH_SECRET ?? existing.BETTER_AUTH_SECRET ?? createSecret(),
  }

  const resolved = !process.env.ORBIT_INTERNAL_JWT_SECRET
    ? persistRuntimeSecrets(secretsPath, generated)
    : generated

  process.env.ORBIT_RUNTIME_DIR ??= runtimeDir
  process.env.ORBIT_INTERNAL_JWT_SECRET ??= resolved.ORBIT_INTERNAL_JWT_SECRET
}
