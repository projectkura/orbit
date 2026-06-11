import Redis from "ioredis"
import { apiEnv } from "./env"

let client: Redis | null = null
let connected = false

export function getDragonflyClient(): Redis {
  if (client) {
    return client
  }

  const url = apiEnv.dragonflyUrl

  if (!url) {
    console.warn(
      "[dragonfly] DRAGONFLY_URL is not configured. Rate limiting and API key caching are disabled."
    )
    connected = false
    return createNoOpClient()
  }

  client = new Redis(url, {
    lazyConnect: true,
    retryStrategy(times) {
      if (times > 5) {
        console.error("[dragonfly] Max reconnection attempts reached.")
        return null
      }
      return Math.min(times * 100, 3000)
    },
    maxRetriesPerRequest: 3,
  })

  client.on("error", (err) => {
    connected = false
    console.error("[dragonfly] connection error:", err.message)
  })

  client.on("connect", () => {
    connected = true
    console.log("[dragonfly] connected")
  })

  client.on("end", () => {
    connected = false
  })

  // Eagerly initiate the connection — without this, lazyConnect means the
  // 'connect' event never fires and isDragonflyConnected() always returns false.
  client.connect().catch(() => {
    // Errors are handled by the 'error' event listener above.
  })

  return client
}

export function isDragonflyConnected(): boolean {
  return connected
}

function createNoOpClient(): Redis {
  const handler = {
    get() {
      return () => Promise.resolve(null)
    },
  } as ProxyHandler<object>

  // @ts-expect-error Proxy target does not need to satisfy full Redis interface
  return new Proxy({} as Redis, handler)
}
