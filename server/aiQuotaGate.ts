import { and, desc, eq, sql } from 'drizzle-orm';
import { accessCodes, aiUsageLogs, users } from '../drizzle/schema';
import { getDb } from './db';

export type AiQuotaCheckResult = {
  allowed: boolean;
  reason?: 'daily_limit_exceeded' | 'credits_exhausted' | 'user_inactive' | 'db_unavailable';
  message?: string;
  isDeveloper?: boolean;
  accessCodeId?: number;
  remainingCredits?: number;
  dailyRemaining?: number;
  dbUnavailable?: boolean;
};

export type AiUsageLogInput = {
  userId?: number;
  accessCodeId?: number;
  feature: 'marketing_text' | 'connected_leader';
  provider: string;
  model: string;
  status: 'success' | 'quota_exceeded' | 'fallback_local' | 'error';
  responseTimeMs?: number;
};

/**
 * المرحلة الأولى: فحص الحصة دون خصم
 * يتحقق فقط من أهلية المستخدم ورصيده المتبقي والحد اليومي مع إعادة الضبط التلقائي بعد 24 ساعة.
 * محمي تماماً بكتل try/catch حتى لا يتعطل التطبيق عند تعذر الاتصال بقاعدة البيانات.
 */
export async function checkAiQuota(params: {
  userId: number;
  feature: 'marketing_text' | 'connected_leader';
}): Promise<AiQuotaCheckResult> {
  try {
    const db = await getDb();
    if (!db) {
      return {
        allowed: false,
        dbUnavailable: true,
        reason: 'db_unavailable',
        message: 'قاعدة البيانات غير متاحة حالياً، جاري التحويل للصياغة المحلية.',
      };
    }

    const user = (await db.select().from(users).where(eq(users.id, params.userId)).limit(1))[0];
    if (!user) {
      return { allowed: false, reason: 'user_inactive', message: 'المستخدم غير موجود' };
    }

    // حساب المطور / المشرف يتمتع برصيد غير محدود
    if (user.role === 'admin') {
      return { allowed: true, isDeveloper: true, remainingCredits: -1, dailyRemaining: -1 };
    }

    // استعلام كود الوصول المرتبط بالمستخدم
    const code = (await db.select().from(accessCodes).where(eq(accessCodes.sessionOpenId, user.openId)).limit(1))[0];
    if (!code) {
      // مستخدم بلا كود وصول مرتبط: مسموح افتراضياً
      return { allowed: true, remainingCredits: -1, dailyRemaining: -1 };
    }

    const now = new Date();
    const resetIntervalMs = 24 * 60 * 60 * 1000;
    const timeSinceReset = now.getTime() - code.aiDailyResetAt.getTime();
    let currentDailyUsed = code.aiDailyUsed;

    // إعادة ضبط العداد اليومي تلقائياً عند انقضاء 24 ساعة
    if (timeSinceReset >= resetIntervalMs) {
      currentDailyUsed = 0;
      await db.update(accessCodes)
        .set({ aiDailyUsed: 0, aiDailyResetAt: now })
        .where(eq(accessCodes.id, code.id));
    }

    // فحص الحد اليومي
    if (code.aiDailyLimit !== -1 && currentDailyUsed >= code.aiDailyLimit) {
      const remainingCredits = code.aiCreditsTotal === -1 ? -1 : Math.max(0, code.aiCreditsTotal - code.aiCreditsUsed);
      return {
        allowed: false,
        reason: 'daily_limit_exceeded',
        message: `اكتمل الحد اليومي لاستخدام الذكاء الاصطناعي (${code.aiDailyLimit}/${code.aiDailyLimit})، وسيتجدد تلقائياً غداً.`,
        accessCodeId: code.id,
        remainingCredits,
        dailyRemaining: 0,
      };
    }

    // فحص إجمالي الرصيد السحابي المتاح
    if (code.aiCreditsTotal !== -1 && code.aiCreditsUsed >= code.aiCreditsTotal) {
      return {
        allowed: false,
        reason: 'credits_exhausted',
        message: `نفد رصيد الذكاء الاصطناعي السحابي لهذا الرمز (${code.aiCreditsTotal}/${code.aiCreditsTotal}). يرجى طلب شحن الرصيد.`,
        accessCodeId: code.id,
        remainingCredits: 0,
        dailyRemaining: Math.max(0, code.aiDailyLimit - currentDailyUsed),
      };
    }

    const remainingCredits = code.aiCreditsTotal === -1 ? -1 : Math.max(0, code.aiCreditsTotal - code.aiCreditsUsed);
    const dailyRemaining = code.aiDailyLimit === -1 ? -1 : Math.max(0, code.aiDailyLimit - currentDailyUsed);

    return {
      allowed: true,
      accessCodeId: code.id,
      remainingCredits,
      dailyRemaining,
    };
  } catch (err) {
    console.error('[AI Quota Gate] Database error during checkAiQuota:', err);
    return {
      allowed: false,
      dbUnavailable: true,
      reason: 'db_unavailable',
      message: 'تعذر الاتصال بقاعدة البيانات للتحقق من الرصيد، جاري التوليد المحلي.',
    };
  }
}

/**
 * المرحلة الثانية: الخصم الفعلي بعد نجاح التوليد السحابي
 * لا تُستدعى إلا بعد تأكيد نجاح الاستجابة من الموديل السحابي (source === 'cloud').
 */
export interface IdempotencyRecord {
  accessCodeId: number;
  credits: number;
  timestamp: number;
}

export const IDEMPOTENCY_TTL_MS = 15 * 60 * 1000;
const idempotencyCache = new Map<string, IdempotencyRecord>();

export function cleanupExpiredIdempotencyKeys(now = Date.now()): void {
  for (const [key, record] of idempotencyCache.entries()) {
    if (now - record.timestamp > IDEMPOTENCY_TTL_MS) {
      idempotencyCache.delete(key);
    }
  }
}

export function clearIdempotencyCache(): void {
  idempotencyCache.clear();
}

export function isIdempotencyKeyDeducted(requestId: string): boolean {
  cleanupExpiredIdempotencyKeys();
  return idempotencyCache.has(requestId.trim());
}

export function registerIdempotentRequest(requestId: string, accessCodeId: number, credits = 1, now = Date.now()): boolean {
  cleanupExpiredIdempotencyKeys(now);
  const trimmed = requestId.trim();
  if (!trimmed) return true;
  if (idempotencyCache.has(trimmed)) {
    return false; // Duplicate!
  }
  idempotencyCache.set(trimmed, {
    accessCodeId,
    credits,
    timestamp: now,
  });
  return true;
}

export type DeductAiQuotaResult = {
  deducted: boolean;
  duplicate: boolean;
  creditsDeducted: number;
};

/**
 * المرحلة الثانية والثالثة: الخصم الفعلي بعد نجاح التوليد السحابي
 * تتضمن آلية Idempotency لمنع تكرار الخصم عند إعادة إرسال الطلب (requestId).
 * لا تُستدعى إلا بعد تأكيد نجاح الاستجابة من الموديل السحابي.
 */
export async function deductAiQuota(params: {
  accessCodeId?: number;
  credits?: number;
  requestId?: string;
}): Promise<DeductAiQuotaResult> {
  if (!params.accessCodeId) {
    return { deducted: false, duplicate: false, creditsDeducted: 0 };
  }
  const creditsToDeduct = params.credits ?? 1;
  if (creditsToDeduct <= 0) {
    return { deducted: false, duplicate: false, creditsDeducted: 0 };
  }

  // فحص معرّف الطلب لمنع الخصم المزدوج
  const trimmedKey = params.requestId?.trim();
  if (trimmedKey) {
    cleanupExpiredIdempotencyKeys();
    const existing = idempotencyCache.get(trimmedKey);
    if (existing) {
      // الطلب مكرر وسَبَق خصمه بنجاح لنفس العملية
      return { deducted: false, duplicate: true, creditsDeducted: 0 };
    }
    // تسجيل المعرف لحماية العمليات المتزامنة
    idempotencyCache.set(trimmedKey, {
      accessCodeId: params.accessCodeId,
      credits: creditsToDeduct,
      timestamp: Date.now(),
    });
  }

  try {
    const db = await getDb();
    if (!db) {
      if (trimmedKey) {
        idempotencyCache.delete(trimmedKey);
      }
      return { deducted: false, duplicate: false, creditsDeducted: 0 };
    }

    await db.update(accessCodes)
      .set({
        aiCreditsUsed: sql`${accessCodes.aiCreditsUsed} + ${creditsToDeduct}`,
        aiDailyUsed: sql`${accessCodes.aiDailyUsed} + ${creditsToDeduct}`,
        lastUsedAt: new Date(),
      })
      .where(eq(accessCodes.id, params.accessCodeId));

    return { deducted: true, duplicate: false, creditsDeducted: creditsToDeduct };
  } catch (err) {
    console.error('[AI Quota Gate] Failed to deduct quota:', err);
    if (trimmedKey) {
      idempotencyCache.delete(trimmedKey);
    }
    return { deducted: false, duplicate: false, creditsDeducted: 0 };
  }
}

/**
 * توثيق استهلاك وسجلات الذكاء الاصطناعي
 */
export async function logAiUsage(input: AiUsageLogInput): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    await db.insert(aiUsageLogs).values({
      userId: input.userId,
      accessCodeId: input.accessCodeId,
      feature: input.feature,
      provider: input.provider,
      model: input.model,
      status: input.status,
      responseTimeMs: input.responseTimeMs ?? 0,
    });
  } catch (err) {
    console.error('[AI Quota Gate] Failed to log usage:', err);
  }
}

/**
 * استعلام حالة ورصيد المستخدم
 */
export async function getUserAiQuotaStatus(userId: number) {
  try {
    const db = await getDb();
    if (!db) return null;

    const user = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
    if (!user) return null;

    if (user.role === 'admin') {
      return {
        isUnlimited: true,
        creditsTotal: -1,
        creditsUsed: 0,
        creditsRemaining: -1,
        dailyLimit: -1,
        dailyUsed: 0,
        dailyRemaining: -1,
      };
    }

    const code = (await db.select().from(accessCodes).where(eq(accessCodes.sessionOpenId, user.openId)).limit(1))[0];
    if (!code) {
      return {
        isUnlimited: true,
        creditsTotal: -1,
        creditsUsed: 0,
        creditsRemaining: -1,
        dailyLimit: -1,
        dailyUsed: 0,
        dailyRemaining: -1,
      };
    }

    const remainingCredits = code.aiCreditsTotal === -1 ? -1 : Math.max(0, code.aiCreditsTotal - code.aiCreditsUsed);
    const dailyRemaining = code.aiDailyLimit === -1 ? -1 : Math.max(0, code.aiDailyLimit - code.aiDailyUsed);

    return {
      isUnlimited: code.aiCreditsTotal === -1 && code.aiDailyLimit === -1,
      creditsTotal: code.aiCreditsTotal,
      creditsUsed: code.aiCreditsUsed,
      creditsRemaining: remainingCredits,
      dailyLimit: code.aiDailyLimit,
      dailyUsed: code.aiDailyUsed,
      dailyRemaining,
      dailyResetAt: code.aiDailyResetAt,
    };
  } catch (err) {
    console.error('[AI Quota Gate] Failed to fetch user quota status:', err);
    return null;
  }
}

/**
 * استعراض سجلات الاستهلاك للمطور
 */
export async function listAiUsageLogs(limit = 50) {
  try {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(aiUsageLogs).orderBy(desc(aiUsageLogs.createdAt)).limit(limit);
  } catch (err) {
    console.error('[AI Quota Gate] Failed to list usage logs:', err);
    return [];
  }
}
