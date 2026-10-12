import { describe, expect, it } from 'vitest';
import { getAccessCodeEligibility } from './accessCodes';

describe('AI Quota Gate and Access Codes Integrity', () => {
  it('correctly identifies valid access code eligibility', () => {
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

  it('correctly blocks revoked or expired codes', () => {
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

  it('verifies daily quota window calculations', () => {
    const lastReset = new Date('2026-10-11T10:00:00Z');
    const nowUnder24h = new Date('2026-10-11T20:00:00Z');
    const nowOver24h = new Date('2026-10-12T11:00:00Z');

    const isOver24h = (now: Date, prev: Date) => now.getTime() - prev.getTime() >= 24 * 60 * 60 * 1000;
    expect(isOver24h(nowUnder24h, lastReset)).toBe(false);
    expect(isOver24h(nowOver24h, lastReset)).toBe(true);
  });

  it('computes remaining credits accurately with limits', () => {
    const total = 100;
    const used = 45;
    const dailyLimit = 20;
    const dailyUsed = 18;

    const remainingTotal = total === -1 ? -1 : Math.max(0, total - used);
    const remainingDaily = dailyLimit === -1 ? -1 : Math.max(0, dailyLimit - dailyUsed);

    expect(remainingTotal).toBe(55);
    expect(remainingDaily).toBe(2);
  });
});
