import { SignJWT, jwtVerify, importJWK } from 'jose';
import { OFFLINE_LEASE_PUBLIC_JWK } from '../client/src/lib/offlinePublicKey';

// Dedicated asymmetric private key for signing offline lease tokens (ES256)
const OFFLINE_LEASE_PRIVATE_JWK = {
  ...OFFLINE_LEASE_PUBLIC_JWK,
  d: 'rUU_NMXC8ES_BfJzFeCaHOp4XEDgknY396V4HeSbdMo',
};

export type OfflineLeaseClaims = {
  sub: string;
  graceHours: number;
  type: 'offline_lease';
  iat?: number;
  exp?: number;
};

export async function createOfflineLeaseToken(userId: number, graceHours: number): Promise<string> {
  const privateKey = await importJWK(OFFLINE_LEASE_PRIVATE_JWK, 'ES256');
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
