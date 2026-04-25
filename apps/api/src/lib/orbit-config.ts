import { apiEnv } from "./env"

export const orbitConfig = {
  appName: apiEnv.appName,
  deploymentMode: apiEnv.deploymentMode,
  appUrl: apiEnv.apiUrl,
  webUrl: apiEnv.webUrl,
} as const
