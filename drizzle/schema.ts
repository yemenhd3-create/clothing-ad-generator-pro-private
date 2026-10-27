import { index, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  isDisabled: int("isDisabled").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  lastSeenAt: timestamp("lastSeenAt"),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/** Encrypted credentials are never sent back to the browser once saved. */
export const developerProviders = mysqlTable("developer_providers", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  baseUrl: varchar("baseUrl", { length: 500 }).notNull(),
  model: varchar("model", { length: 160 }).notNull(),
  encryptedApiKey: text("encryptedApiKey").notNull(),
  isEnabled: int("isEnabled").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DeveloperProvider = typeof developerProviders.$inferSelect;

/** رسالة عامة يحررها المطور وتظهر للحسابات المفعّلة فقط. */
export const appAnnouncements = mysqlTable("app_announcements", {
  id: int("id").autoincrement().primaryKey(),
  message: text("message").notNull(),
  isActive: int("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** رسالة قصيرة من حساب مستخدم إلى المطور؛ لا تحفظ صوراً أو أسراراً. */
export const userMessages = mysqlTable("user_messages", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  message: text("message").notNull(),
  status: mysqlEnum("status", ["new", "read", "archived"]).default("new").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AppAnnouncement = typeof appAnnouncements.$inferSelect;
export type UserMessage = typeof userMessages.$inferSelect;

/** رمز وصول يصدره المطور. لا يُخزّن الرمز الخام؛ تحفظ بصمة SHA-256 فقط. */
export const accessCodes = mysqlTable("access_codes", {
  id: int("id").autoincrement().primaryKey(),
  codeHash: varchar("codeHash", { length: 64 }).notNull().unique(),
  sessionOpenId: varchar("sessionOpenId", { length: 96 }).notNull().unique(),
  label: varchar("label", { length: 120 }).notNull(),
  expiresAt: timestamp("expiresAt"),
  maxUses: int("maxUses"),
  useCount: int("useCount").default(0).notNull(),
  isRevoked: int("isRevoked").default(0).notNull(),
  aiCreditsTotal: int("aiCreditsTotal").default(100).notNull(),
  aiCreditsUsed: int("aiCreditsUsed").default(0).notNull(),
  aiDailyLimit: int("aiDailyLimit").default(20).notNull(),
  aiDailyUsed: int("aiDailyUsed").default(0).notNull(),
  aiDailyResetAt: timestamp("aiDailyResetAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  lastUsedAt: timestamp("lastUsedAt"),
});

export const aiUsageLogs = mysqlTable("ai_usage_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  accessCodeId: int("accessCodeId"),
  feature: varchar("feature", { length: 64 }).notNull(),
  provider: varchar("provider", { length: 64 }).notNull(),
  model: varchar("model", { length: 120 }).notNull(),
  status: varchar("status", { length: 32 }).notNull(),
  responseTimeMs: int("responseTimeMs").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AiUsageLog = typeof aiUsageLogs.$inferSelect;
export type InsertAiUsageLog = typeof aiUsageLogs.$inferInsert;

export type AccessCode = typeof accessCodes.$inferSelect;

/** إعداد وحيد للمشروع: يحدد هل يلزم تسجيل الدخول قبل فتح غرفة الملابس. */
export const projectAccessSettings = mysqlTable("project_access_settings", {
  id: int("id").primaryKey(),
  loginRequired: int("loginRequired").default(1).notNull(),
  registrationOpen: int("registrationOpen").default(1).notNull(),
  offlineGraceHours: int("offlineGraceHours").default(72).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProjectAccessSettings = typeof projectAccessSettings.$inferSelect;


/**
 * سجل عمليات الرصيد: كل شحن أو خصم أو استرجاع يُسجَّل هنا ولا يُعدَّل.
 * العمود operationId فريد، فلا يمكن تنفيذ العملية نفسها مرتين حتى بعد إعادة تشغيل الخادم.
 */
export const creditTransactions = mysqlTable(
  "credit_transactions",
  {
    id: int("id").autoincrement().primaryKey(),
    accessCodeId: int("accessCodeId").notNull(),
    /** topup = شحن، charge = خصم لأداة ذكية، refund = استرجاع بعد فشل الأداة، adjust = تعديل يدوي */
    kind: varchar("kind", { length: 16 }).notNull(),
    tool: varchar("tool", { length: 64 }),
    /** موجب = إضافة رصيد، سالب = خصم */
    amount: int("amount").notNull(),
    /** الرصيد المتبقي بعد العملية (-1 = غير محدود) */
    balanceAfter: int("balanceAfter").notNull(),
    operationId: varchar("operationId", { length: 96 }).unique(),
    note: varchar("note", { length: 255 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("credit_transactions_accessCodeId_idx").on(table.accessCodeId)],
);

export type CreditTransaction = typeof creditTransactions.$inferSelect;

/** أسعار الأدوات الذكية بالنقاط، قابلة للتعديل من لوحة المطور دون نشر جديد. */
export const aiToolPrices = mysqlTable("ai_tool_prices", {
  toolKey: varchar("toolKey", { length: 64 }).primaryKey(),
  label: varchar("label", { length: 120 }),
  cost: int("cost").notNull(),
  enabled: int("enabled").default(1).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AiToolPrice = typeof aiToolPrices.$inferSelect;
