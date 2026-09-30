// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { clearOfflineLease, hasValidOfflineLease, saveOfflineLease, readOfflineLease } from '../client/src/lib/offlineAccess';

function buildMockJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/=/g, '');
  const body = btoa(JSON.stringify(payload)).replace(/=/g, '');
  const signature = 'mockSignatureString12345';
  return `${header}.${body}.${signature}`;
}

describe('offline access lease', () => {
  afterEach(() => {
    clearOfflineLease();
  });

  it('grants a lease that is valid until its configured expiry', () => {
    saveOfflineLease(2);
    expect(hasValidOfflineLease()).toBe(true);
  });

  it('rejects a zero-hour lease and clears expired local access', () => {
    saveOfflineLease(0);
    expect(hasValidOfflineLease()).toBe(false);
    expect(localStorage.getItem('clothing-ad-generator:offline-lease-v1')).toBeNull();
    expect(localStorage.getItem('clothing-ad-offline-lease-v1')).toBeNull();
  });

  it('extracts expiry from signed token and validates lease', () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const token = buildMockJwt({
      sub: '123',
      graceHours: 72,
      type: 'offline_lease',
      iat: nowSec,
      exp: nowSec + 72 * 3600,
    });
    const lease = saveOfflineLease(72, token);
    expect(lease.token).toBe(token);
    expect(hasValidOfflineLease()).toBe(true);
    const stored = readOfflineLease();
    expect(stored?.token).toBe(token);
  });

  it('detects clock tampering when device clock is rolled back before verifiedAt', () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const token = buildMockJwt({
      sub: '123',
      graceHours: 72,
      type: 'offline_lease',
      iat: nowSec,
      exp: nowSec + 72 * 3600,
    });
    const nowMs = nowSec * 1000;
    saveOfflineLease(72, token);

    // Roll clock back 1 hour before verification
    const rolledBackClock = nowMs - 3600 * 1000;
    expect(hasValidOfflineLease(rolledBackClock)).toBe(false);
    expect(readOfflineLease()).toBeNull();
  });

  it('detects clock tampering when device clock is rolled back during offline session', () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const token = buildMockJwt({
      sub: '123',
      graceHours: 72,
      type: 'offline_lease',
      iat: nowSec,
      exp: nowSec + 72 * 3600,
    });
    const nowMs = nowSec * 1000;
    saveOfflineLease(72, token);

    // App used at now + 2 hours
    expect(hasValidOfflineLease(nowMs + 2 * 3600 * 1000)).toBe(true);

    // User tries to roll back to now + 1 hour
    expect(hasValidOfflineLease(nowMs + 1 * 3600 * 1000)).toBe(false);
    expect(readOfflineLease()).toBeNull();
  });
});
