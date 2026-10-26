import { Archive, BellRing, CheckCircle2, MessageSquareText, ShieldBan, UsersRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import DeveloperAccessCodes from './DeveloperAccessCodes';

export default function DeveloperPersonalConsole() {
  const utils = trpc.useUtils();
  const announcementsQuery = trpc.developer.personal.announcements.useQuery();
  const messagesQuery = trpc.developer.personal.messages.useQuery();
  const usersQuery = trpc.developer.personal.users.useQuery();
  const accessSettingsQuery = trpc.developer.personal.accessSettings.useQuery();
  const [announcementId, setAnnouncementId] = useState<number | undefined>();
  const [announcement, setAnnouncement] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [offlineGraceHours, setOfflineGraceHours] = useState(72);

  useEffect(() => {
    const active = announcementsQuery.data?.find(item => item.isActive === 1) ?? announcementsQuery.data?.[0];
    if (!active || announcementId) return;
    setAnnouncementId(active.id);
    setAnnouncement(active.message);
    setIsActive(active.isActive === 1);
  }, [announcementId, announcementsQuery.data]);

  const saveAnnouncement = trpc.developer.personal.saveAnnouncement.useMutation({
    onSuccess: async () => {
      toast.success('تم حفظ رسالة المطور.');
      await utils.developer.personal.announcements.invalidate();
    },
    onError: error => toast.error(error.message || 'تعذر حفظ رسالة المطور.'),
  });
  const changeMessageStatus = trpc.developer.personal.updateMessageStatus.useMutation({
    onSuccess: async () => utils.developer.personal.messages.invalidate(),
    onError: error => toast.error(error.message || 'تعذر تحديث حالة الرسالة.'),
  });
  const setUserAccess = trpc.developer.personal.setUserAccess.useMutation({
    onSuccess: async () => {
      toast.success('تم تحديث حالة الحساب.');
      await utils.developer.personal.users.invalidate();
    },
    onError: error => toast.error(error.message || 'تعذر تحديث حالة الحساب.'),
  });
  const setRegistrationOpen = trpc.developer.personal.setRegistrationOpen.useMutation({
    onSuccess: async settings => {
      toast.success(settings.registrationOpen ? 'تم فتح التسجيل الجديد.' : 'تم إيقاف التسجيل الجديد.');
      await utils.developer.personal.accessSettings.invalidate();
      await utils.projectAccess.mode.invalidate();
    },
    onError: error => toast.error(error.message || 'تعذر تحديث التسجيل الجديد.'),
  });
  const setOfflineGrace = trpc.developer.personal.setOfflineGraceHours.useMutation({
    onSuccess: async settings => {
      setOfflineGraceHours(settings.offlineGraceHours);
      toast.success('تم حفظ مدة العمل دون اتصال.');
      await utils.developer.personal.accessSettings.invalidate();
      await utils.projectAccess.mode.invalidate();
    },
    onError: error => toast.error(error.message || 'تعذر حفظ مدة العمل دون اتصال.'),
  });

  useEffect(() => {
    if (accessSettingsQuery.data) setOfflineGraceHours(accessSettingsQuery.data.offlineGraceHours);
  }, [accessSettingsQuery.data]);

  const userCount = usersQuery.data?.length ?? 0;
  const activeUsers = usersQuery.data?.filter(user => user.isDisabled !== 1).length ?? 0;
  const newMessages = messagesQuery.data?.filter(message => message.status === 'new').length ?? 0;

  return (
    <section className="space-y-5" dir="rtl">
      <section className="rounded-[28px] bg-white p-5 shadow-[0_12px_30px_rgba(37,35,95,0.06)] sm:p-7">
        <div className="mb-4 flex items-center gap-2 text-primary"><UsersRound size={20} /><h3 className="font-black">ملخص المساحة الشخصية</h3></div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <Metric label="الحسابات" value={userCount} />
          <Metric label="المفعّلة" value={activeUsers} />
          <Metric label="رسائل جديدة" value={newMessages} />
        </div>
      </section>

      <section className="rounded-[28px] bg-white p-5 shadow-[0_12px_30px_rgba(37,35,95,0.06)] sm:p-7">
        <div className="flex items-start justify-between gap-4"><div><h3 className="font-black text-primary">التسجيل الجديد</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">عند الإيقاف لا يستطيع مستخدم جديد إنشاء جلسة بالبريد أو كود جديد، بينما تستمر الحسابات المفعّلة في الاستخدام.</p></div><button type="button" role="switch" aria-checked={accessSettingsQuery.data?.registrationOpen !== false} disabled={accessSettingsQuery.isLoading || setRegistrationOpen.isPending} onClick={() => setRegistrationOpen.mutate({ registrationOpen: accessSettingsQuery.data?.registrationOpen === false })} className={`shrink-0 rounded-xl px-4 py-3 text-sm font-black transition active:scale-95 disabled:opacity-50 ${accessSettingsQuery.data?.registrationOpen !== false ? 'bg-primary text-primary-foreground' : 'bg-amber-50 text-amber-900'}`}>{accessSettingsQuery.data?.registrationOpen !== false ? 'مفتوح' : 'موقوف'}</button></div>
        <div className="mt-5 rounded-2xl bg-secondary/50 p-4"><label htmlFor="offline-grace-hours" className="block text-sm font-black text-primary">مدة العمل دون اتصال بالساعات</label><p className="mt-1 text-xs leading-5 text-muted-foreground">بعد تحقق المستخدم مرة واحدة، يستطيع التطبيق المحلي العمل لهذه المدة قبل طلب اتصال جديد.</p><div className="mt-3 flex gap-2"><input id="offline-grace-hours" type="number" min={0} max={720} value={offlineGraceHours} onChange={event => setOfflineGraceHours(Number(event.target.value) || 0)} className="min-h-11 w-28 rounded-xl border border-stone-200 bg-white px-3 text-center font-black" dir="ltr" /><button type="button" disabled={setOfflineGrace.isPending} onClick={() => setOfflineGrace.mutate({ hours: offlineGraceHours })} className="min-h-11 flex-1 rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground disabled:opacity-50">{setOfflineGrace.isPending ? 'جارٍ الحفظ…' : 'حفظ المدة'}</button></div></div>
      </section>

      <section className="rounded-[28px] bg-white p-5 shadow-[0_12px_30px_rgba(37,35,95,0.06)] sm:p-7">
        <div className="flex items-center gap-2 text-primary"><BellRing size={20} /><h3 className="font-black">إعلان عام للمستخدمين</h3></div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">يظهر هذا الإعلان للحسابات المفعّلة في واجهة التطبيق ويمكن الضغط عليه لفتحه كاملاً.</p>
        <textarea value={announcement} onChange={event => setAnnouncement(event.target.value)} maxLength={1200} className="mt-4 min-h-28 w-full rounded-2xl border border-stone-200 p-4 text-right text-sm outline-none focus:border-primary" placeholder="مثال: تم تحسين قالب الإعلان اليوم…" />
        <button type="button" onClick={() => setIsActive(current => !current)} className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-primary"><span className={`flex h-6 w-6 items-center justify-center rounded-full ${isActive ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'}`}>{isActive && <CheckCircle2 size={14} />}</span>إظهار الإعلان للمستخدمين</button>
        <button type="button" disabled={!announcement.trim() || saveAnnouncement.isPending} onClick={() => saveAnnouncement.mutate({ id: announcementId, message: announcement.trim(), isActive })} className="mt-4 min-h-12 w-full rounded-xl bg-primary text-sm font-black text-primary-foreground disabled:opacity-50">{saveAnnouncement.isPending ? 'جارٍ الحفظ…' : 'حفظ الإعلان العام'}</button>
      </section>

      <DeveloperAccessCodes />

      <section className="rounded-[28px] bg-white p-5 shadow-[0_12px_30px_rgba(37,35,95,0.06)] sm:p-7">
        <div className="mb-4 flex items-center gap-2 text-primary"><MessageSquareText size={20} /><h3 className="font-black">رسائل المستخدمين</h3></div>
        {!messagesQuery.data?.length && <p className="rounded-2xl bg-secondary/70 p-4 text-sm text-muted-foreground">لا توجد رسائل محفوظة حتى الآن.</p>}
        <div className="space-y-3">
          {messagesQuery.data?.map(message => <article key={message.id} className="rounded-2xl border border-stone-100 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-black text-foreground">{message.userName || 'مستخدم بلا اسم'}</p><p className="mt-1 text-xs text-muted-foreground" dir="ltr">{message.userEmail || 'لا يوجد بريد ظاهر'}</p></div><span className={`rounded-full px-2 py-1 text-xs font-bold ${message.status === 'new' ? 'bg-amber-50 text-amber-800' : 'bg-secondary text-muted-foreground'}`}>{message.status === 'new' ? 'جديدة' : message.status === 'read' ? 'مقروءة' : 'مؤرشفة'}</span></div><p className="mt-3 text-sm leading-6 text-foreground">{message.message}</p><div className="mt-3 flex gap-2"><button type="button" onClick={() => changeMessageStatus.mutate({ id: message.id, status: 'read' })} className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">مقروءة</button><button type="button" onClick={() => changeMessageStatus.mutate({ id: message.id, status: 'archived' })} className="inline-flex items-center gap-1 rounded-lg bg-secondary px-3 py-2 text-xs font-bold text-primary"><Archive size={14} /> أرشفة</button></div></article>)}
        </div>
      </section>

      <section className="rounded-[28px] bg-white p-5 shadow-[0_12px_30px_rgba(37,35,95,0.06)] sm:p-7">
        <div className="mb-4 flex items-center gap-2 text-primary"><ShieldBan size={20} /><h3 className="font-black">الحسابات والصلاحية</h3></div>
        {!usersQuery.data?.length && <p className="rounded-2xl bg-secondary/70 p-4 text-sm text-muted-foreground">لم يسجل أي مستخدم بعد.</p>}
        <div className="space-y-3">
          {usersQuery.data?.map(user => <article key={user.id} className="flex items-center justify-between gap-3 rounded-2xl border border-stone-100 p-4"><div className="min-w-0"><p className="truncate font-black text-foreground">{user.name || 'مستخدم بلا اسم'}</p><p className="mt-1 truncate text-xs text-muted-foreground" dir="ltr">{user.email || user.loginMethod || `ID ${user.id}`}</p><p className="mt-1 text-[11px] text-muted-foreground">آخر اتصال: {user.lastSeenAt ? new Date(user.lastSeenAt).toLocaleString() : 'لم يتصل بعد'}</p></div><button type="button" disabled={setUserAccess.isPending} onClick={() => setUserAccess.mutate({ id: user.id, isDisabled: user.isDisabled !== 1 })} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold ${user.isDisabled === 1 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{user.isDisabled === 1 ? 'إعادة تفعيل' : 'إيقاف الحساب'}</button></article>)}
        </div>
      </section>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl bg-secondary/70 p-3"><p className="text-2xl font-black text-primary">{value}</p><p className="mt-1 text-xs font-bold text-muted-foreground">{label}</p></div>;
}
