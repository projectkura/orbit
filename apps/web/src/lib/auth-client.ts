import { passkeyClient } from "@better-auth/passkey/client"
import { createAuthClient } from "better-auth/react"
import { genericOAuthClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
  basePath: "/api/auth",
  fetchOptions: {
    credentials: "include",
  },
  plugins: [genericOAuthClient(), passkeyClient()],
})
