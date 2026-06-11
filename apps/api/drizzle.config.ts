import { loadRootEnv } from "@orbit/config"
import { defineConfig } from "drizzle-kit"

loadRootEnv()

export default defineConfig({
  out: "./drizzle",
  schema: "./src/lib/db/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
})
