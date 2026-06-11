import { drizzleDb } from "../db/connection"
import { workspaceApiRequestLogs } from "../db/schema"

export interface LogContext {
  workspaceId: string
  apiKeyId: string | null
  endpoint: string
  method: string
  statusCode: number
  responseTimeMs: number
  clientIp: string
  userAgent: string | null
}

export function logApiRequest(ctx: LogContext) {
  // Fire-and-forget: never block the response path
  drizzleDb
    .insert(workspaceApiRequestLogs)
    .values({
      workspaceId: ctx.workspaceId,
      apiKeyId: ctx.apiKeyId,
      endpoint: ctx.endpoint,
      method: ctx.method,
      statusCode: ctx.statusCode,
      responseTimeMs: ctx.responseTimeMs,
      clientIp: ctx.clientIp,
      userAgent: ctx.userAgent,
    })
    .catch((err) => {
      console.error("[request-logger] failed to persist log:", err)
    })
}
