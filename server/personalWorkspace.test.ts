import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getDb } = vi.hoisted(() => ({ getDb: vi.fn() }));

vi.mock('./db', () => ({ getDb }));

const { getActiveAnnouncement, getProjectAccessSettings, getUserAccess, setProjectLoginRequired } = await import('./personalWorkspace');

describe('personal workspace data access', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reports a disabled account so protected routes can block access', async () => {
    const limit = vi.fn().mockResolvedValue([{ id: 7, isDisabled: 1, role: 'user' }]);
    getDb.mockResolvedValue({ select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit })) })) })) });

    await expect(getUserAccess(7)).resolves.toEqual({ exists: true, isDisabled: true, role: 'user' });
  });

  it('returns the newest active developer announcement when one exists', async () => {
    const limit = vi.fn().mockResolvedValue([{ id: 3, message: 'تم تحديث القالب', isActive: 1 }]);
    getDb.mockResolvedValue({ select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ orderBy: vi.fn(() => ({ limit })) })) })) })) });

    await expect(getActiveAnnouncement()).resolves.toMatchObject({ id: 3, message: 'تم تحديث القالب' });
  });

  it('يبقي تسجيل الدخول مفعلاً افتراضياً عند غياب إعداد الوصول', async () => {
    const limit = vi.fn().mockResolvedValue([]);
    const values = vi.fn().mockResolvedValue(undefined);
    getDb.mockResolvedValue({
      select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit })) })) })),
      insert: vi.fn(() => ({ values })),
    });

    await expect(getProjectAccessSettings()).resolves.toEqual({ loginRequired: true, registrationOpen: true, offlineGraceHours: 72 });
    expect(values).toHaveBeenCalledWith({ id: 1, loginRequired: 1, registrationOpen: 1, offlineGraceHours: 72 });
  });

  it('يحفظ إيقاف تأمين الدخول ليُفتح المشروع مباشرة للاختبار', async () => {
    const onDuplicateKeyUpdate = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn(() => ({ onDuplicateKeyUpdate }));
    getDb.mockResolvedValue({ insert: vi.fn(() => ({ values })) });

    await expect(setProjectLoginRequired(false)).resolves.toEqual({ loginRequired: false });
    expect(values).toHaveBeenCalledWith({ id: 1, loginRequired: 0, registrationOpen: 0 });
  });

  it('يعيد وضع التأمين عند تعذر قراءة إعداد الدخول بدلاً من إبقاء الواجهة معلقة', async () => {
    getDb.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(getProjectAccessSettings()).resolves.toEqual({ loginRequired: true, registrationOpen: true, offlineGraceHours: 72 });
  });

  it('يسجل آخر اتصال للمستخدم عند تنفيذ heartbeat', async () => {
    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn(() => ({ where }));
    getDb.mockResolvedValue({ update: vi.fn(() => ({ set })) });

    await expect((await import('./personalWorkspace')).touchUserPresence(12)).resolves.toMatchObject({ success: true });
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ lastSeenAt: expect.any(Date) }));
    expect(where).toHaveBeenCalled();
  });
});
