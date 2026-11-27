/**
 * يحدّ محاولات دخول لوحة المطور الخاطئة لكل عنوان: بعد 5 فشلات خلال 15 دقيقة
 * يُقفل العنوان 15 دقيقة. الحالة في الذاكرة فقط وتُصفّر عند إعادة تشغيل الخادم.
 */
export type LoginLimiterOptions = { maxFailures?: number; windowMs?: number; lockMs?: number; now?: () => number };

export function createLoginLimiter(options: LoginLimiterOptions = {}) {
  const maxFailures = options.maxFailures ?? 5;
  const windowMs = options.windowMs ?? 15 * 60_000;
  const lockMs = options.lockMs ?? 15 * 60_000;
  const now = options.now ?? Date.now;
  const entries = new Map<string, { failures: number[]; lockedUntil: number }>();

  function prune() {
    if (entries.size < 500) return;
    const current = now();
    entries.forEach((entry, key) => {
      if (entry.lockedUntil <= current && entry.failures.every((time) => current - time > windowMs)) entries.delete(key);
    });
  }

  return {
    /** ثواني الانتظار المتبقية إذا كان العنوان مقفلاً، وإلا 0. */
    retryAfterSeconds(key: string): number {
      const entry = entries.get(key);
      if (!entry) return 0;
      const remaining = entry.lockedUntil - now();
      return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
    },
    recordFailure(key: string) {
      prune();
      const current = now();
      const entry = entries.get(key) ?? { failures: [], lockedUntil: 0 };
      entry.failures = entry.failures.filter((time) => current - time <= windowMs);
      entry.failures.push(current);
      if (entry.failures.length >= maxFailures) {
        entry.lockedUntil = current + lockMs;
        entry.failures = [];
      }
      entries.set(key, entry);
    },
    recordSuccess(key: string) {
      entries.delete(key);
    },
  };
}

export const developerLoginLimiter = createLoginLimiter();

/**
 * عنوان العميل خلف وكيل الاستضافة: آخر قيمة في x-forwarded-for يضيفها الوكيل نفسه ولا يستطيع
 * العميل تزويرها. من دون الوكيل نستخدم عنوان الاتصال المباشر.
 */
export function clientKeyFromRequest(request: { headers: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } }): string {
  const forwarded = request.headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded.join(",") : forwarded;
  const last = raw?.split(",").map((part) => part.trim()).filter(Boolean).pop();
  return last || request.socket?.remoteAddress || "unknown";
}
