import {
  createNotificationInputSchema,
  type CreateNotificationInput,
  type NotificationKind,
  type UserNotification,
} from "@orbit/shared"
import { and, count, desc, eq, isNull } from "drizzle-orm"

import { isMasterAdminEmail } from "./core/master-admin"
import { drizzleDb } from "./db/connection"
import { notifications, users } from "./db/schema"

const notificationSelect = {
  id: notifications.id,
  userId: notifications.userId,
  title: notifications.title,
  body: notifications.body,
  icon: notifications.icon,
  kind: notifications.kind,
  metadata: notifications.metadata,
  createdAt: notifications.createdAt,
  readAt: notifications.readAt,
}

function mapNotification(row: {
  id: string
  userId: string
  title: string
  body: string
  icon: string | null
  kind: string
  metadata: unknown
  createdAt: Date
  readAt: Date | null
}): UserNotification {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    body: row.body,
    icon: row.icon ?? undefined,
    kind: row.kind as NotificationKind,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    createdAt: row.createdAt.toISOString(),
    readAt: row.readAt ? row.readAt.toISOString() : null,
  }
}

async function canNotifyUser(userId: string) {
  const result = await drizzleDb
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  const email = result[0]?.email
  if (!email) return false

  return !isMasterAdminEmail(email)
}

export async function createNotificationForUser(
  userId: string,
  input: CreateNotificationInput
) {
  const allowed = await canNotifyUser(userId)
  if (!allowed) return null

  const payload = createNotificationInputSchema.parse(input)

  const [inserted] = await drizzleDb
    .insert(notifications)
    .values({
      userId,
      title: payload.title,
      body: payload.body,
      icon: payload.icon,
      kind: payload.kind ?? "general",
      metadata: payload.metadata ?? null,
    })
    .returning(notificationSelect)

  return inserted ? mapNotification(inserted) : null
}

export async function ensureWelcomeNotification(userId: string) {
  const allowed = await canNotifyUser(userId)
  if (!allowed) return null

  const existing = await drizzleDb
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.kind, "welcome")))
    .limit(1)

  if (existing[0]) return null

  return createNotificationForUser(userId, {
    title: "Welcome to Orbit",
    body: "Thanks for joining! Here are a few quick links to get you started with workspaces.",
    icon: "sparkles",
    kind: "welcome",
  })
}

export async function listNotificationsForUser(userId: string, limit = 40) {
  const allowed = await canNotifyUser(userId)
  if (!allowed) return { notifications: [], unreadCount: 0 }

  const rows = await drizzleDb
    .select(notificationSelect)
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)

  const unread = await getUnreadNotificationCount(userId)

  return {
    notifications: rows.map(mapNotification),
    unreadCount: unread,
  }
}

export async function getUnreadNotificationCount(userId: string) {
  const allowed = await canNotifyUser(userId)
  if (!allowed) return 0

  const result = await drizzleDb
    .select({ count: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))

  return Number(result[0]?.count ?? 0)
}

export async function markNotificationsRead(userId: string) {
  const allowed = await canNotifyUser(userId)
  if (!allowed) return { updated: 0 }

  const now = new Date()
  const updated = await drizzleDb
    .update(notifications)
    .set({ readAt: now })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
    .returning({ id: notifications.id })

  return { updated: updated.length }
}
