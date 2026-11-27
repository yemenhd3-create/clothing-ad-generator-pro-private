import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEVELOPER_SESSION_COOKIE,
  DEVELOPER_SESSION_MAX_AGE_MS,
  isDeveloperSession,
  issueDeveloperSession,
} from './developerSession';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-developer-session';

function reqWithToken(token: string) {
  return { headers: { cookie: `${DEVELOPER_SESSION_COOKIE}=${token}` } } as const;
}

describe('جلسة المطور القصيرة', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-28T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('مدة الجلسة ساعة واحدة فقط', () => {
    expect(DEVELOPER_SESSION_MAX_AGE_MS).toBe(60 * 60 * 1000);
  });

  it('يقبل الجلسة الصالحة خلال المدة', () => {
    const token = issueDeveloperSession();
    expect(isDeveloperSession(reqWithToken(token))).toBe(true);
    vi.advanceTimersByTime(59 * 60 * 1000);
    expect(isDeveloperSession(reqWithToken(token))).toBe(true);
  });

  it('ينتهي تلقائياً بعد ساعة', () => {
    const token = issueDeveloperSession();
    vi.advanceTimersByTime(DEVELOPER_SESSION_MAX_AGE_MS + 1000);
    expect(isDeveloperSession(reqWithToken(token))).toBe(false);
  });

  it('يرفض توقيعاً معدلاً', () => {
    const token = issueDeveloperSession();
    const [expiresAt] = token.split('.');
    expect(isDeveloperSession(reqWithToken(`${expiresAt}.forgedsignature`))).toBe(false);
  });

  it('يرفض غياب الرمز', () => {
    expect(isDeveloperSession({ headers: {} } as const)).toBe(false);
  });
});
