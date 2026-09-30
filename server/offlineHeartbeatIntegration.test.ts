// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createOfflineLeaseToken } from './offlineToken';
import {
  clearOfflineLease,
  hasValidOfflineLease,
  readOfflineLease,
  saveOfflineLease,
  verifyOfflineLeaseCryptographically,
  getOfflineLeaseRemainingHours,
} from '../client/src/lib/offlineAccess';

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
    const forgedToken = `${header}.${forgedPayloadB64}.${signature}`;

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
});
