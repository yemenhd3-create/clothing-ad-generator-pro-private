import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { MerchantAssistantSession, MerchantCommand, MerchantProfile } from '@shared/merchantAssistant';
import { appendMerchantAssistantMessage, buildDeveloperInsight, completeMerchantAssistantTask, createMerchantAssistantTask, parseMerchantCommands } from '@shared/merchantAssistant';
import { LOCAL_LEADER_ROLES, resolveLocalLeaderPlan } from '@shared/localLeader';
import { backupFilename, createLocalProjectBackup, parseLocalProjectBackup, stringifyLocalProjectBackup, type LocalProjectBackup } from '@/lib/localProjectBackup';
import type { TemplateSettings } from '@shared/types';
import { BadgeCheck, CheckCircle2, Clipboard, ImagePlus, LayoutTemplate, MessageSquareText, Mic, MicOff, Plus, RotateCcw, Send, ShieldCheck, Sparkles, Trash2, User } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';

type ArtworkKind = 'logo' | 'footer';
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};
type SpeechWindow = Window & typeof globalThis & { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };

type MerchantAssistantWorkspaceProps = {
  profile: MerchantProfile;
  session: MerchantAssistantSession;
  template: TemplateSettings;
  onCommitProfile: (profile: MerchantProfile) => void;
  onCommitSession: (session: MerchantAssistantSession) => void;
  onApplyCommands: (commands: MerchantCommand[]) => Promise<boolean>;
  onApplyArtwork: (kind: ArtworkKind, source: string) => Promise<boolean>;
  onRequestOnlineReply?: (message: string) => Promise<{ reply: string; source: 'gemini-flash' | 'gemini-flash-lite' | 'llm7' | 'free-ai' | 'local-fallback'; usedFallback: boolean }>;
  onRestoreBackup: (backup: LocalProjectBackup) => void;
  onClearProfile: () => void;
  onClearSession: () => void;
  onOpenUpdatedResult?: () => void;
};

type ProfileDraft = Pick<MerchantProfile, 'storeName' | 'storePhone' | 'storeLocation' | 'storeCategory' | 'defaultDiscount' | 'defaultColors'>;
type PendingArtwork = { kind: ArtworkKind; source: string; name: string };

function toDraft(profile: MerchantProfile): ProfileDraft {
  return { storeName: profile.storeName, storePhone: profile.storePhone, storeLocation: profile.storeLocation, storeCategory: profile.storeCategory, defaultDiscount: profile.defaultDiscount || '', defaultColors: profile.defaultColors };
}

function profileFromDraft(profile: MerchantProfile, draft: ProfileDraft): MerchantProfile {
  return { ...profile, onboardingComplete: true, storeName: draft.storeName.trim().slice(0, 80), storePhone: draft.storePhone.trim().slice(0, 32), storeLocation: draft.storeLocation.trim().slice(0, 80), storeCategory: draft.storeCategory.trim().slice(0, 48), defaultDiscount: (draft.defaultDiscount || '').trim().replace(/[^0-9.]/g, '').slice(0, 16), defaultColors: draft.defaultColors.map(color => color.trim()).filter(Boolean).slice(0, 4), updatedAt: Date.now() };
}

export default function MerchantAssistantWorkspace({ profile, session, template, onCommitProfile, onCommitSession, onApplyCommands, onApplyArtwork, onRequestOnlineReply, onRestoreBackup, onClearProfile, onClearSession, onOpenUpdatedResult }: MerchantAssistantWorkspaceProps) {
  const [draft, setDraft] = useState<ProfileDraft>(() => toDraft(profile));
  const [localSession, setLocalSession] = useState<MerchantAssistantSession>(session);
  const [pendingProfile, setPendingProfile] = useState<MerchantProfile | null>(null);
  const [pendingArtwork, setPendingArtwork] = useState<PendingArtwork | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isApplyingArtwork, setIsApplyingArtwork] = useState(false);
  const [copied, setCopied] = useState(false);
  const [commandInput, setCommandInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [onlineLeaderEnabled, setOnlineLeaderEnabled] = useState(true);
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : false);
  const [isOnlineLeaderReplying, setIsOnlineLeaderReplying] = useState(false);
  const [pendingBackup, setPendingBackup] = useState<LocalProjectBackup | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => { setDraft(toDraft(profile)); }, [profile]);
  useEffect(() => { setLocalSession(session); }, [session]);
  useEffect(() => () => recognitionRef.current?.stop(), []);
  useEffect(() => {
    const updateOnlineState = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateOnlineState);
    window.addEventListener('offline', updateOnlineState);
    return () => { window.removeEventListener('online', updateOnlineState); window.removeEventListener('offline', updateOnlineState); };
  }, []);

  const insight = useMemo(() => buildDeveloperInsight(profile), [profile]);
  const pendingTask = [...localSession.tasks].reverse().find(task => task.status === 'awaiting-confirmation');
  const lastAppliedTask = [...localSession.tasks].reverse().find(task => task.status === 'applied');
  const commitSession = (nextSession: MerchantAssistantSession) => { setLocalSession(nextSession); onCommitSession(nextSession); };
  const addAssistantMessage = (content: string) => commitSession(appendMerchantAssistantMessage(localSession, 'assistant', content));

  const startStoreSetup = () => {
    setEditingProfile(true);
    addAssistantMessage('رائع. اكتب أساسيات الهوية التي تريد ظهورها في القالب، ثم سأعرض عليك ملخصاً قبل أي حفظ محلي.');
  };

  const handleMessage = async (content: string) => {
    const clean = content.trim();
    if (!clean) return;
    if (/ضبط.*(متجر|هويه|هوية)|إعداد.*(متجر|هويه|هوية)|ابدأ.*(متجر|هويه|هوية)/.test(clean)) {
      commitSession(appendMerchantAssistantMessage(appendMerchantAssistantMessage(localSession, 'user', clean), 'assistant', 'سأفتح إعداد الهوية الآن. لن أحفظ أي معلومة قبل أن تعرضها وتؤكدها بنفسك.'));
      setCommandInput(''); setEditingProfile(true); return;
    }
    const commands = parseMerchantCommands(clean);
    const leaderPlan = resolveLocalLeaderPlan(clean, commands);
    const plannedSession = leaderPlan.intent === 'command'
      ? appendMerchantAssistantMessage(createMerchantAssistantTask(localSession, clean, commands), 'assistant', `${leaderPlan.label}: ${leaderPlan.reply}`)
      : appendMerchantAssistantMessage(appendMerchantAssistantMessage(localSession, 'user', clean), 'assistant', `${leaderPlan.label}: ${leaderPlan.reply}`);
    commitSession(plannedSession);
    if (onlineLeaderEnabled && isOnline && onRequestOnlineReply && leaderPlan.intent !== 'asset') {
      setIsOnlineLeaderReplying(true);
      try {
        const onlineReply = await onRequestOnlineReply(clean);
        const source = onlineReply.source === 'gemini-flash' ? 'القائد المتصل' : onlineReply.source === 'gemini-flash-lite' ? 'القائد المتصل السريع' : onlineReply.source === 'llm7' ? 'بديل LLM7 المتصل' : onlineReply.source === 'free-ai' ? 'بديل Free.ai المتصل' : 'القائد المحلي الاحتياطي';
        commitSession(appendMerchantAssistantMessage(plannedSession, 'assistant', `${source}: ${onlineReply.reply}`));
      } catch {
        commitSession(appendMerchantAssistantMessage(plannedSession, 'assistant', 'القائد المحلي الاحتياطي: تعذر الرد المتصل الآن. استمر العمل محلياً من دون توقف.'));
      } finally { setIsOnlineLeaderReplying(false); }
    }
    setCommandInput('');
  };

  const startVoiceInput = () => {
    if (isListening) { recognitionRef.current?.stop(); return; }
    const Recognition = (window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition;
    if (!Recognition) { addAssistantMessage('الإدخال الصوتي غير متاح في هذا المتصفح حالياً. اكتب طلبك في الحقل وسيعمل القائد محلياً بالطريقة نفسها.'); return; }
    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.lang = 'ar'; recognition.continuous = false; recognition.interimResults = false;
    recognition.onresult = event => {
      const transcript = Array.from(event.results).map(result => result[0]?.transcript || '').join(' ').trim();
      if (transcript) setCommandInput(current => `${current} ${transcript}`.trim());
    };
    recognition.onerror = event => { if (event.error !== 'aborted') addAssistantMessage('تعذر التقاط الصوت في هذه المحاولة. راجع إذن الميكروفون أو اكتب طلبك مباشرة.'); };
    recognition.onend = () => { setIsListening(false); recognitionRef.current = null; };
    setIsListening(true); recognition.start();
  };

  const selectArtwork = (kind: ArtworkKind, file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 8 * 1024 * 1024) { addAssistantMessage('اختر صورة PNG أو JPG أو WebP لا تتجاوز 8 ميجابايت. لن أحتفظ بها في سجل المحادثة.'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const source = String(reader.result || '');
      if (!source) { addAssistantMessage('تعذر قراءة الصورة. حاول اختيارها مرة أخرى من الهاتف.'); return; }
      setPendingArtwork({ kind, source, name: file.name.slice(0, 80) || 'صورة مرفقة' });
      addAssistantMessage(`وصلت صورة ${kind === 'logo' ? 'الشعار' : 'التذييل'} «${file.name.slice(0, 48)}». سأعرضها للمراجعة فقط؛ لن أضعها في القالب أو سجل المحادثة قبل تأكيدك.`);
    };
    reader.onerror = () => addAssistantMessage('تعذر قراءة الصورة. حاول اختيارها مرة أخرى أو استخدم نسخة أصغر.');
    reader.readAsDataURL(file);
  };

  const applyPendingTask = async () => {
    if (!pendingTask || isApplying) return;
    setIsApplying(true);
    try { const applied = await onApplyCommands(pendingTask.commands); const nextSession = completeMerchantAssistantTask(localSession, pendingTask.id, applied ? 'applied' : 'failed'); commitSession(nextSession); if (applied) onOpenUpdatedResult?.(); }
    catch { commitSession(completeMerchantAssistantTask(localSession, pendingTask.id, 'failed')); }
    finally { setIsApplying(false); }
  };

  const applyPendingArtwork = async () => {
    if (!pendingArtwork || isApplyingArtwork) return;
    setIsApplyingArtwork(true);
    try {
      const applied = await onApplyArtwork(pendingArtwork.kind, pendingArtwork.source);
      if (applied) { const label = pendingArtwork.kind === 'logo' ? 'الشعار' : 'التذييل'; setPendingArtwork(null); addAssistantMessage(`تم وضع ${label} في إعدادات القالب محلياً. يمكنك الرجوع للإعلان لمراجعة النتيجة أو العودة هنا لتغييرها.`); onOpenUpdatedResult?.(); }
      else addAssistantMessage('لم أغيّر القالب لأن إعادة البناء لم تكتمل. أبقيت إعداداتك السابقة كما هي.');
    } catch { addAssistantMessage('تعذر تطبيق الصورة. لم نغيّر القالب أو الإعلان الحالي.'); }
    finally { setIsApplyingArtwork(false); }
  };

  const requestProfileConfirmation = () => setPendingProfile(profileFromDraft(profile, draft));
  const confirmProfile = () => { if (!pendingProfile) return; onCommitProfile(pendingProfile); commitSession(appendMerchantAssistantMessage(localSession, 'assistant', 'تم حفظ تفضيلات الهوية على هذا الجهاز فقط. يمكنك تعديلها أو مسحها متى شئت.')); setPendingProfile(null); setEditingProfile(false); };
  const copyInsight = async () => { try { await navigator.clipboard?.writeText(insight); setCopied(true); window.setTimeout(() => setCopied(false), 1800); } catch { setCopied(false); } };
  const makeBackupFile = () => {
    const backup = createLocalProjectBackup(profile, localSession, template);
    return { backup, file: new File([stringifyLocalProjectBackup(backup)], backupFilename(backup.createdAt), { type: 'application/json' }) };
  };
  const downloadBackup = () => {
    const { backup, file } = makeBackupFile();
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url; link.download = backupFilename(backup.createdAt); document.body.appendChild(link); link.click(); document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    addAssistantMessage('حُفظت نسخة محلية من الإعدادات وذاكرة القائد. يمكنك رفع ملف JSON إلى Google Drive أو الاحتفاظ به في هاتفك.');
  };
  const shareBackup = async () => {
    const { file } = makeBackupFile();
    if (!navigator.share || !navigator.canShare?.({ files: [file] })) { downloadBackup(); return; }
    try { await navigator.share({ title: 'نسخة استوديو الملابس', text: 'نسخة احتياطية محلية من إعدادات المشروع.', files: [file] }); addAssistantMessage('اخترت مشاركة النسخة الاحتياطية. يمكنك اختيار Google Drive من نافذة المشاركة إن كانت مثبتة في هاتفك.'); }
    catch { addAssistantMessage('أُلغيت المشاركة. لم تُرسل النسخة إلى أي خدمة.'); }
  };
  const readBackup = (file?: File) => {
    if (!file || file.size > 16 * 1024 * 1024) { addAssistantMessage('اختر ملف نسخة JSON أصغر من 16 ميجابايت.'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const backup = parseLocalProjectBackup(String(reader.result || ''));
      if (!backup) { addAssistantMessage('هذا ليس ملف نسخة احتياطية صالحاً للتطبيق. لم نغيّر أي إعداد.'); return; }
      setPendingBackup(backup);
    };
    reader.onerror = () => addAssistantMessage('تعذر قراءة ملف النسخة الاحتياطية.');
    reader.readAsText(file);
  };

  return <section className="space-y-5" aria-label="القائد المحلي">
    <section className="reference-card overflow-hidden" aria-label="محادثة القائد المحلي">
      <div className="border-b border-primary/10 p-5"><div className="flex items-start gap-3"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm"><Sparkles size={22} /></div><div className="min-w-0"><span className="text-xs font-bold text-primary">القائد الذكي</span><span className="mr-2 text-xs font-bold text-muted-foreground">· {isOnline && onlineLeaderEnabled ? 'متصل تلقائياً' : 'محلي دون إنترنت'}</span><h2 className="mt-1 text-2xl font-black text-foreground">كيف أساعدك اليوم؟</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">القائد يعمل محلياً دائماً، ويستعين بالوضع المتصل للنص فقط عندما تتوفر الشبكة ثم يعود محلياً عند أي تعذر.</p></div></div></div>
      <div className="flex flex-wrap items-center gap-2 border-b border-primary/10 bg-white p-3" aria-label="أدوار القائد المحلي">{LOCAL_LEADER_ROLES.slice(0, 5).map(role => <span key={role.id} title={role.description} className="rounded-xl bg-secondary px-2 py-1 text-[11px] font-bold text-primary">{role.label}</span>)}{onRequestOnlineReply && <button type="button" onClick={() => setOnlineLeaderEnabled(value => !value)} className="rounded-xl border border-primary/15 bg-secondary px-2 py-1 text-[11px] font-bold text-primary transition active:scale-95">{onlineLeaderEnabled ? 'القائد المتصل: يعمل تلقائياً' : 'القائد المتصل: متوقف'}</button>}</div>
      <div className="space-y-3 bg-secondary p-4" style={{ minHeight: '20rem', maxHeight: '28rem', overflowY: 'auto' }} aria-live="polite">{localSession.messages.map(message => <div key={message.id} className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}><div style={{ maxWidth: '85%' }} className={`rounded-2xl px-3 py-2 text-sm leading-6 ${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-white text-foreground shadow-sm'}`}>{message.role === 'assistant' ? <Sparkles className="mb-1 text-primary" size={14} /> : <User className="mb-1" size={14} />}{message.content.split('\n').map((line, index) => <React.Fragment key={`${message.id}-${index}`}>{index > 0 && <br />}{line}</React.Fragment>)}</div></div>)}</div>
      <div className="border-t border-primary/10 bg-white p-4"><div className="mb-3 flex flex-wrap gap-2"><button type="button" onClick={startStoreSetup} className="rounded-xl border border-primary/15 bg-secondary px-3 py-1.5 text-xs font-bold text-primary transition active:scale-95">ضبط الهوية</button>{['كبّر الملابس', 'أرفق شعاراً', 'أرفق تذييلاً', 'حسّن النص التسويقي', 'أظهر السعر'].map(prompt => <button key={prompt} type="button" onClick={() => { void handleMessage(prompt); }} className="rounded-xl border border-primary/15 bg-secondary px-3 py-1.5 text-xs font-bold text-primary transition active:scale-95">{prompt}</button>)}</div><div className="mb-3 grid grid-cols-2 gap-2"><label className="cursor-pointer rounded-xl border border-primary/15 bg-secondary px-3 py-2 text-center text-xs font-bold text-primary transition active:scale-95"><span className="inline-flex items-center gap-1"><ImagePlus size={15} />إرفاق شعار</span><input className="sr-only" aria-label="إرفاق صورة الشعار" type="file" accept="image/png,image/jpeg,image/webp" onChange={event => selectArtwork('logo', event.target.files?.[0])} /></label><label className="cursor-pointer rounded-xl border border-primary/15 bg-secondary px-3 py-2 text-center text-xs font-bold text-primary transition active:scale-95"><span className="inline-flex items-center gap-1"><LayoutTemplate size={15} />إرفاق تذييل</span><input className="sr-only" aria-label="إرفاق صورة التذييل" type="file" accept="image/png,image/jpeg,image/webp" onChange={event => selectArtwork('footer', event.target.files?.[0])} /></label></div><form onSubmit={event => { event.preventDefault(); void handleMessage(commandInput); }} className="flex items-end gap-2"><Button type="button" variant="outline" size="icon" onClick={startStoreSetup} aria-label="ضبط الهوية"><Plus size={19} /></Button><Button type="button" variant="outline" size="icon" onClick={startVoiceInput} aria-label={isListening ? 'إيقاف الإدخال الصوتي' : 'بدء الإدخال الصوتي'}>{isListening ? <MicOff size={18} /> : <Mic size={18} />}</Button><Textarea value={commandInput} onChange={event => setCommandInput(event.target.value)} placeholder={isListening ? 'جارٍ الاستماع… راجع النص قبل الإرسال' : isOnlineLeaderReplying ? 'القائد المتصل يجهز رداً…' : 'اكتب أو تحدث بما تريد أن نعمله…'} className="min-h-10 flex-1 resize-none" rows={1} aria-label="رد على القائد المحلي" /><Button type="submit" size="icon" disabled={!commandInput.trim() || isOnlineLeaderReplying} aria-label="إرسال طلب للقائد"><Send size={17} /></Button></form></div>
      {pendingTask && <div className="border-t border-primary/10 bg-secondary p-4"><p className="text-xs leading-5 text-muted-foreground">المهمة الحالية: {pendingTask.summary}</p><Button type="button" onClick={() => { void applyPendingTask(); }} disabled={isApplying} className="mt-3 w-full"><Sparkles size={17} />{isApplying ? 'جارٍ تطبيق التغيير…' : 'تأكيد تطبيق التغيير'}</Button></div>}
    </section>
    {pendingArtwork && <section className="reference-card p-5" aria-label="مراجعة مرفق القالب"><div className="flex items-start gap-3"><BadgeCheck className="mt-0.5 text-primary" size={21} /><div><span className="text-xs font-bold text-primary">مراجعة قبل التطبيق</span><h3 className="mt-1 font-black text-foreground">{pendingArtwork.kind === 'logo' ? 'الشعار' : 'التذييل'}: {pendingArtwork.name}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">ستحفظ الصورة داخل إعدادات القالب على هذا الهاتف فقط؛ لا تحفظ ضمن رسائل المحادثة.</p></div></div><img src={pendingArtwork.source} alt={`معاينة ${pendingArtwork.kind === 'logo' ? 'الشعار' : 'التذييل'}`} className="mt-4 w-full rounded-2xl bg-secondary object-contain" style={{ maxHeight: pendingArtwork.kind === 'logo' ? '9rem' : '7rem' }} /><div className="mt-4 flex gap-2"><Button type="button" onClick={() => { void applyPendingArtwork(); }} disabled={isApplyingArtwork} className="flex-1"><CheckCircle2 size={17} />{isApplyingArtwork ? 'جارٍ تطبيق الصورة…' : 'تأكيد وضعها في القالب'}</Button><Button type="button" variant="outline" onClick={() => setPendingArtwork(null)} className="flex-1">إلغاء</Button></div></section>}
    {lastAppliedTask && <section className="rounded-3xl border border-primary/15 bg-primary/5 p-5" aria-label="آخر مهمة مطبقة"><div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 text-primary" size={21} /><div><span className="text-xs font-bold text-primary">آخر مهمة مطبقة ومحفوظة</span><h3 className="mt-1 font-black text-foreground">{lastAppliedTask.request}</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{lastAppliedTask.summary}</p></div></div></section>}
    {editingProfile && <section className="reference-card p-5" aria-label="إعداد الهوية"><div className="mb-5 flex items-start gap-3"><MessageSquareText className="mt-0.5 text-primary" size={21} /><div><h3 className="font-black text-primary">بيانات المركز والهوية</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">هذه المعلومات تغذي النص التسويقي تلقائياً. لن نحفظ شيئاً قبل عرض الملخص وموافقتك الصريحة.</p></div></div><div className="grid gap-3 sm:grid-cols-2"><Input value={draft.storeName} onChange={event => setDraft(current => ({ ...current, storeName: event.target.value }))} placeholder="اسم المركز" aria-label="اسم المركز" /><Input value={draft.storeLocation} onChange={event => setDraft(current => ({ ...current, storeLocation: event.target.value }))} placeholder="العنوان — اختياري" aria-label="العنوان" /><Input value={draft.storePhone} inputMode="tel" onChange={event => setDraft(current => ({ ...current, storePhone: event.target.value }))} placeholder="رقم التوصيل — اختياري" aria-label="رقم التوصيل" /><Input value={draft.storeCategory} onChange={event => setDraft(current => ({ ...current, storeCategory: event.target.value }))} placeholder="نوع المبيعات: نسائي أو رجالي…" aria-label="نوع المبيعات" /><Input value={draft.defaultDiscount || ''} inputMode="decimal" onChange={event => setDraft(current => ({ ...current, defaultDiscount: event.target.value }))} placeholder="الخصم الافتراضي % — اختياري" aria-label="الخصم الافتراضي" /><Input value={draft.defaultColors.join('، ')} onChange={event => setDraft(current => ({ ...current, defaultColors: event.target.value.split(/[،,]/) }))} placeholder="ألوانك المفضلة — اختياري" aria-label="الألوان المفضلة" /></div><Button type="button" onClick={requestProfileConfirmation} className="mt-5 w-full"><CheckCircle2 size={18} />مراجعة وحفظ الإعداد</Button></section>}
    {pendingProfile && <section className="rounded-3xl border border-primary/15 bg-primary/5 p-5" aria-label="تأكيد الهوية"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 text-primary" size={21} /><div><h3 className="font-black text-primary">راجع قبل الحفظ المحلي</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">سيُحفظ هذا الملخص على هذا الجهاز فقط، ويمكنك مسحه من هذه الصفحة.</p></div></div><dl className="mt-4 grid gap-2 text-sm text-foreground"><div><dt className="inline font-bold">المركز: </dt><dd className="inline">{pendingProfile.storeName || 'غير محدد'}</dd></div><div><dt className="inline font-bold">القسم: </dt><dd className="inline">{pendingProfile.storeCategory || 'غير محدد'}</dd></div><div><dt className="inline font-bold">الخصم: </dt><dd className="inline">{pendingProfile.defaultDiscount ? `${pendingProfile.defaultDiscount}%` : 'غير محدد'}</dd></div><div><dt className="inline font-bold">الألوان: </dt><dd className="inline">{pendingProfile.defaultColors.join('، ') || 'لا توجد'}</dd></div></dl><div className="mt-5 flex gap-2"><Button type="button" onClick={confirmProfile} className="flex-1"><CheckCircle2 size={17} />تأكيد الحفظ</Button><Button type="button" variant="outline" onClick={() => setPendingProfile(null)} className="flex-1">رجوع</Button></div></section>}
    {profile.onboardingComplete && !editingProfile && <section className="reference-card p-5"><div className="flex items-start justify-between gap-3"><div><span className="text-xs font-bold text-primary">ذاكرة الهوية المحلية</span><h3 className="mt-1 font-black text-foreground">{profile.storeName || 'هوية القالب جاهزة'}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{profile.storeCategory || 'اضبط وصف التصميم من هنا.'}{profile.defaultColors.length ? ` · ${profile.defaultColors.join('، ')}` : ''}</p></div><div className="flex gap-2"><Button type="button" variant="outline" size="sm" onClick={startStoreSetup}><RotateCcw size={15} />تعديل</Button><Button type="button" variant="outline" size="sm" onClick={onClearProfile} aria-label="مسح الهوية المحلية"><Trash2 size={15} /></Button></div></div></section>}
    <section className="reference-card p-5" aria-label="نسخ احتياطي للمشروع"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 text-primary" size={21} /><div><span className="text-xs font-bold text-primary">نسخة احتياطية شخصية</span><h3 className="mt-1 font-black text-foreground">احفظ عملك في هاتفك أو Google Drive</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">يُنشأ ملف JSON محلي لإعدادات القالب وذاكرة القائد. اختيار Google Drive يتم من نافذة المشاركة في الهاتف؛ لا نطلب صلاحية مشاهدة ملفات Drive.</p></div></div><div className="mt-4 grid grid-cols-2 gap-2"><Button type="button" variant="outline" onClick={downloadBackup}>تنزيل نسخة</Button><Button type="button" onClick={() => { void shareBackup(); }}>مشاركة إلى Drive</Button></div><label className="mt-2 flex cursor-pointer items-center justify-center rounded-xl border border-primary/15 bg-secondary px-3 py-2 text-xs font-bold text-primary transition active:scale-95">استيراد نسخة محفوظة<input className="sr-only" aria-label="استيراد نسخة احتياطية" type="file" accept="application/json,.json" onChange={event => readBackup(event.target.files?.[0])} /></label></section>
    {pendingBackup && <section className="rounded-3xl border border-primary/15 bg-primary/5 p-5" aria-label="تأكيد استعادة النسخة"><div className="flex items-start gap-3"><RotateCcw className="mt-0.5 text-primary" size={21} /><div><h3 className="font-black text-primary">استعادة نسخة محفوظة</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">ستستبدل إعدادات القالب وذاكرة القائد الحالية بهذه النسخة. لا يشمل الملف صورة الإعلان الجاري.</p></div></div><div className="mt-4 flex gap-2"><Button type="button" onClick={() => { onRestoreBackup(pendingBackup); setPendingBackup(null); addAssistantMessage('تمت استعادة النسخة الاحتياطية محلياً.'); }} className="flex-1">تأكيد الاستعادة</Button><Button type="button" variant="outline" onClick={() => setPendingBackup(null)} className="flex-1">إلغاء</Button></div></section>}
    <section className="rounded-3xl border border-[#e9e5ef] bg-white p-5"><div className="flex items-start gap-3"><Clipboard className="mt-0.5 text-primary" size={20} /><div className="min-w-0 flex-1"><h3 className="font-black text-primary">ملاحظة تحسين للمطور</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{insight}</p><p className="mt-2 text-[11px] font-bold text-muted-foreground">هذه مسودة محلية فقط؛ لا تُرسل تلقائياً ولا تحتوي محادثتك أو صورك.</p></div></div><Button type="button" variant="outline" size="sm" onClick={() => { void copyInsight(); }} className="mt-4 w-full"><Clipboard size={15} />{copied ? 'تم النسخ' : 'نسخ المسودة'}</Button><Button type="button" variant="outline" size="sm" onClick={onClearSession} className="mt-2 w-full"><Trash2 size={15} />مسح سجل القائد</Button></section>
    <p className="px-2 text-center text-[11px] leading-5 text-muted-foreground">القائد المحلي يعمل دائماً · النمط: {template.visualTheme || 'classic'} · القائد المتصل يعالج النص فقط عند تفعيله ووجود الإنترنت.</p>
  </section>;
}
