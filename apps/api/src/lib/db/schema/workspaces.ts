import { relations, sql } from "drizzle-orm"
import {
  check,
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import { users } from "./auth"

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    identifier: text("identifier").notNull(),
    imageUrl: text("image_url"),
    storageTier: text("storage_tier").notNull().default("free"),
    uploadsPaused: boolean("uploads_paused").notNull().default(false),
    uploadsPausedReason: text("uploads_paused_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id),
    rateLimits: jsonb("rate_limits"),
  },
  (table) => [
    unique("workspaces_identifier_unique").on(table.identifier),
    check("workspaces_name_format", sql`${table.name} ~ '^[A-Za-z0-9]{1,20}$'`),
    check(
      "workspaces_identifier_format",
      sql`${table.identifier} ~ '^[a-z0-9_]{1,20}$'`
    ),
  ]
)

export const workspaceAssets = pgTable(
  "workspace_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    status: text("status").notNull().default("pending_intent"),
    visibility: text("visibility").notNull().default("public"),
    encryptionMode: text("encryption_mode").notNull().default("none"),
    storageKey: text("storage_key").notNull(),
    publicUrl: text("public_url"),
    originalFileName: text("original_file_name"),
    expectedContentType: text("expected_content_type"),
    expectedSizeBytes: bigint("expected_size_bytes", { mode: "number" }),
    reservedBytes: bigint("reserved_bytes", { mode: "number" })
      .notNull()
      .default(0),
    contentType: text("content_type"),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull().default(0),
    uploadedByUserId: text("uploaded_by_user_id")
      .notNull()
      .references(() => users.id),
    uploadExpiresAt: timestamp("upload_expires_at", { withTimezone: true }),
    reservationExpiresAt: timestamp("reservation_expires_at", {
      withTimezone: true,
    }),
    uploadStartedAt: timestamp("upload_started_at", { withTimezone: true }),
    uploadCompletedAt: timestamp("upload_completed_at", {
      withTimezone: true,
    }),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
    validationFailedAt: timestamp("validation_failed_at", {
      withTimezone: true,
    }),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    failedReason: text("failed_reason"),
    failedDetail: text("failed_detail"),
    etag: text("etag"),
    metadataJson: jsonb("metadata_json"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("workspace_assets_storage_key_unique").on(table.storageKey),
    index("workspace_assets_workspace_status_idx").on(
      table.workspaceId,
      table.status
    ),
    index("workspace_assets_workspace_kind_status_idx").on(
      table.workspaceId,
      table.kind,
      table.status
    ),
  ]
)

export const workspaceUsageCounters = pgTable(
  "workspace_usage_counters",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    usageType: text("usage_type").notNull(),
    usedBytes: bigint("used_bytes", { mode: "number" }).notNull().default(0),
    reservedBytes: bigint("reserved_bytes", { mode: "number" })
      .notNull()
      .default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("workspace_usage_counters_workspace_type_unique").on(
      table.workspaceId,
      table.usageType
    ),
    index("workspace_usage_counters_workspace_idx").on(table.workspaceId),
  ]
)

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("workspace_members_workspace_user_unique").on(
      table.workspaceId,
      table.userId
    ),
    index("workspace_members_user_id_idx").on(table.userId),
  ]
)

export const workspaceRelations = relations(workspaces, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [workspaces.createdByUserId],
    references: [users.id],
  }),
  members: many(workspaceMembers),
  assets: many(workspaceAssets),
  usageCounters: many(workspaceUsageCounters),
  apiKeys: many(workspaceApiKeys),
}))

export const workspaceAssetRelations = relations(
  workspaceAssets,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [workspaceAssets.workspaceId],
      references: [workspaces.id],
    }),
    uploadedByUser: one(users, {
      fields: [workspaceAssets.uploadedByUserId],
      references: [users.id],
    }),
  })
)

export const workspaceUsageCounterRelations = relations(
  workspaceUsageCounters,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [workspaceUsageCounters.workspaceId],
      references: [workspaces.id],
    }),
  })
)

export const workspaceMemberRelations = relations(
  workspaceMembers,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [workspaceMembers.workspaceId],
      references: [workspaces.id],
    }),
    user: one(users, {
      fields: [workspaceMembers.userId],
      references: [users.id],
    }),
  })
)

export const workspaceDeletionCodes = pgTable(
  "workspace_deletion_codes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("workspace_deletion_codes_workspace_unique").on(table.workspaceId),
    index("workspace_deletion_codes_expires_idx").on(table.expiresAt),
  ]
)

export const workspaceDeletionCodeRelations = relations(
  workspaceDeletionCodes,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [workspaceDeletionCodes.workspaceId],
      references: [workspaces.id],
    }),
    user: one(users, {
      fields: [workspaceDeletionCodes.userId],
      references: [users.id],
    }),
  })
)

export const workspaceApiKeys = pgTable(
  "workspace_api_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type").notNull(), // e.g. "voyager_fivem"
    secretHash: text("secret_hash").notNull(), // SHA-256 hex string of key
    keyPreview: text("key_preview").notNull(), // e.g. "orb_voy_...1a2b"
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  },
  (table) => [
    index("workspace_api_keys_workspace_idx").on(table.workspaceId),
    index("workspace_api_keys_hash_idx").on(table.secretHash),
  ]
)

export const workspaceApiKeyRelations = relations(
  workspaceApiKeys,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [workspaceApiKeys.workspaceId],
      references: [workspaces.id],
    }),
  })
)

export const workspaceApiRequestLogs = pgTable(
  "workspace_api_request_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    apiKeyId: uuid("api_key_id").references(() => workspaceApiKeys.id, {
      onDelete: "set null",
    }),
    endpoint: text("endpoint").notNull(),
    method: text("method").notNull(),
    statusCode: integer("status_code").notNull(),
    responseTimeMs: integer("response_time_ms").notNull().default(0),
    clientIp: text("client_ip").notNull().default(""),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("workspace_api_request_logs_workspace_created_idx").on(
      table.workspaceId,
      table.createdAt
    ),
  ]
)

export const workspaceApiRequestLogRelations = relations(
  workspaceApiRequestLogs,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [workspaceApiRequestLogs.workspaceId],
      references: [workspaces.id],
    }),
    apiKey: one(workspaceApiKeys, {
      fields: [workspaceApiRequestLogs.apiKeyId],
      references: [workspaceApiKeys.id],
    }),
  })
)
