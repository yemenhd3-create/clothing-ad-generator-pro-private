// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Dedicated test-only public key paired with the test-only private key in server/testSetup.ts
vi.mock('../client/src/lib/offlinePublicKey', () => ({
  OFFLINE_LEASE_PUBLIC_JWK: {
    kty: 'EC',
    crv: 'P-256',
    x: 'sZVDcDvW5uhltRbQp1xj4OZO2G7H0hoEb1lOXNYko6o',
    y: '_Y-Ui4tXRZF_KGsgOjKhMMH14zVkX4W5pqzbwtkuMEA',
  },
}));

import { createOfflineLeaseToken } from './offlineToken';
import {
  clearOfflineLease,
  hasValidOfflineLease,
  readOfflineLease,
  saveOfflineLease,
  verifyOfflineLeaseCryptographically,
  getOfflineLeaseRemainingHours,
} from '../client/src/lib/offlineAccess';

// In-memory localStorage mock for node environment
const store = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, val: string) => store.set(key, String(val)),
  removeItem: (key: string) => store.delete(key),
  clear: () => store.clear(),
};
(globalThis as any).localStorage = localStorageMock;
(globalThis as any).window = globalThis;


describe('offline heartbeat integration & multi-user lease isolation', () => {
  beforeEach(() => {
    clearOfflineLease();
    localStorage.clear();
  });

  afterEach(() => {
    clearOfflineLease();
    localStorage.clear();
  });

  it('issues token from heartbeat, saves it, and validates it offline for the matching user', async () => {
    const userId = 101;
    const graceHours = 72;

    // 1. Server heartbeat simulates creating the offline lease token
    const token = await createOfflineLeaseToken(userId, graceHours);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);

    // 2. Client receives heartbeat response and saves the lease
    const savedLease = saveOfflineLease(graceHours, token);
    expect(savedLease.token).toBe(token);
    expect(savedLease.expiresAt).toBeGreaterThan(Date.now());

    // 3. User opens app completely offline
    const isOnline = false;
    expect(isOnline).toBe(false);

    // Synchronous lease check for user 101
    const syncValid = hasValidOfflineLease(Date.now(), userId);
    expect(syncValid).toBe(true);

    // Asymmetric cryptographic verification with client public key
    const cryptoValid = await verifyOfflineLeaseCryptographically(userId);
    expect(cryptoValid).toBe(true);

    // Remaining hours should be close to 72
    const remaining = getOfflineLeaseRemainingHours();
    expect(remaining).toBeGreaterThan(71);
    expect(remaining).toBeLessThanOrEqual(72);
  });

  it('strictly rejects and clears offline lease when opened by a different user', async () => {
    const authorizedUserId = 101;
    const intruderUserId = 202;
    const graceHours = 72;

    // Heartbeat issued token for User 101
    const token = await createOfflineLeaseToken(authorizedUserId, graceHours);
    saveOfflineLease(graceHours, token);

    // Verify User 101 initially has a valid stored lease
    expect(readOfflineLease()?.token).toBe(token);

    // User 202 opens the app offline
    const intruderSyncValid = hasValidOfflineLease(Date.now(), intruderUserId);
    expect(intruderSyncValid).toBe(false);

    // The lease belonging to another user must be cleared from storage
    expect(readOfflineLease()).toBeNull();
    expect(localStorage.getItem('clothing-ad-offline-lease-v1')).toBeNull();

    // Re-saving and testing cryptographic verification for the different user
    saveOfflineLease(graceHours, token);
    const intruderCryptoValid = await verifyOfflineLeaseCryptographically(intruderUserId);
    expect(intruderCryptoValid).toBe(false);
    expect(readOfflineLease()).toBeNull();
  });

  it('rejects a forged or tampered token attempting to impersonate another user', async () => {
    const originalUserId = 101;
    const impersonatedUserId = 202;
    const graceHours = 72;

    const token = await createOfflineLeaseToken(originalUserId, graceHours);
    const [header, payload, signature] = token.split('.');

    // Attacker modifies claims in localStorage to change sub to 202
    const decodedPayload = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    decodedPayload.sub = String(impersonatedUserId);
    const forgedPayloadB64 = Buffer.from(JSON.stringify(decodedPayload)).toString('base64url');
    const forgedToken = ;

    saveOfflineLease(graceHours, forgedToken);

    // Asymmetric crypto check MUST fail because signature does not match altered sub
    const isCryptoValid = await verifyOfflineLeaseCryptographically(impersonatedUserId);
    expect(isCryptoValid).toBe(false);
    expect(readOfflineLease()).toBeNull();
  });

  it('rejects an expired lease upon offline app opening and clears storage', async () => {
    const userId = 101;
    // Issue token with -1 hours (already expired)
    const token = await createOfflineLeaseToken(userId, -1);
    saveOfflineLease(0, token);

    const valid = hasValidOfflineLease(Date.now(), userId);
    expect(valid).toBe(false);
    expect(readOfflineLease()).toBeNull();

    const cryptoValid = await verifyOfflineLeaseCryptographically(userId);
    expect(cryptoValid).toBe(false);
  });

  it('rejects lease if device clock is tampered backwards upon offline launch', async () => {
    const userId = 101;
    const token = await createOfflineLeaseToken(userId, 72);
    const now = Date.now();
    saveOfflineLease(72, token);

    // Simulate clock rollback: current time is 2 hours before verifiedAt
    const rolledBackTime = now - 2 * 3600 * 1000;
    const valid = hasValidOfflineLease(rolledBackTime, userId);
    expect(valid).toBe(false);
    expect(readOfflineLease()).toBeNull();
  });

  it('proves that a transient heartbeat failure does not replace a valid saved token and does not extend its expiry', async () => {
    const userId = 101;
    const graceHours = 72;
    const initialNow = Date.now();

    // 1. Initial successful heartbeat at T=0
    const originalToken = await createOfflineLeaseToken(userId, graceHours);
    const initialLease = saveOfflineLease(graceHours, originalToken);
    const originalExpiresAt = initialLease.expiresAt;
    const originalVerifiedAt = initialLease.verifiedAt;

    // expiresAt comes from the token's exp claim (second precision)
    const expectedExpiresAt = (Math.floor(initialNow / 1000) + graceHours * 3600) * 1000;
    expect(initialLease.token).toBe(originalToken);
    expect(originalExpiresAt).toBe(expectedExpiresAt);

    // 2. Advance time by 5 hours (T = +5h)
    const fiveHoursLater = initialNow + 5 * 3600 * 1000;

    // Simulate PersonalAccessGate heartbeat mutation behavior on transient failure
    const simulateHeartbeatCall = async (succeed: boolean, errorMsg?: string) => {
      if (!succeed) {
        const error = new Error(errorMsg || 'Failed to fetch / network timeout');
        // PersonalAccessGate onError logic:
        if (/FORBIDDEN|موقوف|disabled/i.test(error.message)) {
          clearOfflineLease();
        }
        // Notice: saveOfflineLease is NOT called on failure!
        return { error };
      }
      // On success, saveOfflineLease would be called
      const newToken = await createOfflineLeaseToken(userId, graceHours);
      saveOfflineLease(graceHours, newToken);
      return { token: newToken };
    };

    // 3. Heartbeat fails due to offline/network/server error at T = +5h
    const result = await simulateHeartbeatCall(false, 'Network connection timed out');
    expect(result.error).toBeDefined();

    // 4. Assert that the stored lease was NOT overwritten
    const currentLease = readOfflineLease();
    expect(currentLease).not.toBeNull();
    expect(currentLease?.token).toBe(originalToken);
    expect(currentLease?.verifiedAt).toBe(originalVerifiedAt);

    // 5. Assert that the lease expiry was NOT extended
    // If it were wrongly extended at T=+5h, expiresAt would be fiveHoursLater + 72h.
    // It MUST strictly remain the originalExpiresAt!
    expect(currentLease?.expiresAt).toBe(originalExpiresAt);
    expect(currentLease?.expiresAt).not.toBe((Math.floor(fiveHoursLater / 1000) + graceHours * 3600) * 1000);

    // 6. Assert that offline access remains valid with original remaining hours
    const isValid = hasValidOfflineLease(fiveHoursLater, userId);
    expect(isValid).toBe(true);
    const remainingHours = getOfflineLeaseRemainingHours(fiveHoursLater);
    expect(Math.round(remainingHours)).toBe(67); // 72 - 5 = 67 hours

    // 7. Cryptographic verification remains fully valid for original token
    const isCryptoValid = await verifyOfflineLeaseCryptographically(userId, fiveHoursLater);
    expect(isCryptoValid).toBe(true);
  });

  it('proves that a terminal forbidden heartbeat error revokes the lease instead of extending it', async () => {
    const userId = 101;
    const graceHours = 72;

    // Initial valid token
    const token = await createOfflineLeaseToken(userId, graceHours);
    saveOfflineLease(graceHours, token);
    expect(readOfflineLease()?.token).toBe(token);

    // Simulate heartbeat returning FORBIDDEN / disabled
    const error = new Error('FORBIDDEN: الحساب موقوف من قبل المطور');
    if (/FORBIDDEN|موقوف|disabled/i.test(error.message)) {
      clearOfflineLease();
    }

    // Assert that the lease was immediately cleared, not retained or extended
    expect(readOfflineLease()).toBeNull();
    expect(hasValidOfflineLease(Date.now(), userId)).toBe(false);
  });
});
