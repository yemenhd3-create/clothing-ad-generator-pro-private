import { randomUUID } from 'node:crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
import { accessCodes, aiToolPrices, creditTransactions, users } from '../drizzle/schema';
import { getDb } from './db';

/**
 * نظام الرصيد المبسّط
 * ------------------
 * - كل مستخدم لديه كود واحد = محفظة واحدة.
 * - جميع الأدوات مجانية، ما عدا الأدوات الذكية (السحابية): تُخصم من الرصيد.
 * - الخصم يتم "أولاً" بعملية واحدة محمية (UPDATE مشروط)، فلا يمكن أن يصبح الرصيد سالباً
 *   حتى لو أُرسلت طلبات كثيرة معاً، ويُسترجع تلقائياً إذا فشلت الأداة.
 * - كل عملية لها operationId فريد في قاعدة البيانات، فلا يتكرر الخصم حتى بعد إعادة تشغيل الخادم.
 * - الأسعار تُقرأ من جدول ai_tool_prices (تُعدَّل من لوحة المطور)، وإن لم يوجد سعر يُستخدم السعر الافتراضي أدناه.
 */

/** سجل الأدوات الذكية. لإضافة أداة ذكية جديدة: أضف مفتاحها هنا وسيظهر سعرها تلقائياً في لوحة المطور. */
export const AI_TOOLS = {
  marketing_text: { label: 'توليد النصوص التسويقية', defaultCost: 2 },
  connected_leader: { label: 'استشارة القائد الذكي', defaultCost: 2 },
  try_on: { label: 'التجربة والقياس الافتراضي', defaultCost: 10 },
  remove_background: { label: 'إزالة الخلفية السحابية', defaultCost: 5 },
} as const;

export type AiToolKey = keyof typeof AI_TOOLS;

/** الأسعار الافتراضية (للتوافق مع بقية الكود). */
export const AI_FEATURE_COSTS = Object.fromEntries(
  Object.entries(AI_TOOLS).map(([key, tool]) => [key, tool.defaultCost]),
) as Record<AiToolKey, number>;

export const TOOL_KEY_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;
export const MAX_TOOL_COST = 100_000;
export const MAX_TOPUP = 1_000_000;

export type AiChargeAllowed = {
  allowed: true;
  /** هل خُصم رصيد فعلاً (false للمطور أو الأدوات المجانية) */
  charged: boolean;
  cost: number;
  operationId?: string;
  accessCodeId?: number;
  isDeveloper?: boolean;
  /** -1 = غير محدود */
  remainingCredits: number;
};

export type AiChargeDeniedReason =
  | 'credits_exhausted'
  | 'daily_limit_exceeded'
  | 'user_inactive'
  | 'no_access_code'
  | 'tool_disabled'
  | 'duplicate_request'
  | 'db_unavailable';

export type AiChargeDenied = {
  allowed: false;
  cost?: number;
  reason: AiChargeDeniedReason;
  message: string;
  accessCodeId?: number;
  remainingCredits?: number;
  dbUnavailable?: boolean;
};

export type AiChargeResult = AiChargeAllowed | AiChargeDenied;

class WalletInsufficient extends Error {}

function isDuplicateKeyError(err: unknown): boolean {
  const e = err as { code?: string; errno?: number; cause?: { code?: string; errno?: number } } | null;
  return (
    e?.code === 'ER_DUP_ENTRY' ||
    e?.errno === 1062 ||
    e?.cause?.code === 'ER_DUP_ENTRY' ||
    e?.cause?.errno === 1062
  );
}

function affectedRows(result: unknown): number {
  const header = Array.isArray(result) ? result[0] : result;
  return Number((header as { affectedRows?: number } | undefined)?.affectedRows ?? 0);
}

function remainingOf(total: number, used: number): number {
  return total === -1 ? -1 : Math.max(0, total - used);
}

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

/* ------------------------------ الأسعار ------------------------------ */

export type ToolPriceView = {
  toolKey: string;
  label: string;
  cost: number;
  defaultCost: number;
  enabled: boolean;
  /** true إذا كانت الأداة مسجّلة في الكود (وليست أضيفت يدوياً فقط) */
  builtIn: boolean;
};

export async function getToolPrice(db: Db, tool: string): Promise<{ cost: number; enabled: boolean }> {
  const row = (await db.select().from(aiToolPrices).where(eq(aiToolPrices.toolKey, tool)).limit(1))[0];
  const registry = (AI_TOOLS as Record<string, { defaultCost: number }>)[tool];
  if (row) return { cost: row.cost, enabled: row.enabled === 1 };
  return { cost: registry?.defaultCost ?? 1, enabled: true };
}

export async function listToolPrices(): Promise<ToolPriceView[]> {
  const db = await getDb();
  const rows = db ? await db.select().from(aiToolPrices) : [];
  const byKey = new Map(rows.map(row => [row.toolKey, row]));
  const views: ToolPriceView[] = Object.entries(AI_TOOLS).map(([toolKey, tool]) => {
    const row = byKey.get(toolKey);
    return {
      toolKey,
      label: row?.label || tool.label,
      cost: row ? row.cost : tool.defaultCost,
      defaultCost: tool.defaultCost,
      enabled: row ? row.enabled === 1 : true,
      builtIn: true,
    };
  });
  for (const row of rows) {
    if (row.toolKey in AI_TOOLS) continue;
    views.push({ toolKey: row.toolKey, label: row.label || row.toolKey, cost: row.cost, defaultCost: row.cost, enabled: row.enabled === 1, builtIn: false });
  }
  return views;
}

export async function setToolPrice(input: { toolKey: string; cost: number; enabled?: boolean; label?: string }) {
  if (!TOOL_KEY_PATTERN.test(input.toolKey)) throw new Error('مفتاح الأداة غير صالح (أحرف إنجليزية صغيرة وأرقام و _ فقط)');
  if (!Number.isInteger(input.cost) || input.cost < 0 || input.cost > MAX_TOOL_COST) throw new Error('سعر الأداة غير صالح');
  const db = await getDb();
  if (!db) throw new Error('قاعدة البيانات غير متاحة');
  const registry = (AI_TOOLS as Record<string, { label: string }>)[input.toolKey];
  const label = (input.label?.trim() || registry?.label || input.toolKey).slice(0, 120);
  const enabled = input.enabled === false ? 0 : 1;
  await db
    .insert(aiToolPrices)
    .values({ toolKey: input.toolKey, label, cost: input.cost, enabled })
    .onDuplicateKeyUpdate({ set: { label, cost: input.cost, enabled } });
  return { success: true as const };
}

/* ------------------------------ الخصم أولاً ------------------------------ */

function deniedMessage(reason: 'credits_exhausted' | 'daily_limit_exceeded', cost: number, remaining: number, dailyRemaining: number): string {
  if (reason === 'daily_limit_exceeded') {
    return `الحد اليومي المتبقي (${dailyRemaining} نقطة) لا يكفي لتكلفة هذه العملية (${cost} نقطة). يتجدد الحد اليومي تلقائياً غداً.`;
  }
  return `رصيدك غير كافٍ لهذه الأداة (المطلوب: ${cost} نقطة، المتبقي: ${remaining}). تواصل مع المطور لشحن الرصيد، وبقية أدوات التطبيق تعمل كالمعتاد.`;
}

/**
 * يحجز (يخصم) تكلفة الأداة الذكية قبل تشغيلها. آمن عند الطلبات المتزامنة.
 * إن لم تُنفَّذ الأداة سحابياً يجب استدعاء refundAiCredits بنفس operationId.
 */
export async function reserveAiCredits(params: { userId: number; tool: string; requestId?: string }): Promise<AiChargeResult> {
  try {
    const db = await getDb();
    if (!db) {
      return { allowed: false, reason: 'db_unavailable', dbUnavailable: true, message: 'قاعدة البيانات غير متاحة حالياً، جاري التحويل للصياغة المحلية.' };
    }

    const price = await getToolPrice(db, params.tool);
    const cost = price.cost;

    const user = (await db.select().from(users).where(eq(users.id, params.userId)).limit(1))[0];
    if (!user) return { allowed: false, cost, reason: 'user_inactive', message: 'المستخدم غير موجود' };

    if (!price.enabled) {
      return { allowed: false, cost, reason: 'tool_disabled', message: 'هذه الأداة الذكية متوقفة مؤقتاً، جاري التحويل للصياغة المحلية.' };
    }

    // حساب المطور / المشرف بلا حد
    if (user.role === 'admin') {
      return { allowed: true, charged: false, cost, isDeveloper: true, remainingCredits: -1 };
    }

    const code = (await db.select().from(accessCodes).where(eq(accessCodes.sessionOpenId, user.openId)).limit(1))[0];
    if (!code) {
      return { allowed: false, cost, reason: 'no_access_code', message: 'لا يوجد كود وصول مرتبط بهذا الحساب، لذلك لا يمكن استخدام الأدوات الذكية.' };
    }

    // إعادة ضبط الحد اليومي بعد 24 ساعة (يهم فقط إن كان للكود حد يومي)
    const now = new Date();
    if (code.aiDailyLimit !== -1 && now.getTime() - code.aiDailyResetAt.getTime() >= 24 * 60 * 60 * 1000) {
      await db.update(accessCodes).set({ aiDailyUsed: 0, aiDailyResetAt: now }).where(eq(accessCodes.id, code.id));
    }

    if (cost <= 0) {
      return { allowed: true, charged: false, cost: 0, accessCodeId: code.id, remainingCredits: remainingOf(code.aiCreditsTotal, code.aiCreditsUsed) };
    }

    const clientKey = params.requestId?.trim().slice(0, 60);
    const operationId = `${code.id}:${clientKey || randomUUID()}`;

    try {
      const remaining = await db.transaction(async tx => {
        // 1) تسجيل العملية أولاً: المفتاح الفريد يمنع تكرارها
        await tx.insert(creditTransactions).values({
          accessCodeId: code.id,
          kind: 'charge',
          tool: params.tool.slice(0, 64),
          amount: -cost,
          balanceAfter: 0,
          operationId,
        });

        // 2) الخصم المشروط في عملية واحدة: لا ينجح إلا إن كان الرصيد (والحد اليومي) يكفي
        const result = await tx
          .update(accessCodes)
          .set({
            aiCreditsUsed: sql`${accessCodes.aiCreditsUsed} + ${cost}`,
            aiDailyUsed: sql`${accessCodes.aiDailyUsed} + ${cost}`,
            lastUsedAt: new Date(),
          })
          .where(
            and(
              eq(accessCodes.id, code.id),
              sql`(${accessCodes.aiCreditsTotal} = -1 OR ${accessCodes.aiCreditsUsed} + ${cost} <= ${accessCodes.aiCreditsTotal})`,
              sql`(${accessCodes.aiDailyLimit} = -1 OR ${accessCodes.aiDailyUsed} + ${cost} <= ${accessCodes.aiDailyLimit})`,
            ),
          );
        if (affectedRows(result) < 1) throw new WalletInsufficient();

        // 3) الرصيد المتبقي بعد الخصم يُكتب في السجل
        const fresh = (await tx.select().from(accessCodes).where(eq(accessCodes.id, code.id)).limit(1))[0];
        const left = remainingOf(fresh.aiCreditsTotal, fresh.aiCreditsUsed);
        await tx.update(creditTransactions).set({ balanceAfter: left }).where(eq(creditTransactions.operationId, operationId));
        return left;
      });

      return { allowed: true, charged: true, cost, operationId, accessCodeId: code.id, remainingCredits: remaining };
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        return { allowed: false, cost, reason: 'duplicate_request', accessCodeId: code.id, message: 'تم تنفيذ هذا الطلب مسبقاً. أعد المحاولة بطلب جديد.' };
      }
      if (err instanceof WalletInsufficient) {
        const fresh = (await db.select().from(accessCodes).where(eq(accessCodes.id, code.id)).limit(1))[0] ?? code;
        const remaining = remainingOf(fresh.aiCreditsTotal, fresh.aiCreditsUsed);
        const dailyRemaining = fresh.aiDailyLimit === -1 ? -1 : Math.max(0, fresh.aiDailyLimit - fresh.aiDailyUsed);
        const dailyBlocked = fresh.aiDailyLimit !== -1 && fresh.aiDailyUsed + cost > fresh.aiDailyLimit;
        const reason = dailyBlocked ? 'daily_limit_exceeded' : 'credits_exhausted';
        return { allowed: false, cost, reason, accessCodeId: code.id, remainingCredits: remaining, message: deniedMessage(reason, cost, remaining, dailyRemaining) };
      }
      throw err;
    }
  } catch (err) {
    console.error('[Wallet] reserveAiCredits failed:', err);
    return { allowed: false, reason: 'db_unavailable', dbUnavailable: true, message: 'تعذر التحقق من الرصيد حالياً، جاري التحويل للصياغة المحلية.' };
  }
}

/** يسترجع خصماً سابقاً (مرة واحدة فقط) عند فشل الأداة. لا يرمي أخطاء أبداً. */
export async function refundAiCredits(operationId: string | undefined): Promise<boolean> {
  if (!operationId) return false;
  try {
    const db = await getDb();
    if (!db) return false;
    await db.transaction(async tx => {
      const charge = (
        await tx
          .select()
          .from(creditTransactions)
          .where(and(eq(creditTransactions.operationId, operationId), eq(creditTransactions.kind, 'charge')))
          .limit(1)
      )[0];
      if (!charge) throw new WalletInsufficient();
      const cost = -charge.amount;

      await tx.insert(creditTransactions).values({
        accessCodeId: charge.accessCodeId,
        kind: 'refund',
        tool: charge.tool,
        amount: cost,
        balanceAfter: 0,
        operationId: `refund:${operationId}`,
        note: 'استرجاع تلقائي: لم تكتمل الأداة سحابياً',
      });
      await tx
        .update(accessCodes)
        .set({
          aiCreditsUsed: sql`GREATEST(${accessCodes.aiCreditsUsed} - ${cost}, 0)`,
          aiDailyUsed: sql`GREATEST(${accessCodes.aiDailyUsed} - ${cost}, 0)`,
        })
        .where(eq(accessCodes.id, charge.accessCodeId));
      const fresh = (await tx.select().from(accessCodes).where(eq(accessCodes.id, charge.accessCodeId)).limit(1))[0];
      await tx
        .update(creditTransactions)
        .set({ balanceAfter: remainingOf(fresh.aiCreditsTotal, fresh.aiCreditsUsed) })
        .where(eq(creditTransactions.operationId, `refund:${operationId}`));
    });
    return true;
  } catch (err) {
    if (!(err instanceof WalletInsufficient) && !isDuplicateKeyError(err)) {
      console.error('[Wallet] refundAiCredits failed:', err);
    }
    return false;
  }
}

/**
 * غلاف يجمع الخطوات: احجز الرصيد ← شغّل الأداة ← استرجع إن لم تنجح سحابياً.
 */
export async function meterAiCall<T>(params: {
  userId: number;
  tool: string;
  requestId?: string;
  call: () => Promise<T>;
  /** هل تُعدّ هذه النتيجة نجاحاً سحابياً يستحق الخصم؟ */
  isChargeable: (result: T) => boolean;
}): Promise<{ denied: true; quota: AiChargeDenied } | { denied: false; result: T; quota: AiChargeAllowed; charged: boolean }> {
  const quota = await reserveAiCredits({ userId: params.userId, tool: params.tool, requestId: params.requestId });
  if (!quota.allowed) return { denied: true, quota };

  let result: T;
  try {
    result = await params.call();
  } catch (err) {
    if (quota.charged) await refundAiCredits(quota.operationId);
    throw err;
  }

  let charged = quota.charged;
  if (charged && !params.isChargeable(result)) {
    await refundAiCredits(quota.operationId);
    charged = false;
  }
  return { denied: false, result, quota, charged };
}

/* ------------------------------ الشحن والسجل ------------------------------ */

export async function addCredits(params: { accessCodeId: number; credits: number; note?: string }) {
  if (!Number.isInteger(params.credits) || params.credits <= 0 || params.credits > MAX_TOPUP) {
    throw new Error('قيمة الشحن يجب أن تكون عدداً صحيحاً أكبر من الصفر');
  }
  const db = await getDb();
  if (!db) throw new Error('قاعدة البيانات غير متاحة');

  return db.transaction(async tx => {
    const code = (await tx.select().from(accessCodes).where(eq(accessCodes.id, params.accessCodeId)).limit(1))[0];
    if (!code) throw new Error('رمز الوصول غير موجود');
    if (code.aiCreditsTotal !== -1) {
      await tx
        .update(accessCodes)
        .set({ aiCreditsTotal: sql`${accessCodes.aiCreditsTotal} + ${params.credits}` })
        .where(eq(accessCodes.id, code.id));
    }
    const fresh = (await tx.select().from(accessCodes).where(eq(accessCodes.id, code.id)).limit(1))[0];
    const remaining = remainingOf(fresh.aiCreditsTotal, fresh.aiCreditsUsed);
    await tx.insert(creditTransactions).values({
      accessCodeId: code.id,
      kind: 'topup',
      amount: params.credits,
      balanceAfter: remaining,
      note: params.note?.slice(0, 255) ?? null,
    });
    return { aiCreditsTotal: fresh.aiCreditsTotal, remainingCredits: remaining };
  });
}

/** يسجّل تعديلاً يدوياً لإجمالي الرصيد من لوحة المطور (فرق الإجمالي) كي لا يضيع أثره. */
export async function recordAdjustment(params: { accessCodeId: number; delta: number; balanceAfter: number; note?: string }) {
  if (params.delta === 0) return;
  const db = await getDb();
  if (!db) return;
  await db.insert(creditTransactions).values({
    accessCodeId: params.accessCodeId,
    kind: 'adjust',
    amount: params.delta,
    balanceAfter: params.balanceAfter,
    note: (params.note ?? 'تعديل يدوي لإجمالي الرصيد').slice(0, 255),
  });
}

export async function listCreditTransactions(accessCodeId: number, limit = 30) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(creditTransactions)
    .where(eq(creditTransactions.accessCodeId, accessCodeId))
    .orderBy(desc(creditTransactions.id))
    .limit(Math.min(Math.max(limit, 1), 200));
}
