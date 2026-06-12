import { defineNitroConfig } from "nitro/config"

const preset = process.env.NITRO_PRESET || "cloudflare-module"

export default defineNitroConfig({
  preset,
  cloudflare: {
    wrangler: {
      hyperdrive: [
        {
          binding: "HYPERDRIVE",
          id: "d8c09949c5ac452a8e20a17d7125258c",
          localConnectionString: process.env.DATABASE_URL,
        },
      ],
    },
  },
})
