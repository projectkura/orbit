import {
  createNotificationInputSchema,
  createWorkspaceAssetIntentSchema,
  createWorkspaceSchema,
  instanceConfigUpdateSchema,
  isMasterAdminEmail,
} from "@orbit/shared"
import { and, count, desc, eq } from "drizzle-orm"
import { ZodError } from "zod"
import { z } from "zod"
import { randomBytes, createHash } from "node:crypto"
import { handleHealth } from "./routes/health"
import { handleAuth } from "./routes/auth"
import { handlePublicConfig } from "./routes/config"
import { handleSetup } from "./routes/setup"
import { handleOnboarding } from "./routes/onboarding"
import {
  createNotificationForUser,
  ensureWelcomeNotification,
  listNotificationsForUser,
  markNotificationsRead,
} from "./lib/notifications"
import { getClientIp, enforceApiRateLimit } from "./routes/utils"
import { db, drizzleDb } from "./lib/db/connection"
import { users, workspaceApiKeys, workspaceAssets, workspaces } from "./lib/db/schema"
import {
  confirmWorkspaceDeletion,
  createWorkspaceForUser,
  deleteWorkspaceForAdmin,
  deleteWorkspaceAssetForUser,
  getWorkspaceForUser,
  isUniqueViolation,
  listAllWorkspacesForAdmin,
  listUserWorkspaces,
  requestWorkspaceDeletion,
  updateWorkspaceForAdmin,
  updateWorkspaceForUser,
} from "./lib/workspaces"
import {
  cancelWorkspaceAssetForUser,
  createWorkspaceAssetIntentForUser,
  finalizeWorkspaceAssetForUser,
  getWorkspaceUsageForUser,
  reapExpiredUploadIntents,
} from "./lib/storage/uploads"
import {
  getRuntimeInstanceConfig,
  saveRuntimeInstanceConfig,
} from "./lib/core/config-store"
import { getMigrationState } from "./lib/db/migrations"
import { fetchResendTemplate, sendInstanceEmailSafe } from "./lib/email"
import { isDragonflyConnected } from "./lib/core/dragonfly"
import { apiEnv } from "./lib/core/env"
import {
  requireAdminSession,
  requireSession,
} from "./lib/auth/request-auth"
import {
  checkRateLimit,
  getRateLimitCounters,
  resolveWorkspaceRateLimits,
} from "./lib/core/rate-limiter"
import {
  resolveApiKey,
  getWorkspaceById,
  invalidateApiKeyCache,
  warmApiKeyCache,
} from "./lib/auth/api-key-auth"
import { logApiRequest } from "./lib/core/request-logger"

let buildInfo = {
  version: process.env.ORBIT_VERSION ?? "unknown",
  commitHash: process.env.ORBIT_COMMIT ?? "unknown",
}

function getCorsOrigin(request: Request) {
  const origin = request.headers.get("origin")

  if (!origin) {
    return null
  }

  return origin === apiEnv.webUrl || origin === apiEnv.apiUrl ? origin : null
}

function withCors(response: Response, request: Request) {
  const origin = getCorsOrigin(request)

  if (!origin) {
    return response
  }

  const headers = new Headers(response.headers)
  headers.set("Access-Control-Allow-Origin", origin)
  headers.set("Access-Control-Allow-Credentials", "true")
  headers.set("Vary", "Origin")

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init)
}

export async function handleRequest(request: Request) {
  const { pathname } = new URL(request.url)

  try {
      if (pathname === "/health") {
        return handleHealth()
      }

      if (pathname.startsWith("/api/auth/")) {
        return handleAuth(request)
      }

      if (pathname === "/api/v1/public-config" && request.method === "GET") {
        return withCors(await handlePublicConfig(), request)
      }

      if (pathname === "/api/v1/admin/instance-config") {
        await requireAdminSession(request)

        if (request.method === "GET") {
          return withCors(json(await getRuntimeInstanceConfig()), request)
        }

        if (request.method === "PUT" || request.method === "POST") {
          const body = instanceConfigUpdateSchema.parse(await request.json())
          const stored = await saveRuntimeInstanceConfig(body)
          return withCors(json(stored.config), request)
        }

        return new Response("Method not allowed", { status: 405 })
      }

      if (pathname === "/api/v1/admin/email-status") {
        await requireAdminSession(request)

        if (request.method !== "GET") {
          return new Response("Method not allowed", { status: 405 })
        }

        return withCors(
          json({
            resendApiKeyConfigured: Boolean(apiEnv.resendApiKey),
          }),
          request
        )
      }

      if (pathname === "/api/v1/admin/diagnostics") {
        await requireAdminSession(request)

        if (request.method !== "GET") {
          return new Response("Method not allowed", { status: 405 })
        }

        let databaseReachable = false
        let migrations = { total: 0, pending: 0 }
        let dbCounts = { users: 0, workspaces: 0, assets: 0, apiKeys: 0 }

        try {
          await db.query("select 1")
          databaseReachable = true
        } catch {
          databaseReachable = false
        }

        if (databaseReachable) {
          try {
            migrations = await getMigrationState()
          } catch {
            migrations = { total: 0, pending: 0 }
          }

          const [
            userCount,
            workspaceCount,
            assetCount,
            apiKeyCount,
          ] = await Promise.all([
            drizzleDb.select({ count: count() }).from(users).then((r) => Number(r[0]?.count ?? 0)),
            drizzleDb.select({ count: count() }).from(workspaces).then((r) => Number(r[0]?.count ?? 0)),
            drizzleDb.select({ count: count() }).from(workspaceAssets).then((r) => Number(r[0]?.count ?? 0)),
            drizzleDb.select({ count: count() }).from(workspaceApiKeys).then((r) => Number(r[0]?.count ?? 0)),
          ])

          dbCounts = {
            users: userCount,
            workspaces: workspaceCount,
            assets: assetCount,
            apiKeys: apiKeyCount,
          }
        }

        const dragonflyConnected = isDragonflyConnected()
        const config = await getRuntimeInstanceConfig()

        const r2Configured = Boolean(
          apiEnv.r2AccountId &&
            apiEnv.r2AccessKeyId &&
            apiEnv.r2SecretAccessKey &&
            apiEnv.r2Bucket &&
            apiEnv.r2PublicUrl
        )

        const oauthProviders = {
          google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
          github: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
          discord: Boolean(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET),
          cfx: Boolean(
            process.env.CFX_CLIENT_ID &&
              process.env.CFX_CLIENT_SECRET &&
              (process.env.CFX_DISCOVERY_URL ||
                (process.env.CFX_AUTHORIZATION_URL && process.env.CFX_TOKEN_URL))
          ),
        }

        return withCors(
          json({
            instance: {
              appName: apiEnv.appName,
              configMode: apiEnv.configMode,
              apiUrl: apiEnv.apiUrl,
              webUrl: apiEnv.webUrl,
              version: buildInfo.version,
              commitHash: buildInfo.commitHash,
            },
            database: {
              reachable: databaseReachable,
              migrations,
              counts: dbCounts,
            },
            dragonfly: {
              connected: dragonflyConnected,
              urlConfigured: Boolean(apiEnv.dragonflyUrl),
            },
            rateLimiter: {
              mode: dragonflyConnected ? "dragonfly" : "in-memory",
            },
            r2: {
              configured: r2Configured,
            },
            email: {
              resendConfigured: Boolean(apiEnv.resendApiKey),
            },
            edgeConfig: {
              configured: Boolean(apiEnv.vercelEdgeConfig),
              storeIdConfigured: Boolean(apiEnv.vercelEdgeConfigStoreId),
            },
            auth: {
              oauthProviders,
              passkeyConfigured: Boolean(apiEnv.passkeyRpId && apiEnv.passkeyRpName),
            },
            uploads: {
              uploadsEnabled: config.uploadSettings.uploadsEnabled,
              workspaceImageUploadsEnabled: config.uploadSettings.workspaceImageUploadsEnabled,
              maxPendingUploadsPerWorkspace: config.uploadSettings.maxPendingUploadsPerWorkspace,
              intentTtlSeconds: config.uploadSettings.intentTtlSeconds,
            },
          }),
          request
        )
      }

      if (pathname.startsWith("/api/v1/admin/resend/templates/")) {
        await requireAdminSession(request)

        if (request.method !== "GET") {
          return new Response("Method not allowed", { status: 405 })
        }

        const templateId = decodeURIComponent(
          pathname.slice("/api/v1/admin/resend/templates/".length)
        )

        if (!templateId) {
          return withCors(
            json({ message: "Template ID is required." }, { status: 400 }),
            request
          )
        }

        if (!apiEnv.resendApiKey) {
          return withCors(
            json(
              {
                message:
                  "RESEND_API_KEY is not configured. Set it on the API service to fetch templates.",
              },
              { status: 503 }
            ),
            request
          )
        }

        try {
          const template = await fetchResendTemplate(templateId)
          return withCors(json(template), request)
        } catch (error) {
          return withCors(
            json(
              {
                message:
                  error instanceof Error
                    ? error.message
                    : "Failed to load Resend template.",
              },
              { status: 502 }
            ),
            request
          )
        }
      }

      if (pathname === "/api/v1/setup/master-admin") {
        return withCors(await handleSetup(request), request)
      }

      if (pathname === "/api/v1/workspaces") {
        const user = await requireSession(request)

        if (isMasterAdminEmail(user.email)) {
          return withCors(
            json({ message: "Master admin cannot manage workspaces." }, { status: 403 }),
            request
          )
        }

        if (request.method === "GET") {
          return withCors(json(await listUserWorkspaces(user.id)), request)
        }

        if (request.method === "POST") {
          try {
            const limited = enforceApiRateLimit(
              request,
              "workspace-create",
              8,
              60 * 1000
            )

            if (limited) {
              return withCors(limited, request)
            }

            const body = createWorkspaceSchema.parse(await request.json())
            const workspace = await createWorkspaceForUser(user.id, body)

            // Fire-and-forget the workspace-created email. Errors are logged
            // inside `sendInstanceEmailSafe` so the API call is never blocked.
            void sendInstanceEmailSafe({
              event: "workspaceCreated",
              to: user.email,
              variables: {
                firstName: user.firstName ?? "",
                lastName: user.lastName ?? "",
                username: user.username ?? user.name ?? "",
                email: user.email,
                workspaceName: workspace.name,
              },
            })

            return withCors(json(workspace, { status: 201 }), request)
          } catch (error) {
            if (error instanceof ZodError) {
              return withCors(
                json(
                  {
                    message: error.issues[0]?.message ?? "Invalid workspace payload.",
                  },
                  { status: 400 }
                ),
                request
              )
            }

            if (isUniqueViolation(error, "workspaces_identifier_unique")) {
              return withCors(
                json({ message: "Workspace identifier is already taken." }, { status: 409 }),
                request
              )
            }

            throw error
          }
        }

        return new Response("Method not allowed", { status: 405 })
      }

      if (pathname === "/api/v1/admin/workspaces") {
        await requireAdminSession(request)

        if (request.method === "GET") {
          return withCors(json(await listAllWorkspacesForAdmin()), request)
        }

        return new Response("Method not allowed", { status: 405 })
      }

      if (pathname === "/api/v1/users/me/onboarding") {
        return withCors(await handleOnboarding(request), request)
      }

      if (pathname === "/api/v1/notifications") {
        const user = await requireSession(request)

        if (request.method === "GET") {
          await ensureWelcomeNotification(user.id)
          return withCors(json(await listNotificationsForUser(user.id)), request)
        }

        if (request.method === "POST") {
          try {
            const payload = createNotificationInputSchema.parse(await request.json())
            const notification = await createNotificationForUser(user.id, payload)
            return withCors(json(notification), request)
          } catch (error) {
            if (error instanceof ZodError) {
              return withCors(
                json({
                  message: error.issues[0]?.message ?? "Invalid notification payload.",
                }),
                request
              )
            }

            throw error
          }
        }

        if (request.method === "PATCH") {
          const result = await markNotificationsRead(user.id)
          return withCors(json(result), request)
        }

        return new Response("Method not allowed", { status: 405 })
      }

      if (pathname.startsWith("/api/v1/workspaces/")) {
        const user = await requireSession(request)

        if (isMasterAdminEmail(user.email)) {
          return withCors(
            json({ message: "Master admin cannot view workspaces." }, { status: 403 }),
            request
          )
        }

        const parts = pathname
          .slice("/api/v1/workspaces/".length)
          .split("/")
          .filter(Boolean)
          .map((part) => decodeURIComponent(part))
        const [identifier, section, action, assetId] = parts

        try {
          if (!identifier) {
            return withCors(
              json({ message: "Workspace identifier is required." }, { status: 400 }),
              request
            )
          }

          if (!section && request.method === "GET") {
            const workspace = await getWorkspaceForUser(user.id, identifier)

            if (!workspace) {
              return withCors(
                json({ message: "Workspace not found." }, { status: 404 }),
                request
              )
            }

            return withCors(json(workspace), request)
          }

          if (section === "usage" && !action && request.method === "GET") {
            const usage = await getWorkspaceUsageForUser(user.id, identifier)

            if (!usage) {
              return withCors(
                json({ message: "Workspace not found." }, { status: 404 }),
                request
              )
            }

            return withCors(json(usage), request)
          }

          if (
            section === "assets" &&
            action === "intents" &&
            request.method === "POST"
          ) {
            const limited = enforceApiRateLimit(
              request,
              "workspace-asset-intent",
              20,
              60 * 1000
            )

            if (limited) {
              return withCors(limited, request)
            }

            const intent = await createWorkspaceAssetIntentForUser(
              user.id,
              identifier,
              createWorkspaceAssetIntentSchema.parse(await request.json())
            )

            if (!intent) {
              return withCors(
                json({ message: "Workspace not found." }, { status: 404 }),
                request
              )
            }

            return withCors(json(intent, { status: 201 }), request)
          }

          if (
            section === "assets" &&
            action === "finalize" &&
            request.method === "POST"
          ) {
            const limited = enforceApiRateLimit(
              request,
              "workspace-asset-finalize",
              20,
              60 * 1000
            )

            if (limited) {
              return withCors(limited, request)
            }

            const workspace = await finalizeWorkspaceAssetForUser(
              user.id,
              identifier,
              await request.json()
            )

            if (!workspace) {
              return withCors(
                json({ message: "Workspace not found." }, { status: 404 }),
                request
              )
            }

            return withCors(json(workspace), request)
          }

          if (
            section === "assets" &&
            action &&
            assetId === "cancel" &&
            request.method === "POST"
          ) {
            const limited = enforceApiRateLimit(
              request,
              "workspace-asset-cancel",
              20,
              60 * 1000
            )

            if (limited) {
              return withCors(limited, request)
            }

            const result = await cancelWorkspaceAssetForUser(user.id, identifier, {
              assetId: action,
            })

            if (!result) {
              return withCors(
                json({ message: "Workspace not found." }, { status: 404 }),
                request
              )
            }

            return withCors(json(result), request)
          }

          if (
            section === "assets" &&
            action &&
            assetId === undefined &&
            request.method === "DELETE"
          ) {
            const limited = enforceApiRateLimit(
              request,
              "workspace-asset-delete",
              20,
              60 * 1000
            )

            if (limited) {
              return withCors(limited, request)
            }

            const result = await deleteWorkspaceAssetForUser(
              user.id,
              identifier,
              action
            )

            if (!result) {
              return withCors(
                json({ message: "Workspace not found." }, { status: 404 }),
                request
              )
            }

            return withCors(json(result), request)
          }

          if (!section && request.method === "PATCH") {
            const limited = enforceApiRateLimit(
              request,
              "workspace-update",
              10,
              60 * 1000
            )

            if (limited) {
              return withCors(limited, request)
            }

            const payload = await request.json()
            const updates = z.object({
              name: z.string().trim().optional(),
              imageUrl: z.string().nullable().optional(),
              uploadsPaused: z.boolean().optional(),
              uploadsPausedReason: z.string().nullable().optional(),
            }).parse(payload)

            const workspace = await updateWorkspaceForUser(
              user.id,
              identifier,
              updates
            )

            if (!workspace) {
              return withCors(
                json({ message: "Workspace not found." }, { status: 404 }),
                request
              )
            }

            return withCors(json(workspace), request)
          }

          if (section === "deletion" && action === "request" && request.method === "POST") {
            const limited = enforceApiRateLimit(
              request,
              "workspace-deletion-request",
              3,
              60 * 60 * 1000
            )

            if (limited) {
              return withCors(limited, request)
            }

            const workspace = await getWorkspaceForUser(user.id, identifier)

            if (!workspace) {
              return withCors(
                json({ message: "Workspace not found." }, { status: 404 }),
                request
              )
            }

            const result = await requestWorkspaceDeletion(user.id, identifier)

            if (!result) {
              return withCors(
                json({ message: "Workspace not found." }, { status: 404 }),
                request
              )
            }

            // Send email with verification code
            void sendInstanceEmailSafe({
              event: "workspaceDeletion",
              to: user.email,
              variables: {
                firstName: user.firstName ?? undefined,
                lastName: user.lastName ?? undefined,
                username: user.username ?? undefined,
                email: user.email,
                workspaceName: workspace.name,
                verificationCode: result.code,
              },
            })

            return withCors(json({ sent: true }), request)
          }

          if (section === "deletion" && action === "confirm" && request.method === "POST") {
            const limited = enforceApiRateLimit(
              request,
              "workspace-deletion-confirm",
              5,
              60 * 1000
            )

            if (limited) {
              return withCors(limited, request)
            }

            const payload = await request.json()
            const input = z.object({
              code: z.string().trim(),
            }).parse(payload)

            const result = await confirmWorkspaceDeletion(
              user.id,
              identifier,
              input.code
            )

            if (!result) {
              return withCors(
                json({ message: "Workspace not found." }, { status: 404 }),
                request
              )
            }

            return withCors(json(result), request)
          }

          if (section === "limits" && !action && request.method === "GET") {
            const workspace = await getWorkspaceForUser(user.id, identifier)

            if (!workspace) {
              return withCors(
                json({ message: "Workspace not found." }, { status: 404 }),
                request
              )
            }

            const config = await getRuntimeInstanceConfig()
            const limits = resolveWorkspaceRateLimits(
              workspace.storageTier as "free" | "pro",
              workspace.rateLimits ?? null,
              config
            )
            const counters = await getRateLimitCounters(workspace.id, limits)

            return withCors(
              json({
                limits: {
                  apiRequestsPerMinute: limits.api_requests_per_minute,
                  apiRequestsPerMonth: limits.api_requests_per_month,
                  networkEgressBytesPerMonth: limits.network_egress_bytes_per_month,
                  storageBytesMax: limits.storage_bytes_max,
                },
                usage: {
                  apiRequestsPerMinute: counters.api_requests_per_minute,
                  apiRequestsPerMonth: counters.api_requests_per_month,
                  networkEgressBytesPerMonth: counters.network_egress_bytes_per_month,
                  storageBytesMax: counters.storage_bytes_max,
                },
              }),
              request
            )
          }

          if (section === "api-keys" && !action) {
            const workspace = await getWorkspaceForUser(user.id, identifier)

            if (!workspace) {
              return withCors(
                json({ message: "Workspace not found." }, { status: 404 }),
                request
              )
            }

            if (request.method === "GET") {
              const keys = await drizzleDb
                .select({
                  id: workspaceApiKeys.id,
                  name: workspaceApiKeys.name,
                  type: workspaceApiKeys.type,
                  keyPreview: workspaceApiKeys.keyPreview,
                  createdAt: workspaceApiKeys.createdAt,
                  lastUsedAt: workspaceApiKeys.lastUsedAt,
                })
                .from(workspaceApiKeys)
                .where(eq(workspaceApiKeys.workspaceId, workspace.id))
                .orderBy(desc(workspaceApiKeys.createdAt))

              return withCors(json({ keys }), request)
            }

            if (request.method === "POST") {
              const limited = enforceApiRateLimit(
                request,
                "workspace-api-key-create",
                10,
                60 * 1000
              )

              if (limited) {
                return withCors(limited, request)
              }

              const payload = await request.json()
              const input = z.object({
                name: z.string().trim().min(1, "Name is required").max(100, "Name must be 100 characters or fewer"),
                type: z.enum(["voyager_fivem", "general"]),
              }).parse(payload)

              const rawToken = randomBytes(32).toString("hex")
              const secretKey = input.type === "general" ? `orb_api_${rawToken}` : `orb_voy_${rawToken}`
              const secretHash = createHash("sha256").update(secretKey).digest("hex")
              const keyPreview = input.type === "general" ? `orb_api_...${rawToken.slice(-4)}` : `orb_voy_...${rawToken.slice(-4)}`

              const inserted = await drizzleDb
                .insert(workspaceApiKeys)
                .values({
                  workspaceId: workspace.id,
                  name: input.name,
                  type: input.type,
                  secretHash,
                  keyPreview,
                })
                .returning({
                  id: workspaceApiKeys.id,
                  name: workspaceApiKeys.name,
                  type: workspaceApiKeys.type,
                  keyPreview: workspaceApiKeys.keyPreview,
                  createdAt: workspaceApiKeys.createdAt,
                })

              const keyRecord = inserted[0]
              if (!keyRecord) {
                throw new Error("Failed to create API key")
              }

              void warmApiKeyCache(secretHash)

              return withCors(
                json({
                  ...keyRecord,
                  secretKey,
                }, { status: 201 }),
                request
              )
            }
          }

          if (section === "api-keys" && action) {
            const workspace = await getWorkspaceForUser(user.id, identifier)

            if (!workspace) {
              return withCors(
                json({ message: "Workspace not found." }, { status: 404 }),
                request
              )
            }

            if (request.method === "DELETE") {
              const limited = enforceApiRateLimit(
                request,
                "workspace-api-key-delete",
                20,
                60 * 1000
              )

              if (limited) {
                return withCors(limited, request)
              }

              const keyRow = await drizzleDb
                .select({ secretHash: workspaceApiKeys.secretHash })
                .from(workspaceApiKeys)
                .where(
                  and(
                    eq(workspaceApiKeys.id, action),
                    eq(workspaceApiKeys.workspaceId, workspace.id)
                  )
                )
                .limit(1)

              if (keyRow[0]) {
                void invalidateApiKeyCache(keyRow[0].secretHash)
              }

              await drizzleDb
                .delete(workspaceApiKeys)
                .where(
                  and(
                    eq(workspaceApiKeys.id, action),
                    eq(workspaceApiKeys.workspaceId, workspace.id)
                  )
                )

              return withCors(json({ ok: true }), request)
            }
          }

          return new Response("Method not allowed", { status: 405 })
        } catch (error) {
          if (error instanceof ZodError) {
            return withCors(
              json({ message: error.issues[0]?.message ?? "Invalid workspace request." }, { status: 400 }),
              request
            )
          }

          if (error instanceof Response) {
            return withCors(error, request)
          }

          throw error
        }
      }

      if (pathname.startsWith("/api/v1/admin/workspaces/")) {
        await requireAdminSession(request)

        const workspaceId = decodeURIComponent(
          pathname.slice("/api/v1/admin/workspaces/".length)
        )

        if (!workspaceId) {
          return withCors(
            json({ message: "Workspace id is required." }, { status: 400 }),
            request
          )
        }

        if (request.method === "PATCH") {
          const payload = z
            .object({
              uploadsPaused: z.boolean(),
              uploadsPausedReason: z.string().trim().nullable().optional(),
            })
            .parse(await request.json())

          const updated = await updateWorkspaceForAdmin(workspaceId, payload)

          if (!updated) {
            return withCors(
              json({ message: "Workspace not found." }, { status: 404 }),
              request
            )
          }

          return withCors(json(updated), request)
        }

        if (request.method === "DELETE") {
          const deleted = await deleteWorkspaceForAdmin(workspaceId)

          if (!deleted) {
            return withCors(
              json({ message: "Workspace not found." }, { status: 404 }),
              request
            )
          }

          return withCors(json(deleted), request)
        }

        return new Response("Method not allowed", { status: 405 })
      }

      if (pathname.startsWith("/api/v1/w/")) {
        const parts = pathname
          .slice("/api/v1/w/".length)
          .split("/")
          .filter(Boolean)
        const [identifier, action] = parts

        if (action === "test" && request.method === "POST") {
          const startTime = Date.now()
          const clientIp = getClientIp(request)
          const userAgent = request.headers.get("user-agent") ?? null

          let apiKey: Awaited<ReturnType<typeof resolveApiKey>>
          try {
            apiKey = await resolveApiKey(request)
          } catch (error) {
            logApiRequest({
              workspaceId: "unknown",
              apiKeyId: null,
              endpoint: pathname,
              method: request.method,
              statusCode: error instanceof Response ? error.status : 401,
              responseTimeMs: Date.now() - startTime,
              clientIp,
              userAgent,
            })
            return withCors(error instanceof Response ? error : json({ message: "Unauthorized" }, { status: 401 }), request)
          }

          const workspace = await getWorkspaceById(apiKey.workspaceId)

          if (!workspace || workspace.identifier !== identifier) {
            logApiRequest({
              workspaceId: apiKey.workspaceId,
              apiKeyId: apiKey.keyId,
              endpoint: pathname,
              method: request.method,
              statusCode: 404,
              responseTimeMs: Date.now() - startTime,
              clientIp,
              userAgent,
            })
            return withCors(
              json({ message: "Workspace not found." }, { status: 404 }),
              request
            )
          }

          const config = await getRuntimeInstanceConfig()
          const limits = resolveWorkspaceRateLimits(
            workspace.storageTier as "free" | "pro",
            workspace.rateLimits as unknown as import("@orbit/shared").WorkspaceRateLimits | null,
            config
          )

          const minuteResult = await checkRateLimit(
            workspace.id,
            "api_requests_per_minute",
            limits.api_requests_per_minute
          )

          if (!minuteResult.allowed) {
            logApiRequest({
              workspaceId: workspace.id,
              apiKeyId: apiKey.keyId,
              endpoint: pathname,
              method: request.method,
              statusCode: 429,
              responseTimeMs: Date.now() - startTime,
              clientIp,
              userAgent,
            })
            return withCors(
              json(
                {
                  message: "Rate limit exceeded. Try again shortly.",
                  retryAfter: Math.ceil((minuteResult.resetAt - Date.now()) / 1000),
                },
                {
                  status: 429,
                  headers: {
                    "Retry-After": String(Math.ceil((minuteResult.resetAt - Date.now()) / 1000)),
                    "X-RateLimit-Limit": String(minuteResult.limit),
                    "X-RateLimit-Remaining": String(minuteResult.remaining),
                    "X-RateLimit-Reset": String(Math.ceil(minuteResult.resetAt / 1000)),
                  },
                }
              ),
              request
            )
          }

          const monthResult = await checkRateLimit(
            workspace.id,
            "api_requests_per_month",
            limits.api_requests_per_month
          )

          if (!monthResult.allowed) {
            logApiRequest({
              workspaceId: workspace.id,
              apiKeyId: apiKey.keyId,
              endpoint: pathname,
              method: request.method,
              statusCode: 429,
              responseTimeMs: Date.now() - startTime,
              clientIp,
              userAgent,
            })
            return withCors(
              json(
                {
                  message: "Monthly rate limit exceeded.",
                  retryAfter: Math.ceil((monthResult.resetAt - Date.now()) / 1000),
                },
                {
                  status: 429,
                  headers: {
                    "Retry-After": String(Math.ceil((monthResult.resetAt - Date.now()) / 1000)),
                    "X-RateLimit-Limit": String(monthResult.limit),
                    "X-RateLimit-Remaining": String(monthResult.remaining),
                    "X-RateLimit-Reset": String(Math.ceil(monthResult.resetAt / 1000)),
                  },
                }
              ),
              request
            )
          }

          logApiRequest({
            workspaceId: workspace.id,
            apiKeyId: apiKey.keyId,
            endpoint: pathname,
            method: request.method,
            statusCode: 200,
            responseTimeMs: Date.now() - startTime,
            clientIp,
            userAgent,
          })

          return withCors(
            json({
              ok: true,
              workspace: {
                id: workspace.id,
                name: workspace.name,
                identifier: workspace.identifier,
              },
              rateLimit: {
                limit: minuteResult.limit,
                remaining: minuteResult.remaining,
                resetAt: minuteResult.resetAt,
              },
            }),
            request
          )
        }

        return new Response("Not found", { status: 404 })
      }

      if (pathname === "/internal/uploads/reap-stale") {
        if (request.method !== "POST") {
          return new Response("Method not allowed", { status: 405 })
        }

        if (
          request.headers.get("authorization") !== `Bearer ${apiEnv.betterAuthSecret}`
        ) {
          return new Response("Unauthorized", { status: 401 })
        }

        return json(await reapExpiredUploadIntents())
      }

      return new Response("Not found", { status: 404 })
    } catch (error) {
      if (error instanceof Response) {
        return error
      }

      console.error(error)
      return new Response("Internal server error", { status: 500 })
    }
}
