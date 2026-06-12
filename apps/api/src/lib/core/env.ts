import { getApiEnv, type ApiEnv } from "@orbit/config"

let cached: ApiEnv | null = null

export const apiEnv: ApiEnv = new Proxy({} as ApiEnv, {
  get(_, prop) {
    if (!cached) {
      cached = getApiEnv()
    }
    return Reflect.get(cached, prop)
  },
})
