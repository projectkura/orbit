import { apiEnv } from "./env"

export function getOrbitConfig() {
  return {
    appName: apiEnv.appName,
    appUrl: apiEnv.apiUrl,
    webUrl: apiEnv.webUrl,
  } as const
}

export const orbitConfig = new Proxy({} as { appName: string; appUrl: string; webUrl: string }, {
  get(_, prop) {
    return Reflect.get(getOrbitConfig(), prop)
  },
})
