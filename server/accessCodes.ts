import { and, desc, eq, gt, isNull, lt, or, sql } from 'drizzle-orm';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { accessCodes, users } from '../drizzle/schema';
import { getDb } from './db';

export type AccessCodeSummary = {
  id: number;
  label: string;
  expiresAt: Date | null;
  maxUses: number | null;
  useCount: number;
  isRevoked: boolean;
  createdAt: Date;
  lastUsedAt: Date | null;
};

function requireDb<T>(db: T | null): T {
  if (!db) throw new Error('قاعدة البيانات غير متاحة حالياً');
  return db;
}

function hashCode(code: string) {
  return createHash('sha256').update(code).digest('hex');
}

export function normalizeAccessCode(code: string) {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function getAccessCodeEligibility(input: { isRevoked: number; expiresAt: Date | null; maxUses: number | null; useCount: number }, now = new Date()) {
  if (input.isRevoked === 1) return { eligible: false, reason: 'revoked' as const };
  if (input.expiresAt && input.expiresAt.getTime() <= now.getTime()) return { eligible: false, reason: 'expired' as const };
  if (input.maxUses !== null && input.useCount >= input.maxUses) return { eligible: false, reason: 'exhausted' as const };
  return { eligible: true, reason: null } as const;
}

function buildCode() {
  const value = randomBytes(10).toString('hex').toUpperCase();
  return `CAG-${value.slice(0, 5)}-${value.slice(5, 10)}-${value.slice(10, 15)}-${value.slice(15, 20)}`;
}

function summary(code: typeof accessCodes.$inferSelect): AccessCodeSummary {
  return {
    id: code.id,
    label: code.label,
    expiresAt: code.expiresAt,
    maxUses: code.maxUses,
    useCount: code.useCount,
    isRevoked: code.isRevoked === 1,
    createdAt: code.createdAt,
    lastUsedAt: code.lastUsedAt,
  };
}

export async function listAccessCodes() {
  const db = requireDb(await getDb());
  const codes = await db.select().from(accessCodes).orderBy(desc(accessCodes.createdAt));
  return codes.map(summary);
}

export async function createAccessCode(input: { label: string; expiresAt?: Date; maxUses?: number }) {
  const db = requireDb(await getDb());
  const rawCode = buildCode();
  const sessionOpenId = `access_${randomUUID().replace(/-/g, '')}`;
  const now = new Date();
  const expiresAt = input.expiresAt && input.expiresAt.getTime() > now.getTime() ? input.expiresAt : null;

  const inserted = await db.insert(accessCodes).values({
    codeHash: hashCode(normalizeAccessCode(rawCode)),
    sessionOpenId,
    label: input.label.trim(),
    expiresAt,
    maxUses: input.maxUses ?? null,
  });
  const code = (await db.select().from(accessCodes).where(eq(accessCodes.id, Number(inserted[0].insertId))).limit(1))[0];
  if (!code) throw new Error('تعذر إنشاء رمز الوصول');
  return { code: rawCode, accessCode: summary(code) };
}

export async function revokeAccessCode(id: number) {
  const db = requireDb(await getDb());
  const code = (await db.select().from(accessCodes).where(eq(accessCodes.id, id)).limit(1))[0];
  if (!code) throw new Error('رمز الوصول غير موجود');
  await db.transaction(async tx => {
    await tx.update(accessCodes).set({ isRevoked: 1 }).where(eq(accessCodes.id, id));
    await tx.update(users).set({ isDisabled: 1 }).where(eq(users.openId, code.sessionOpenId));
  });
  return { success: true } as const;
}

export async function redeemAccessCode(rawCode: string) {
  const db = requireDb(await getDb());
  const now = new Date();
  const codeHash = hashCode(normalizeAccessCode(rawCode));
  const code = (await db.select().from(accessCodes).where(eq(accessCodes.codeHash, codeHash)).limit(1))[0];
  if (!code) throw new Error('رمز الدخول غير صحيح أو تم إلغاؤه');
  const eligibility = getAccessCodeEligibility(code, now);
  if (!eligibility.eligible) {
    const messages = {
      revoked: 'رمز الدخول غير صحيح أو تم إلغاؤه',
      expired: 'انتهت صلاحية رمز الدخول',
      exhausted: 'اكتمل عدد استخدامات رمز الدخول',
    } as const;
    throw new Error(messages[eligibility.reason]);
  }

  const validCondition = and(
    eq(accessCodes.id, code.id),
    eq(accessCodes.isRevoked, 0),
    or(isNull(accessCodes.expiresAt), gt(accessCodes.expiresAt, now)),
    or(isNull(accessCodes.maxUses), lt(accessCodes.useCount, accessCodes.maxUses)),
  );
  const claimed = await db.update(accessCodes)
    .set({ useCount: sql`${accessCodes.useCount} + 1`, lastUsedAt: now })
    .where(validCondition);
  if ((claimed[0]?.affectedRows ?? 0) !== 1) throw new Error('رمز الدخول لم يعد متاحاً');

  await db.insert(users).values({
    openId: code.sessionOpenId,
    name: `وصول برمز: ${code.label}`,
    email: null,
    loginMethod: 'access-code',
    role: 'user',
    isDisabled: 0,
    lastSignedIn: now,
  }).onDuplicateKeyUpdate({ set: { isDisabled: 0, lastSignedIn: now } });

  return {
    openId: code.sessionOpenId,
    name: `وصول برمز: ${code.label}`,
    expiresAt: code.expiresAt,
  };
}
