import { SignJWT, jwtVerify } from 'jose';
import { ENV } from './_core/env';

function getSecretKey(): Uint8Array {
  const secret = ENV.cookieSecret || 'development_fallback_secret_key_32bytes_min';
  return new Uint8Array(Buffer.from(secret, 'utf-8'));
}

export type OfflineLeaseClaims = {
  sub: string;
  graceHours: number;
  type: 'offline_lease';
  iat?: number;
  exp?: number;
};

export async function createOfflineLeaseToken(userId: number, graceHours: number): Promise<string> {
  const secretKey = getSecretKey();
  const nowSec = Math.floor(Date.now() / 1000);
  const safeHours = Math.max(0, graceHours);
  const expSec = nowSec + safeHours * 3600;

  return new SignJWT({
    sub: String(userId),
    graceHours: safeHours,
    type: 'offline_lease',
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(nowSec)
    .setExpirationTime(expSec)
    .sign(secretKey);
}

export async function verifyOfflineLeaseToken(token: string): Promise<OfflineLeaseClaims | null> {
  try {
    const secretKey = getSecretKey();
    const { payload } = await jwtVerify(token, secretKey);
    if (payload.type !== 'offline_lease') return null;
    return payload as unknown as OfflineLeaseClaims;
  } catch {
    return null;
  }
}
