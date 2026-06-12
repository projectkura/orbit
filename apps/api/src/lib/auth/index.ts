import "../core/env"
import { passkey } from "@better-auth/passkey"
import type { OAuth2Tokens } from "better-auth/oauth2"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { genericOAuth } from "better-auth/plugins"
import { drizzleDb } from "../db/connection"
import * as schema from "../db/schema"
import {
  getNonMasterAdminUserCount,
  getTotalUserCount,
  isMasterAdminEmail,
} from "../core/master-admin"
import { apiEnv } from "../core/env"
import { orbitConfig } from "../core/orbit-config"
import { isSignupAllowed } from "../core/config-store"

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

function splitFullName(value?: string | null) {
  const normalized = value?.trim()

  if (!normalized) {
    return {}
  }

  const parts = normalized.split(/\s+/).filter(Boolean)

  if (parts.length === 0) {
    return {}
  }

  if (parts.length === 1) {
    return {
      firstName: parts[0],
    }
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  }
}

function resolveProfileNameParts(profile: object) {
  const source = profile as Record<string, unknown>
  const firstName = pickFirstString(
    source.given_name,
    source.givenName,
    source.first_name,
    source.firstName
  )
  const lastName = pickFirstString(
    source.family_name,
    source.familyName,
    source.last_name,
    source.lastName
  )

  if (firstName || lastName) {
    return {
      firstName,
      lastName,
    }
  }

  return splitFullName(
    pickFirstString(
      source.name,
      source.global_name,
      source.display_name,
      source.username
    )
  )
}

function buildUserProfileFields(profile: object) {
  const source = profile as Record<string, unknown>
  const { firstName, lastName } = resolveProfileNameParts(source)
  const publicName =
    firstName ??
    pickFirstString(
      source.name,
      source.global_name,
      source.display_name,
      source.username
    )

  return {
    firstName,
    lastName,
    name: publicName,
  }
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
          const profileFields = buildUserProfileFields(profile)

          return {
            id,
            email,
            image: pickFirstString(
              profile.picture,
              profile.avatar_url,
              profile.avatar
            ),
            ...profileFields,
            name: profileFields.name ?? "CFX User",
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
            ...buildUserProfileFields(profile),
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

let _auth: ReturnType<typeof betterAuth> | null = null

export function getAuth() {
  if (_auth) return _auth

  _auth = betterAuth({
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
  database: drizzleAdapter(drizzleDb, {
    provider: "pg",
    schema,
    camelCase: true,
  }),
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
      firstName: {
        type: "string",
        required: false,
        input: false,
      },
      lastName: {
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
      tosAcceptedAt: {
        type: "date",
        required: false,
        input: false,
      },
      privacyAcceptedAt: {
        type: "date",
        required: false,
        input: false,
      },
      onboardingCompletedAt: {
        type: "date",
        required: false,
        input: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const [totalUserCount, nonMasterAdminUserCount] = await Promise.all([
            getTotalUserCount(),
            getNonMasterAdminUserCount(),
          ])
          const masterAdminSignup = isMasterAdminEmail(user.email)

          if (!masterAdminSignup && totalUserCount > 0 && !(await isSignupAllowed())) {
            return false
          }

          return {
            data: {
              ...user,
              name: masterAdminSignup ? "admin" : user.name,
              username: masterAdminSignup ? "admin" : user.username,
              role:
                masterAdminSignup || nonMasterAdminUserCount === 0 ? "admin" : "user",
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
              ...buildUserProfileFields(profile),
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
                ...buildUserProfileFields(profile),
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
                ...buildUserProfileFields(profile),
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

  return _auth
}

export const auth = new Proxy({} as ReturnType<typeof betterAuth>, {
  get(_, prop) {
    return Reflect.get(getAuth(), prop)
  },
})
