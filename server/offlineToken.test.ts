import { describe, expect, it, vi } from 'vitest';

// The real public key file holds the PRODUCTION public key. For tests we mock
// it with the dedicated test-only public key (paired with the test-only
// private key set in server/testSetup.ts), so no production key material is
// ever needed to run the test suite.
vi.mock('../client/src/lib/offlinePublicKey', () => ({
  OFFLINE_LEASE_PUBLIC_JWK: {
    kty: 'EC',
    crv: 'P-256',
    x: 'sZVDcDvW5uhltRbQp1xj4OZO2G7H0hoEb1lOXNYko6o',
    y: '_Y-Ui4tXRZF_KGsgOjKhMMH14zVkX4W5pqzbwtkuMEA',
  },
}));

const { createOfflineLeaseToken, verifyOfflineLeaseToken } = await import('./offlineToken');
const { verifyOfflineLeaseTokenCryptographically } = await import('../client/src/lib/offlineAccess');

describe('asymmetric offline lease token (ES256)', () => {
  it('server creates token with private key and client verifies with public key', async () => {
    const token = await createOfflineLeaseToken(999, 72);
    expect(typeof token).toBe('string');

    // Server verification
    const serverVerified = await verifyOfflineLeaseToken(token);
    expect(serverVerified).not.toBeNull();
    expect(serverVerified?.sub).toBe('999');
    expect(serverVerified?.graceHours).toBe(72);
    expect(serverVerified?.type).toBe('offline_lease');

    // Client asymmetric verification (uses ONLY public key)
    const clientVerified = await verifyOfflineLeaseTokenCryptographically(token);
    expect(clientVerified).not.toBeNull();
    expect(clientVerified?.sub).toBe('999');
    expect(clientVerified?.graceHours).toBe(72);
    expect(clientVerified?.type).toBe('offline_lease');
  });

  it('cryptographically rejects a tampered payload (modified expiry or grace hours)', async () => {
    const token = await createOfflineLeaseToken(999, 72);
    const [header, payload, signature] = token.split('.');
    
    // Tamper payload: increase grace hours to 9999
    const decodedPayload = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    decodedPayload.graceHours = 9999;
    decodedPayload.exp = decodedPayload.exp + 100000;
    const tamperedPayloadB64 = Buffer.from(JSON.stringify(decodedPayload)).toString('base64url');
    const tamperedToken = `${header}.${tamperedPayloadB64}.${signature}`;

    // Both client and server must reject the tampered token
    const clientResult = await verifyOfflineLeaseTokenCryptographically(tamperedToken);
    expect(clientResult).toBeNull();

    const serverResult = await verifyOfflineLeaseToken(tamperedToken);
    expect(serverResult).toBeNull();
  });

  it('cryptographically rejects a forged signature', async () => {
    const token = await createOfflineLeaseToken(999, 72);
    const tamperedToken = token.slice(0, -6) + 'xxxxxx';

    const clientResult = await verifyOfflineLeaseTokenCryptographically(tamperedToken);
    expect(clientResult).toBeNull();
  });

  it('rejects an expired token', async () => {
    // Token with 0 grace hours (already expired)
    const token = await createOfflineLeaseToken(999, -1);
    
    const clientResult = await verifyOfflineLeaseTokenCryptographically(token);
    expect(clientResult).toBeNull();

    const serverResult = await verifyOfflineLeaseToken(token);
    expect(serverResult).toBeNull();
  });
});
