import { desc, eq } from 'drizzle-orm';
import { appAnnouncements, projectAccessSettings, userMessages, users } from '../drizzle/schema';
import { getDb } from './db';

function requireDb<T>(db: T | null): T {
  if (!db) throw new Error('قاعدة البيانات غير متاحة حالياً');
  return db;
}

function settleWithin<T>(work: Promise<T>, milliseconds: number, fallback: T): Promise<T> {
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(fallback), milliseconds);
    work.then(value => {
      clearTimeout(timer);
      resolve(value);
    }).catch(() => {
      clearTimeout(timer);
      resolve(fallback);
    });
  });
}

export async function getUserAccess(userId: number) {
  const db = requireDb(await getDb());
  const user = (await db.select({ id: users.id, isDisabled: users.isDisabled, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1))[0];
  return user ? { exists: true, isDisabled: user.isDisabled === 1, role: user.role } : { exists: false, isDisabled: true, role: 'user' as const };
}

export async function getActiveAnnouncement() {
  const db = requireDb(await getDb());
  return (await db.select()
    .from(appAnnouncements)
    .where(eq(appAnnouncements.isActive, 1))
    .orderBy(desc(appAnnouncements.updatedAt))
    .limit(1))[0] ?? null;
}

export async function listAnnouncements() {
  const db = requireDb(await getDb());
  return db.select().from(appAnnouncements).orderBy(desc(appAnnouncements.updatedAt));
}

export async function saveAnnouncement(input: { id?: number; message: string; isActive: boolean }) {
  const db = requireDb(await getDb());
  if (input.id) {
    await db.update(appAnnouncements)
      .set({ message: input.message, isActive: input.isActive ? 1 : 0 })
      .where(eq(appAnnouncements.id, input.id));
    return (await db.select().from(appAnnouncements).where(eq(appAnnouncements.id, input.id)).limit(1))[0];
  }
  const inserted = await db.insert(appAnnouncements).values({ message: input.message, isActive: input.isActive ? 1 : 0 });
  return (await db.select().from(appAnnouncements).where(eq(appAnnouncements.id, Number(inserted[0].insertId))).limit(1))[0];
}

export async function createUserMessage(input: { userId: number; message: string }) {
  const db = requireDb(await getDb());
  const inserted = await db.insert(userMessages).values({ userId: input.userId, message: input.message });
  return (await db.select().from(userMessages).where(eq(userMessages.id, Number(inserted[0].insertId))).limit(1))[0];
}

export async function listDeveloperMessages() {
  const db = requireDb(await getDb());
  return db.select({
    id: userMessages.id,
    message: userMessages.message,
    status: userMessages.status,
    createdAt: userMessages.createdAt,
    userId: users.id,
    userName: users.name,
    userEmail: users.email,
  })
    .from(userMessages)
    .innerJoin(users, eq(userMessages.userId, users.id))
    .orderBy(desc(userMessages.createdAt));
}

export async function updateUserMessageStatus(id: number, status: 'new' | 'read' | 'archived') {
  const db = requireDb(await getDb());
  await db.update(userMessages).set({ status }).where(eq(userMessages.id, id));
  return { success: true } as const;
}

export async function listPersonalUsers() {
  const db = requireDb(await getDb());
  return db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    loginMethod: users.loginMethod,
    role: users.role,
    isDisabled: users.isDisabled,
    createdAt: users.createdAt,
    lastSignedIn: users.lastSignedIn,
  }).from(users).orderBy(desc(users.lastSignedIn));
}

export async function setPersonalUserAccess(id: number, isDisabled: boolean) {
  const db = requireDb(await getDb());
  await db.update(users).set({ isDisabled: isDisabled ? 1 : 0 }).where(eq(users.id, id));
  return { success: true } as const;
}

export async function getProjectAccessSettings() {
  return settleWithin((async () => {
    const db = requireDb(await getDb());
    const current = (await db.select().from(projectAccessSettings).where(eq(projectAccessSettings.id, 1)).limit(1))[0];
    if (current) return { loginRequired: current.loginRequired === 1 };
    await db.insert(projectAccessSettings).values({ id: 1, loginRequired: 1 });
    return { loginRequired: true };
  })(), 2_500, { loginRequired: true });
}

export async function setProjectLoginRequired(loginRequired: boolean) {
  const db = requireDb(await getDb());
  await db.insert(projectAccessSettings).values({ id: 1, loginRequired: loginRequired ? 1 : 0 })
    .onDuplicateKeyUpdate({ set: { loginRequired: loginRequired ? 1 : 0 } });
  return { loginRequired };
}
