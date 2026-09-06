const OFFLINE_LEASE_KEY = 'clothing-ad-offline-lease-v1';

export type OfflineLease = {
  verifiedAt: number;
  expiresAt: number;
};

export function readOfflineLease(): OfflineLease | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(OFFLINE_LEASE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OfflineLease>;
    if (!Number.isFinite(parsed.verifiedAt) || !Number.isFinite(parsed.expiresAt)) return null;
    return { verifiedAt: Number(parsed.verifiedAt), expiresAt: Number(parsed.expiresAt) };
  } catch {
    return null;
  }
}

export function saveOfflineLease(graceHours: number): OfflineLease {
  const now = Date.now();
  const lease: OfflineLease = {
    verifiedAt: now,
    expiresAt: now + Math.max(0, graceHours) * 60 * 60 * 1000,
  };
  try {
    window.localStorage.setItem(OFFLINE_LEASE_KEY, JSON.stringify(lease));
  } catch {
    // Private browsing or a restricted WebView may not allow local storage.
  }
  return lease;
}

export function hasValidOfflineLease(now = Date.now()): boolean {
  const lease = readOfflineLease();
  return Boolean(lease && lease.expiresAt > now);
}

export function clearOfflineLease() {
  try {
    window.localStorage.removeItem(OFFLINE_LEASE_KEY);
  } catch {
    // Ignore storage cleanup failures.
  }
}

export function getOfflineLeaseRemainingHours(now = Date.now()) {
  const lease = readOfflineLease();
  if (!lease) return 0;
  return Math.max(0, (lease.expiresAt - now) / (60 * 60 * 1000));
}
