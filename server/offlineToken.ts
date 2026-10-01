import { SignJWT, jwtVerify, importJWK } from 'jose';
import { OFFLINE_LEASE_PUBLIC_JWK } from '../client/src/lib/offlinePublicKey';

// Dedicated asymmetric private key for signing offline lease tokens (ES256).
// SECURITY: this must come ONLY from a server-side environment variable and
// must NEVER be hardcoded in source, since this repository is public.
function getOfflineLeasePrivateJwk() {
  const raw = process.env.OFFLINE_LEASE_PRIVATE_JWK ?? '';
  if (!raw) {
    throw new Error('OFFLINE_LEASE_PRIVATE_JWK is required to sign offline lease tokens');
  }
  try {
    return JSON.parse(raw) as { kty: string; crv: string; x: string; y: string; d: string };
  } catch {
    throw new Error('OFFLINE_LEASE_PRIVATE_JWK is not valid JSON');
  }
}

export type OfflineLeaseClaims = {
  sub: string;
  graceHours: number;
  type: 'offline_lease';
  iat?: number;
  exp?: number;
};

export async function createOfflineLeaseToken(userId: number, graceHours: number): Promise<string> {
  const privateKey = await importJWK(getOfflineLeasePrivateJwk(), 'ES256');
  const nowSec = Math.floor(Date.now() / 1000);
  const safeHours = Math.max(0, graceHours);
  const expSec = nowSec + safeHours * 3600;

  return new SignJWT({
    sub: String(userId),
    graceHours: safeHours,
    type: 'offline_lease',
  })
    .setProtectedHeader({ alg: 'ES256', typ: 'JWT' })
    .setIssuedAt(nowSec)
    .setExpirationTime(expSec)
    .sign(privateKey);
}

export async function verifyOfflineLeaseToken(token: string): Promise<OfflineLeaseClaims | null> {
  try {
    const publicKey = await importJWK(OFFLINE_LEASE_PUBLIC_JWK, 'ES256');
    const { payload } = await jwtVerify(token, publicKey);
    if (payload.type !== 'offline_lease') return null;
    return payload as unknown as OfflineLeaseClaims;
  } catch {
    return null;
  }
}
