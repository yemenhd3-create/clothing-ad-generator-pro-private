import { jwtVerify, importJWK } from 'jose';
import { OFFLINE_LEASE_PUBLIC_JWK } from './offlinePublicKey';

const OFFLINE_LEASE_KEY = 'clothing-ad-offline-lease-v1';
const LEGACY_OFFLINE_LEASE_KEY = 'clothing-ad-generator:offline-lease-v1';

export type OfflineLease = {
  verifiedAt: number;
  expiresAt: number;
  token?: string;
  lastSeenAt?: number;
};

export type OfflineJwtClaims = {
  sub?: string;
  graceHours?: number;
  type?: string;
  iat?: number;
  exp?: number;
};

/**
 * Genuine asymmetric cryptographic verification of an offline lease token.
 * Uses the embedded ES256 public key (without exposing any server secrets).
 * Returns decoded claims if valid, or null if tampered, forged, or expired.
 */
export async function verifyOfflineLeaseTokenCryptographically(
  token: string
): Promise<OfflineJwtClaims | null> {
  try {
    const publicKey = await importJWK(OFFLINE_LEASE_PUBLIC_JWK, 'ES256');
    const { payload } = await jwtVerify(token, publicKey);
    if (payload.type !== 'offline_lease') return null;
    return payload as OfflineJwtClaims;
  } catch {
    return null;
  }
}

export function parseJwtPayload(token: string): OfflineJwtClaims | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function readOfflineLease(): OfflineLease | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(OFFLINE_LEASE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OfflineLease>;
    if (!Number.isFinite(parsed.verifiedAt) || !Number.isFinite(parsed.expiresAt)) return null;
    return {
      verifiedAt: Number(parsed.verifiedAt),
      expiresAt: Number(parsed.expiresAt),
      token: typeof parsed.token === 'string' ? parsed.token : undefined,
      lastSeenAt: Number.isFinite(parsed.lastSeenAt) ? Number(parsed.lastSeenAt) : undefined,
    };
  } catch {
    return null;
  }
}

export function saveOfflineLease(graceHours: number, token?: string): OfflineLease {
  const now = Date.now();
  let verifiedAt = now;
  let expiresAt = now + Math.max(0, graceHours) * 60 * 60 * 1000;

  if (token) {
    const claims = parseJwtPayload(token);
    if (claims?.exp && Number.isFinite(claims.exp)) {
      expiresAt = claims.exp * 1000;
    }
    if (claims?.iat && Number.isFinite(claims.iat)) {
      verifiedAt = claims.iat * 1000;
    }
  }

  const lease: OfflineLease = {
    verifiedAt,
    expiresAt,
    token: token || undefined,
    lastSeenAt: now,
  };

  if (graceHours <= 0 || expiresAt <= now) {
    clearOfflineLease();
    return lease;
  }

  try {
    window.localStorage.setItem(OFFLINE_LEASE_KEY, JSON.stringify(lease));
  } catch {
    // Storage cleanup or private browsing fallback
  }
  return lease;
}

/**
 * Checks if a locally stored lease is valid at the given time.
 * If expectedUserId is supplied, ensures the lease token belongs to that specific user.
 * Tokens belonging to another user are rejected and immediately cleared.
 */
export function hasValidOfflineLease(now = Date.now(), expectedUserId?: number | string): boolean {
  const lease = readOfflineLease();
  if (!lease) return false;

  // 1. Expiry check
  if (lease.expiresAt <= now) {
    clearOfflineLease();
    return false;
  }

  // 2. Anti-rollback check: system clock moved back before token creation
  if (now < lease.verifiedAt) {
    clearOfflineLease();
    return false;
  }

  // 3. Anti-rollback check: system clock moved back before last recorded usage
  if (lease.lastSeenAt && now < lease.lastSeenAt) {
    clearOfflineLease();
    return false;
  }

  // 4. User identity binding: reject if token belongs to a different user
  if (expectedUserId !== undefined && lease.token) {
    const claims = parseJwtPayload(lease.token);
    if (!claims || claims.sub !== String(expectedUserId)) {
      clearOfflineLease();
      return false;
    }
  }

  // Update lastSeenAt to prevent backward clock tampering during offline session
  try {
    lease.lastSeenAt = now;
    window.localStorage.setItem(OFFLINE_LEASE_KEY, JSON.stringify(lease));
  } catch {
    // Ignore storage update errors
  }

  return true;
}

/**
 * Cryptographically verifies the offline lease on device startup.
 * Confirms ES256 signature against public key, verifies user ID matching,
 * and guards against time tampering.
 */
export async function verifyOfflineLeaseCryptographically(
  expectedUserId?: number | string,
  now = Date.now()
): Promise<boolean> {
  const lease = readOfflineLease();
  if (!lease || !lease.token) return false;

  const claims = await verifyOfflineLeaseTokenCryptographically(lease.token);
  if (!claims) {
    clearOfflineLease();
    return false;
  }

  if (expectedUserId !== undefined && claims.sub !== String(expectedUserId)) {
    clearOfflineLease();
    return false;
  }

  return hasValidOfflineLease(now, expectedUserId);
}

export function clearOfflineLease() {
  try {
    window.localStorage.removeItem(OFFLINE_LEASE_KEY);
    window.localStorage.removeItem(LEGACY_OFFLINE_LEASE_KEY);
  } catch {
    // Ignore storage cleanup failures.
  }
}

export function getOfflineLeaseRemainingHours(now = Date.now()) {
  const lease = readOfflineLease();
  if (!lease) return 0;
  return Math.max(0, (lease.expiresAt - now) / (60 * 60 * 1000));
}
