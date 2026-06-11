import { getRuntimeInstanceConfig } from "../lib/core/config-store"
import { json } from "./utils"

export async function handlePublicConfig() {
  const config = await getRuntimeInstanceConfig()
  return json({ homePageEnabled: config.homePageEnabled, domain: config.domain })
}
