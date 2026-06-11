import { z } from "zod"

export const notificationKindSchema = z.enum([
  "welcome",
  "workspace_created",
  "workspace_deleted",
  "subscription",
  "general",
])

export type NotificationKind = z.infer<typeof notificationKindSchema>

export const notificationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string(),
  body: z.string(),
  icon: z.string().nullable().optional(),
  kind: notificationKindSchema,
  metadata: z.record(z.string(), z.any()).optional().nullable(),
  createdAt: z.string(),
  readAt: z.string().nullable(),
})

export type UserNotification = z.infer<typeof notificationSchema>

export const createNotificationInputSchema = z.object({
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(800),
  icon: z.string().trim().max(80).optional(),
  kind: notificationKindSchema.optional(),
  metadata: z.record(z.string(), z.any()).optional().nullable(),
})

export type CreateNotificationInput = z.infer<typeof createNotificationInputSchema>

export type NotificationListResponse = {
  notifications: UserNotification[]
  unreadCount: number
}
