import { apiEnv } from "./env"

export const orbitConfig = {
  appName: apiEnv.appName,
  appUrl: apiEnv.apiUrl,
  webUrl: apiEnv.webUrl,
} as const
