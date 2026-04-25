import "./env"
import { passkey } from "@better-auth/passkey"
import type { OAuth2Tokens } from "better-auth/oauth2"
import { betterAuth } from "better-auth"
import { genericOAuth } from "better-auth/plugins"
import { db } from "./db"
import {
  getNonEmergencyUserCount,
  getTotalUserCount,
  isEmergencyAdminEmail,
} from "./emergency-admin"
import { apiEnv } from "./env"
import { orbitConfig } from "./orbit-config"
import { isSignupAllowed } from "./config-store"

const placeholderEmailDomain = "orbit-auth.local"

function createPlaceholderEmail(provider: string, id: string) {
  return `${provider}-${id}@${placeholderEmailDomain}`
}

function normalizeUsername(value?: string | null) {
  if (!value) return undefined

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 32)

  return normalized || undefined
}

function emailLocalPart(email?: string | null) {
  return email?.split("@")[0]
}

function pickFirstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.length > 0) {
      return value
    }
  }

  return undefined
}

const googleConfigured =
  Boolean(process.env.GOOGLE_CLIENT_ID) &&
  Boolean(process.env.GOOGLE_CLIENT_SECRET)
const githubConfigured =
  Boolean(process.env.GITHUB_CLIENT_ID) &&
  Boolean(process.env.GITHUB_CLIENT_SECRET)
const discordConfigured =
  Boolean(process.env.DISCORD_CLIENT_ID) &&
  Boolean(process.env.DISCORD_CLIENT_SECRET)
const cfxConfigured =
  Boolean(process.env.CFX_CLIENT_ID) &&
  Boolean(process.env.CFX_CLIENT_SECRET) &&
  Boolean(
    process.env.CFX_DISCOVERY_URL ||
      (process.env.CFX_AUTHORIZATION_URL && process.env.CFX_TOKEN_URL)
  )

const genericOAuthProviders = cfxConfigured
  ? [
      {
        providerId: "cfx",
        clientId: process.env.CFX_CLIENT_ID as string,
        clientSecret: process.env.CFX_CLIENT_SECRET as string,
        discoveryUrl: process.env.CFX_DISCOVERY_URL,
        authorizationUrl: process.env.CFX_AUTHORIZATION_URL,
        tokenUrl: process.env.CFX_TOKEN_URL,
        userInfoUrl: process.env.CFX_USERINFO_URL,
        issuer: process.env.CFX_ISSUER,
        scopes: process.env.CFX_SCOPES?.split(",")
          .map((scope) => scope.trim())
          .filter(Boolean) ?? ["openid", "profile", "email"],
        pkce: true,
        overrideUserInfo: true,
        getUserInfo: async (tokens: OAuth2Tokens) => {
          const endpoint = process.env.CFX_USERINFO_URL

          if (!endpoint || !tokens.accessToken) {
            return null
          }

          const response = await fetch(endpoint, {
            headers: {
              Authorization: `Bearer ${tokens.accessToken}`,
            },
          })

          const profile = (await response.json()) as Record<string, unknown>
          const id = String(
            profile.sub ?? profile.id ?? profile.user_id ?? profile.identifier
          )
          const email =
            pickFirstString(profile.email) ?? createPlaceholderEmail("cfx", id)

          return {
            id,
            email,
            name:
              pickFirstString(
                profile.name,
                profile.username,
                profile.preferred_username
              ) ?? "CFX User",
            image: pickFirstString(
              profile.picture,
              profile.avatar_url,
              profile.avatar
            ),
            emailVerified:
              profile.email_verified === true || profile.verified === true,
          }
        },
        mapProfileToUser: async (profile: Record<string, unknown>) => {
          const id = String(
            profile.sub ?? profile.id ?? profile.user_id ?? profile.identifier
          )
          const email =
            pickFirstString(profile.email) ?? createPlaceholderEmail("cfx", id)

          return {
            email,
            username: normalizeUsername(
              pickFirstString(
                profile.preferred_username,
                profile.username,
                profile.name,
                emailLocalPart(email),
                id
              )
            ),
            emailVerified:
              profile.email_verified === true || profile.verified === true,
          }
        },
      },
    ]
  : []

export const auth = betterAuth({
  appName: orbitConfig.appName,
  baseURL: orbitConfig.appUrl,
  secret: apiEnv.betterAuthSecret,
  trustedOrigins: [orbitConfig.webUrl, orbitConfig.appUrl],
  crossSubDomainCookies: apiEnv.cookieDomain
    ? {
        enabled: true,
        domain: apiEnv.cookieDomain,
      }
    : undefined,
  database: db,
  emailAndPassword: {
    enabled: true,
  },
  disabledPaths: ["/sign-up/email"],
  account: {
    encryptOAuthTokens: true,
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
    },
  },
  user: {
    additionalFields: {
      username: {
        type: "string",
        required: false,
        input: false,
      },
      role: {
        type: ["user", "admin"],
        required: false,
        defaultValue: "user",
        input: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const [totalUserCount, nonEmergencyUserCount] = await Promise.all([
            getTotalUserCount(),
            getNonEmergencyUserCount(),
          ])
          const emergencyAdminSignup = isEmergencyAdminEmail(user.email)

          if (!emergencyAdminSignup && totalUserCount > 0 && !(await isSignupAllowed())) {
            return false
          }

          return {
            data: {
              ...user,
              name: emergencyAdminSignup ? "admin" : user.name,
              username: emergencyAdminSignup ? "admin" : user.username,
              role:
                emergencyAdminSignup || nonEmergencyUserCount === 0 ? "admin" : "user",
            },
          }
        },
      },
    },
  },
  socialProviders: {
    ...(googleConfigured
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID as string,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
            prompt: "select_account",
            accessType: "offline",
            overrideUserInfoOnSignIn: true,
            mapProfileToUser: (profile) => ({
              username: normalizeUsername(
                pickFirstString(
                  emailLocalPart(pickFirstString(profile.email)),
                  profile.name,
                  profile.given_name,
                  profile.sub
                )
              ),
            }),
          },
        }
      : {}),
    ...(githubConfigured
      ? {
          github: {
            clientId: process.env.GITHUB_CLIENT_ID as string,
            clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
            overrideUserInfoOnSignIn: true,
            mapProfileToUser: (profile) => {
              const email =
                pickFirstString(profile.email) ??
                createPlaceholderEmail("github", String(profile.id))

              return {
                email,
                username: normalizeUsername(
                  pickFirstString(
                    profile.login,
                    profile.name,
                    emailLocalPart(email),
                    String(profile.id)
                  )
                ),
              }
            },
          },
        }
      : {}),
    ...(discordConfigured
      ? {
          discord: {
            clientId: process.env.DISCORD_CLIENT_ID as string,
            clientSecret: process.env.DISCORD_CLIENT_SECRET as string,
            overrideUserInfoOnSignIn: true,
            mapProfileToUser: (profile) => {
              const email =
                pickFirstString(profile.email) ??
                createPlaceholderEmail("discord", String(profile.id))

              return {
                email,
                username: normalizeUsername(
                  pickFirstString(
                    profile.global_name,
                    profile.username,
                    profile.display_name,
                    emailLocalPart(email),
                    String(profile.id)
                  )
                ),
                emailVerified:
                  profile.verified === true || profile.email_verified === true,
              }
            },
          },
        }
      : {}),
  },
  plugins: [
    ...(genericOAuthProviders.length > 0
      ? [
          genericOAuth({
            config: genericOAuthProviders,
          }),
        ]
      : []),
    passkey({
      rpID: apiEnv.passkeyRpId,
      rpName: apiEnv.passkeyRpName,
      origin: apiEnv.passkeyOrigin,
    }),
  ],
})
