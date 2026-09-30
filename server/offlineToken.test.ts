import { describe, expect, it } from 'vitest';
import { createOfflineLeaseToken, verifyOfflineLeaseToken } from './offlineToken';

describe('server offlineToken', () => {
  it('creates and verifies a server-signed JWT offline lease token', async () => {
    const token = await createOfflineLeaseToken(123, 72);
    expect(typeof token).toBe('string');
    const verified = await verifyOfflineLeaseToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.sub).toBe('123');
    expect(verified?.graceHours).toBe(72);
    expect(verified?.type).toBe('offline_lease');
  });

  it('rejects an invalid or tampered token', async () => {
    const token = await createOfflineLeaseToken(123, 72);
    const tampered = token.slice(0, -4) + 'abcd';
    const verified = await verifyOfflineLeaseToken(tampered);
    expect(verified).toBeNull();
  });
});
