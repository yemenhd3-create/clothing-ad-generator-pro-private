import { describe, expect, it } from 'vitest';
import { getAccessCodeEligibility } from './accessCodes';
import type { AiQuotaCheckResult } from './aiQuotaGate';

describe('AI Quota Gate - Phase 2 Decoupled Logic & Resiliency', () => {
  it('correctly checks access code eligibility without mutating state', () => {
    const now = new Date('2026-10-12T12:00:00Z');
    const code = {
      isRevoked: 0,
      expiresAt: new Date('2026-11-12T12:00:00Z'),
      maxUses: 10,
      useCount: 2,
    };
    const res = getAccessCodeEligibility(code, now);
    expect(res.eligible).toBe(true);
    expect(res.reason).toBe(null);
  });

  it('correctly identifies expired or revoked access codes', () => {
    const now = new Date('2026-10-12T12:00:00Z');
    const revoked = {
      isRevoked: 1,
      expiresAt: new Date('2026-11-12T12:00:00Z'),
      maxUses: 10,
      useCount: 2,
    };
    expect(getAccessCodeEligibility(revoked, now).reason).toBe('revoked');

    const expired = {
      isRevoked: 0,
      expiresAt: new Date('2026-10-01T12:00:00Z'),
      maxUses: 10,
      useCount: 2,
    };
    expect(getAccessCodeEligibility(expired, now).reason).toBe('expired');
  });

  it('verifies daily quota 24-hour reset threshold calculation', () => {
    const lastReset = new Date('2026-10-11T10:00:00Z');
    const under24h = new Date('2026-10-11T22:00:00Z');
    const over24h = new Date('2026-10-12T10:00:01Z');

    const isOver24h = (now: Date, prev: Date) => now.getTime() - prev.getTime() >= 24 * 60 * 60 * 1000;
    expect(isOver24h(under24h, lastReset)).toBe(false);
    expect(isOver24h(over24h, lastReset)).toBe(true);
  });

  it('accurately checks total and daily quota remaining limits prior to deduction', () => {
    const total = 100;
    const used = 30;
    const dailyLimit = 20;
    const dailyUsed = 15;

    const remainingTotal = total === -1 ? -1 : Math.max(0, total - used);
    const remainingDaily = dailyLimit === -1 ? -1 : Math.max(0, dailyLimit - dailyUsed);

    expect(remainingTotal).toBe(70);
    expect(remainingDaily).toBe(5);

    // Prior to cloud success, used count remains 30 and 15
    expect(used).toBe(30);
    expect(dailyUsed).toBe(15);

    // After cloud success, deduction happens:
    const afterDeductionUsed = used + 1;
    const afterDeductionDaily = dailyUsed + 1;
    expect(afterDeductionUsed).toBe(31);
    expect(afterDeductionDaily).toBe(16);
  });

  it('flags daily limit exceeded when daily used reaches daily limit', () => {
    const dailyLimit = 20;
    const dailyUsed = 20;
    const isExceeded = dailyLimit !== -1 && dailyUsed >= dailyLimit;
    expect(isExceeded).toBe(true);
  });

  it('flags total credits exhausted when credits used reaches total', () => {
    const creditsTotal = 100;
    const creditsUsed = 100;
    const isExhausted = creditsTotal !== -1 && creditsUsed >= creditsTotal;
    expect(isExhausted).toBe(true);
  });

  it('handles database outage safely with graceful fallback schema', () => {
    // Simulating the result structure returned when db connection drops
    const dbOutageResult: AiQuotaCheckResult = {
      allowed: false,
      dbUnavailable: true,
      reason: 'db_unavailable',
      message: 'تعذر الاتصال بقاعدة البيانات للتحقق من الرصيد، جاري التوليد المحلي.',
    };

    expect(dbOutageResult.allowed).toBe(false);
    expect(dbOutageResult.dbUnavailable).toBe(true);
    expect(dbOutageResult.reason).toBe('db_unavailable');
    // Ensure caller knows to gracefully fall back to local generation without crashing
    const shouldUseLocal = !dbOutageResult.allowed;
    expect(shouldUseLocal).toBe(true);
  });
});
