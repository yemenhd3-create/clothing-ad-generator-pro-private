import { describe, expect, it } from 'vitest';
import { getAccessCodeEligibility, normalizeAccessCode } from './accessCodes';

describe('رموز الدخول', () => {
  it('يطبع الرمز المكتوب على الهاتف من دون الاعتماد على المسافات أو الشرطات أو حالة الأحرف', () => {
    expect(normalizeAccessCode(' cag-ab12c - d3e4f ')).toBe('CAGAB12CD3E4F');
  });

  it('يسمح بالرمز النشط المفتوح', () => {
    expect(getAccessCodeEligibility({ isRevoked: 0, expiresAt: null, maxUses: null, useCount: 0 })).toEqual({ eligible: true, reason: null });
  });

  it('يرفض الرمز الملغى حتى قبل فحص الاستخدام', () => {
    expect(getAccessCodeEligibility({ isRevoked: 1, expiresAt: null, maxUses: null, useCount: 0 })).toEqual({ eligible: false, reason: 'revoked' });
  });

  it('يرفض الرمز المنتهي والرمز الذي بلغ عدد استخداماته', () => {
    const now = new Date('2026-08-17T17:30:00.000Z');
    expect(getAccessCodeEligibility({ isRevoked: 0, expiresAt: new Date('2026-08-17T17:29:59.000Z'), maxUses: null, useCount: 0 }, now)).toEqual({ eligible: false, reason: 'expired' });
    expect(getAccessCodeEligibility({ isRevoked: 0, expiresAt: null, maxUses: 2, useCount: 2 }, now)).toEqual({ eligible: false, reason: 'exhausted' });
  });
});
