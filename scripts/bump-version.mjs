import { readFile, writeFile } from "node:fs/promises"

const targets = [
  "package.json",
  "apps/api/package.json",
  "apps/web/package.json",
  "packages/config/package.json",
  "packages/shared/package.json",
]

const bump = process.argv[2]

if (!bump || !["patch", "minor", "major"].includes(bump)) {
  console.error("Usage: node ./scripts/bump-version.mjs <patch|minor|major>")
  process.exit(1)
}

function nextVersion(current, kind) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(current)

  if (!match) {
    throw new Error(`Unsupported version format: ${current}`)
  }

  let [, major, minor, patch] = match
  let nextMajor = Number(major)
  let nextMinor = Number(minor)
  let nextPatch = Number(patch)

  if (kind === "major") {
    nextMajor += 1
    nextMinor = 0
    nextPatch = 0
  } else if (kind === "minor") {
    nextMinor += 1
    nextPatch = 0
  } else {
    nextPatch += 1
  }

  return `${nextMajor}.${nextMinor}.${nextPatch}`
}

const rootPackage = JSON.parse(await readFile("package.json", "utf8"))
const version = nextVersion(rootPackage.version, bump)

for (const target of targets) {
  const json = JSON.parse(await readFile(target, "utf8"))
  json.version = version
  await writeFile(target, `${JSON.stringify(json, null, 2)}\n`)
}

console.log(version)
