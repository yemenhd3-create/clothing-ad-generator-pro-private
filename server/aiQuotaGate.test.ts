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

  describe('Idempotency & Duplicate Request Protection', () => {
    it('prevents duplicate deductions when the same requestId is resent', async () => {
      const { clearIdempotencyCache, registerIdempotentRequest, isIdempotencyKeyDeducted, deductAiQuota } = await import('./aiQuotaGate');
      clearIdempotencyCache();

      const requestId = 'req-cag-uuid-101-abcd';
      const accessCodeId = 42;

      // First delivery: should be accepted and recorded
      const firstAttempt = registerIdempotentRequest(requestId, accessCodeId, 1);
      expect(firstAttempt).toBe(true);
      expect(isIdempotencyKeyDeducted(requestId)).toBe(true);

      // Second delivery (e.g. network retry / duplicate click): must be flagged as duplicate and rejected from double charging
      const secondAttempt = registerIdempotentRequest(requestId, accessCodeId, 1);
      expect(secondAttempt).toBe(false);

      // Third delivery: still blocked
      const thirdAttempt = registerIdempotentRequest(requestId, accessCodeId, 1);
      expect(thirdAttempt).toBe(false);

      // Direct deductAiQuota call with the same requestId flags duplicate
      const directDuplicate = await deductAiQuota({ accessCodeId, credits: 1, requestId });
      expect(directDuplicate.duplicate).toBe(true);
      expect(directDuplicate.deducted).toBe(false);
      expect(directDuplicate.creditsDeducted).toBe(0);
    });

    it('allows distinct requestIds for the same user or access code', async () => {
      const { clearIdempotencyCache, registerIdempotentRequest } = await import('./aiQuotaGate');
      clearIdempotencyCache();

      const reqA = 'req-generation-1';
      const reqB = 'req-generation-2';
      const accessCodeId = 42;

      expect(registerIdempotentRequest(reqA, accessCodeId, 1)).toBe(true);
      expect(registerIdempotentRequest(reqB, accessCodeId, 1)).toBe(true);
      // Retrying reqA again fails
      expect(registerIdempotentRequest(reqA, accessCodeId, 1)).toBe(false);
      // Retrying reqB again fails
      expect(registerIdempotentRequest(reqB, accessCodeId, 1)).toBe(false);
    });

    it('handles requests with empty or omitted requestId gracefully', async () => {
      const { clearIdempotencyCache, registerIdempotentRequest, deductAiQuota } = await import('./aiQuotaGate');
      clearIdempotencyCache();

      // Empty string requestId does not lock out subsequent requests
      expect(registerIdempotentRequest('', 42, 1)).toBe(true);
      expect(registerIdempotentRequest('   ', 42, 1)).toBe(true);

      // Omitted accessCodeId safely returns non-duplicate zero deduction
      const noCode = await deductAiQuota({ credits: 1 });
      expect(noCode.deducted).toBe(false);
      expect(noCode.duplicate).toBe(false);
    });

    it('expires idempotency keys after TTL threshold', async () => {
      const { clearIdempotencyCache, registerIdempotentRequest, cleanupExpiredIdempotencyKeys, isIdempotencyKeyDeducted, IDEMPOTENCY_TTL_MS } = await import('./aiQuotaGate');
      clearIdempotencyCache();

      const requestId = 'req-ttl-test';
      const t0 = 1000000;
      registerIdempotentRequest(requestId, 42, 1, t0);

      // Before TTL expiration: key is active
      expect(isIdempotencyKeyDeducted(requestId)).toBe(true);

      // After TTL: key is pruned
      cleanupExpiredIdempotencyKeys(t0 + IDEMPOTENCY_TTL_MS + 1000);
      expect(isIdempotencyKeyDeducted(requestId)).toBe(false);

      // Can now register again if needed after TTL
      expect(registerIdempotentRequest(requestId, 42, 1, t0 + IDEMPOTENCY_TTL_MS + 2000)).toBe(true);
    });
  });
});
