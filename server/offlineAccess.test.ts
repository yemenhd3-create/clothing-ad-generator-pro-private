// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { clearOfflineLease, hasValidOfflineLease, saveOfflineLease } from '../client/src/lib/offlineAccess';

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
  });
});
