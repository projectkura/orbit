let ready: Promise<void> | null = null

function isCloudflareWorker() {
  return typeof globalThis.caches !== "undefined"
}

export function prepareApiRuntime() {
  if (ready) {
    return ready
  }

  ready = (async () => {
    if (isCloudflareWorker()) {
      return
    }

    const { runDatabaseMigrations } = await import("./lib/db/migrations")
    const { getDragonflyClient } = await import("./lib/core/dragonfly")

    await runDatabaseMigrations()
    getDragonflyClient()
  })()

  return ready
}
