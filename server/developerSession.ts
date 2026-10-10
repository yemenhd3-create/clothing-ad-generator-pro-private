import { createHmac, timingSafeEqual } from 'node:crypto';
import { parse } from 'cookie';
import type { Request } from 'express';

export const DEVELOPER_SESSION_COOKIE = 'clothing_ad_developer_session';
export const DEVELOPER_SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

function sessionSecret() {
  const secret = process.env.JWT_SECRET ?? '';
  if (!secret) throw new Error('JWT_SECRET is required for developer sessions');
  return secret;
}

function signature(expiresAt: number) {
  return createHmac('sha256', sessionSecret())
    .update(`clothing-ad-developer:${expiresAt}`)
    .digest('base64url');
}

export function issueDeveloperSession() {
  const expiresAt = Date.now() + DEVELOPER_SESSION_MAX_AGE_MS;
  return `${expiresAt}.${signature(expiresAt)}`;
}

export function isDeveloperSession(req: Pick<Request, 'headers'>): boolean {
  const rawHeader = req.headers['x-developer-session'] ?? req.headers['x-developer-token'];
  const headerToken = Array.isArray(rawHeader) ? rawHeader[0] : (typeof rawHeader === 'string' ? rawHeader : undefined);

  const cookieToken = parse(req.headers.cookie ?? '')[DEVELOPER_SESSION_COOKIE];
  const token = headerToken || cookieToken;
  if (!token) return false;

  const [expiresAtRaw, receivedSignature] = token.split('.');
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now() || !receivedSignature) return false;

  const expectedSignature = signature(expiresAt);
  const received = Buffer.from(receivedSignature, 'utf8');
  const expected = Buffer.from(expectedSignature, 'utf8');
  return received.length === expected.length && timingSafeEqual(received, expected);
}
