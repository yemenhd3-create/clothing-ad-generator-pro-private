export type AiProviderErrorKind =
  | 'INVALID_KEY'
  | 'QUOTA_EXHAUSTED'
  | 'RATE_LIMIT'
  | 'SERVICE_UNAVAILABLE'
  | 'BAD_REQUEST'
  | 'UNKNOWN';

export type ClassifiedProviderError = {
  kind: AiProviderErrorKind;
  status?: number;
  isRetryable: boolean;
  shouldCooldown: boolean;
  cooldownMs: number;
  message: string;
};

const COOLDOWN_15_MIN = 15 * 60 * 1000;
const COOLDOWN_30_SEC = 30 * 1000;
const COOLDOWN_10_SEC = 10 * 1000;

export function classifyProviderError(status?: number, errorBodyOrMessage?: unknown): ClassifiedProviderError {
  const text = errorBodyOrMessage instanceof Error
    ? `${errorBodyOrMessage.name} ${errorBodyOrMessage.message}`.toLowerCase()
    : typeof errorBodyOrMessage === 'string'
      ? errorBodyOrMessage.toLowerCase()
      : typeof errorBodyOrMessage === 'object' && errorBodyOrMessage !== null
        ? JSON.stringify(errorBodyOrMessage).toLowerCase()
        : '';

  // 1. Quota / balance exhaustion
  if (
    status === 402 ||
    text.includes('insufficient_quota') ||
    text.includes('quota_exceeded') ||
    text.includes('exceeded your current quota') ||
    text.includes('out_of_credits') ||
    text.includes('billing') ||
    text.includes('payment_required') ||
    (status === 429 && (text.includes('quota') || text.includes('credit') || text.includes('balance')))
  ) {
    return {
      kind: 'QUOTA_EXHAUSTED',
      status: status ?? 402,
      isRetryable: false,
      shouldCooldown: true,
      cooldownMs: COOLDOWN_15_MIN,
      message: 'وصل المزود لكن الحصة أو الرصيد غير متاح حالياً.',
    };
  }

  // 2. Invalid or unauthorized key
  if (
    status === 401 ||
    status === 403 ||
    text.includes('invalid api key') ||
    text.includes('invalid_api_key') ||
    text.includes('unauthorized') ||
    text.includes('forbidden') ||
    text.includes('bad_api_key') ||
    text.includes('key not found')
  ) {
    return {
      kind: 'INVALID_KEY',
      status: status ?? 401,
      isRetryable: false,
      shouldCooldown: true,
      cooldownMs: COOLDOWN_15_MIN,
      message: 'رفض المزود المفتاح أو الصلاحية (مفتاح غير صالح أو ملغى).',
    };
  }

  // 3. Transient rate limit
  if (
    status === 429 ||
    text.includes('rate_limit') ||
    text.includes('rate limit') ||
    text.includes('too many requests') ||
    text.includes('tpm') ||
    text.includes('rpm')
  ) {
    return {
      kind: 'RATE_LIMIT',
      status: 429,
      isRetryable: true,
      shouldCooldown: true,
      cooldownMs: COOLDOWN_30_SEC,
      message: 'وصل المزود لكنه يطبق حد الطلبات اللحظي حالياً. يجري التهدئة المؤقتة.',
    };
  }

  // 4. Service unavailable or timeout
  if (
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    text.includes('aborterror') ||
    text.includes('timeout') ||
    text.includes('etimedout') ||
    text.includes('econnreset') ||
    text.includes('econnrefused') ||
    text.includes('fetch failed')
  ) {
    return {
      kind: 'SERVICE_UNAVAILABLE',
      status: status ?? 503,
      isRetryable: true,
      shouldCooldown: true,
      cooldownMs: COOLDOWN_10_SEC,
      message: 'تعذر الوصول إلى خوادم المزود أو انتهت مهلة الاستجابة.',
    };
  }

  // 5. Bad request
  if (status === 400) {
    return {
      kind: 'BAD_REQUEST',
      status: 400,
      isRetryable: false,
      shouldCooldown: false,
      cooldownMs: 0,
      message: 'بيانات الطلب غير مقبولة لدى المزود.',
    };
  }

  return {
    kind: 'UNKNOWN',
    status,
    isRetryable: false,
    shouldCooldown: false,
    cooldownMs: 0,
    message: 'تعذر اعتماد المزود بسبب استجابة غير متوقعة.',
  };
}

const GLOBAL_COOLDOWNS_KEY = Symbol.for('clogen.providerCooldowns');
const providerCooldowns: Map<string, number> =
  (globalThis as unknown as Record<symbol, Map<string, number>>)[GLOBAL_COOLDOWNS_KEY] ??
  new Map<string, number>();
(globalThis as unknown as Record<symbol, Map<string, number>>)[GLOBAL_COOLDOWNS_KEY] = providerCooldowns;

export function markProviderCooldown(providerId: string, cooldownMs: number, now = Date.now()): void {
  if (!providerId || cooldownMs <= 0) return;
  providerCooldowns.set(providerId, now + cooldownMs);
}

export function isProviderInCooldown(providerId: string, now = Date.now()): boolean {
  if (!providerId) return false;
  const until = providerCooldowns.get(providerId);
  if (!until) return false;
  if (now >= until) {
    providerCooldowns.delete(providerId);
    return false;
  }
  return true;
}

export function resetProviderCooldown(providerId: string): void {
  providerCooldowns.delete(providerId);
}

export function clearAllProviderCooldowns(): void {
  providerCooldowns.clear();
}

export type ProviderCooldownStatus = {
  inCooldown: boolean;
  remainingMs: number;
  until: number;
};

export function getActiveProviderCooldowns(now = Date.now()): Record<string, ProviderCooldownStatus> {
  const result: Record<string, ProviderCooldownStatus> = {};
  providerCooldowns.forEach((until, providerId) => {
    if (now < until) {
      result[providerId] = {
        inCooldown: true,
        remainingMs: Math.max(0, until - now),
        until,
      };
    } else {
      providerCooldowns.delete(providerId);
    }
  });
  return result;
}
