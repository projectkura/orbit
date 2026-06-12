import { defineNitroConfig } from "nitro/config"

const preset = process.env.NITRO_PRESET || "cloudflare-module"

export default defineNitroConfig({
  preset,
})
