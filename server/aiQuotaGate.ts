import { and, desc, eq, sql } from 'drizzle-orm';
import { accessCodes, aiUsageLogs, users } from '../drizzle/schema';
import { getDb } from './db';

export type AiQuotaCheckResult = {
  allowed: boolean;
  reason?: 'daily_limit_exceeded' | 'credits_exhausted' | 'user_inactive';
  message?: string;
  isDeveloper?: boolean;
  accessCodeId?: number;
  remainingCredits?: number;
  dailyRemaining?: number;
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

export async function checkAndDeductAiQuota(params: {
  userId: number;
  feature: 'marketing_text' | 'connected_leader';
}): Promise<AiQuotaCheckResult> {
  const db = await getDb();
  if (!db) return { allowed: true };

  const user = (await db.select().from(users).where(eq(users.id, params.userId)).limit(1))[0];
  if (!user) return { allowed: false, reason: 'user_inactive', message: 'المستخدم غير موجود' };

  // استثناء حساب المطور / المشرف برصيد غير محدود
  if (user.role === 'admin') {
    return { allowed: true, isDeveloper: true, remainingCredits: -1, dailyRemaining: -1 };
  }

  // البحث عن كود الوصول المرتبط بالمستخدم
  const code = (await db.select().from(accessCodes).where(eq(accessCodes.sessionOpenId, user.openId)).limit(1))[0];
  if (!code) {
    // حساب لا يرتبط بكود وصول محدد (افتراضي آمن ومسموح)
    return { allowed: true, remainingCredits: -1, dailyRemaining: -1 };
  }

  const now = new Date();
  const resetIntervalMs = 24 * 60 * 60 * 1000;
  const timeSinceReset = now.getTime() - code.aiDailyResetAt.getTime();
  let currentDailyUsed = code.aiDailyUsed;

  // إعادة ضبط العداد اليومي تلقائياً عند مرور 24 ساعة
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

  // فحص إجمالي الرصيد المتاح
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

  // خصم نقطة واحدة من العداد الإجمالي واليومي
  await db.update(accessCodes)
    .set({
      aiCreditsUsed: sql`${accessCodes.aiCreditsUsed} + 1`,
      aiDailyUsed: sql`${accessCodes.aiDailyUsed} + 1`,
      lastUsedAt: now,
    })
    .where(eq(accessCodes.id, code.id));

  const remainingCredits = code.aiCreditsTotal === -1 ? -1 : Math.max(0, code.aiCreditsTotal - (code.aiCreditsUsed + 1));
  const dailyRemaining = code.aiDailyLimit === -1 ? -1 : Math.max(0, code.aiDailyLimit - (currentDailyUsed + 1));

  return {
    allowed: true,
    accessCodeId: code.id,
    remainingCredits,
    dailyRemaining,
  };
}

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

export async function getUserAiQuotaStatus(userId: number) {
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
}

export async function listAiUsageLogs(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(aiUsageLogs).orderBy(desc(aiUsageLogs.createdAt)).limit(limit);
}
