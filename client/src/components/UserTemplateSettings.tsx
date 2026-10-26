import type { ProductShadowPreset, ProductStudioBackdrop, TemplateBadgeType, TemplateSettings, TemplateSize, TemplateVisualTheme } from '@shared/types';
import { TEMPLATE_THEME_LIST, getTemplateTheme } from '@shared/templateThemes';
import type { MerchantProfile } from '@shared/merchantAssistant';
import { ArrowRight, Check, CheckCircle2, ChevronDown, ChevronLeft, CircleHelp, ImagePlus, LayoutTemplate, MonitorSmartphone, Moon, Palette, RotateCcw, Settings2, Sparkles, Store, Sun, Tag, Wrench } from 'lucide-react';
import * as React from 'react';
import { useState } from 'react';
import { useOptionalTheme } from '@/contexts/ThemeContext';
import { PRACTICAL_HEADER_RATIO } from '@/lib/brandArtworkSupport';
import type { LocalToolSetupState } from '@/lib/localRemovalSetup';
import ArtworkPositionEditor from './ArtworkPositionEditor';
import ArtworkCropEditor from './ArtworkCropEditor';

interface UserTemplateSettingsProps {
  settings: TemplateSettings;
  onChange: (settings: TemplateSettings) => void;
  onBack: () => void;
  onAbout: () => void;
  onDeveloper?: () => void;
  profile?: MerchantProfile;
  onProfileChange?: (profile: MerchantProfile) => void;
  onRestoreNormal?: () => void;
  localToolSetup?: LocalToolSetupState;
  onPrepareLocalTools?: () => void;
}

type ToggleKey = 'showProductName' | 'showHeadline' | 'showDiscount' | 'showQuantity' | 'showColors' | 'showFeatures' | 'showPrice' | 'showStoreInfo' | 'showQualityMark';
type SettingsCardKey = 'size' | 'theme' | 'studio' | 'identity' | 'badges' | 'elements' | 'help';

const toggles: Array<{ key: ToggleKey; title: string; description: string }> = [
  { key: 'showProductName', title: 'اسم المنتج', description: 'يظهر في أعلى القالب.' },
  { key: 'showHeadline', title: 'العنوان القصير', description: 'يظهر أسفل اسم المنتج عند إدخاله.' },
  { key: 'showDiscount', title: 'شارة الخصم', description: 'تظهر فقط إذا أدخلت نسبة خصم.' },
  { key: 'showQuantity', title: 'الكمية', description: 'تظهر في مساحة المعلومات عند إدخالها.' },
  { key: 'showColors', title: 'الألوان', description: 'تظهر في مساحة المعلومات عند إدخالها.' },
  { key: 'showFeatures', title: 'المزايا', description: 'مثل خامة عالية الجودة وقطن ناعم.' },
  { key: 'showPrice', title: 'السعر', description: 'تظهر بطاقة السعر عند إدخاله.' },
  { key: 'showStoreInfo', title: 'اسم المتجر والتواصل', description: 'يظهر الشريط السفلي عند إدخاله.' },
  { key: 'showQualityMark', title: 'علامة الجودة', description: 'رمز التحقق البنفسجي في أعلى القالب.' },
];

const sizeOptions: Array<{ value: TemplateSize; title: string; subtitle: string }> = [
  { value: 'portrait', title: 'منشور عمودي', subtitle: '4:5 · 1080 × 1350' },
  { value: 'square', title: 'منشور مربع', subtitle: '1:1 · 1080 × 1080' },
  { value: 'story', title: 'قصة أو حالة', subtitle: '9:16 · 1080 × 1920' },
  { value: 'whatsapp', title: 'بطاقة واتساب', subtitle: '3:4 · 1080 × 1440' },
  { value: 'landscape', title: 'بانر أفقي', subtitle: '1.91:1 · 1200 × 628' },
];

const badgeOptions: Array<{ value: TemplateBadgeType; title: string; defaultText: string }> = [
  { value: 'none', title: 'بدون', defaultText: '' },
  { value: 'discount', title: 'خصم', defaultText: 'خصم 30%' },
  { value: 'new', title: 'جديد', defaultText: 'جديد' },
  { value: 'offer', title: 'عرض', defaultText: 'عرض خاص' },
  { value: 'price', title: 'سعر', defaultText: 'سعر مميز' },
  { value: 'quality', title: 'جودة', defaultText: 'جودة عالية' },
];

const backdropOptions: Array<{ value: ProductStudioBackdrop; title: string; detail: string }> = [
  { value: 'auto', title: 'تلقائي', detail: 'خلفية النمط المختار' },
  { value: 'soft', title: 'ناعم', detail: 'تدرج محايد' },
  { value: 'warm', title: 'دافئ', detail: 'لون رملي هادئ' },
  { value: 'cool', title: 'بارد', detail: 'لون أزرق خفيف' },
  { value: 'spotlight', title: 'إضاءة', detail: 'تركيز على المنتج' },
];

const shadowOptions: Array<{ value: ProductShadowPreset; title: string }> = [
  { value: 'none', title: 'بدون ظل' },
  { value: 'soft', title: 'ظل ناعم' },
  { value: 'grounded', title: 'ظل ثابت' },
];

const artworkRatios: Record<TemplateSize, { footer: number }> = {
  portrait: { footer: PRACTICAL_HEADER_RATIO },
  square: { footer: PRACTICAL_HEADER_RATIO },
  story: { footer: PRACTICAL_HEADER_RATIO },
  whatsapp: { footer: PRACTICAL_HEADER_RATIO },
  landscape: { footer: PRACTICAL_HEADER_RATIO },
};

function SettingsCard({ id, icon: Icon, title, summary, open, onToggle, children }: { id: string; icon: React.ComponentType<{ size?: number }>; title: string; summary: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return <section className="reference-card overflow-hidden">
    <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={`settings-card-${id}`} className="flex min-h-20 w-full items-center gap-3 p-4 text-right transition hover:bg-primary/[0.025] active:scale-[0.99]">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon size={20} /></span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-black text-foreground">{title}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{summary}</span></span>
      {open ? <ChevronDown size={18} className="shrink-0 text-primary" /> : <ChevronLeft size={18} className="shrink-0 text-muted-foreground" />}
    </button>
    {open && <div id={`settings-card-${id}`} className="border-t border-primary/10 bg-secondary/[0.18] p-4">{children}</div>}
  </section>;
}

function ToggleRow({ item, active, onToggle }: { item: { key: ToggleKey; title: string; description: string }; active: boolean; onToggle: () => void }) {
  return <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 rounded-2xl border border-stone-100 bg-white p-3 text-right transition hover:border-primary/20 active:scale-[0.99]">
    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${active ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>{active && <Check size={16} />}</span>
    <span className="min-w-0 flex-1"><span className="block text-sm font-black text-foreground">{item.title}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{item.description}</span></span>
    <span className={`text-xs font-bold ${active ? 'text-primary' : 'text-muted-foreground'}`}>{active ? 'ظاهر' : 'مخفي'}</span>
  </button>;
}

export default function UserTemplateSettings({ settings, onChange, onBack, onAbout, onDeveloper, profile, onProfileChange, onRestoreNormal, localToolSetup, onPrepareLocalTools }: UserTemplateSettingsProps) {
  const { theme, setTheme } = useOptionalTheme();
  const [artworkError, setArtworkError] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [openCard, setOpenCard] = useState<SettingsCardKey>('size');
  const [phoneChecklistVisible, setPhoneChecklistVisible] = useState(false);
  const [pendingArtwork, setPendingArtwork] = useState<{ kind: 'logo' | 'footer'; source: string } | null>(null);
  const visibleCount = toggles.filter(item => settings[item.key]).length;
  const selectedBadges = settings.badgeTypes?.slice() || (settings.badgeType !== 'none' ? [settings.badgeType] : []);
  const selectedTheme = getTemplateTheme(settings.visualTheme);
  const setCard = (card: SettingsCardKey) => setOpenCard(current => current === card ? current : card);
  const updateSettings = (next: TemplateSettings) => { onChange(next); setIsSaved(false); };
  const setToggle = (key: ToggleKey) => updateSettings({ ...settings, [key]: !settings[key] });
  const toggleBadge = (type: Exclude<TemplateBadgeType, 'none'>) => {
    const next = selectedBadges.includes(type) ? selectedBadges.filter(value => value !== type) : [...selectedBadges, type].slice(0, 3);
    updateSettings({ ...settings, badgeTypes: next, badgeType: next[0] || 'none', badgeText: next.length === 1 ? settings.badgeText || badgeOptions.find(option => option.value === next[0])?.defaultText || '' : '' });
  };
  const saveSettings = () => { onChange({ ...settings }); setIsSaved(true); };
  const selectArtwork = (kind: 'footer' | 'logo', file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 8 * 1024 * 1024) {
      setArtworkError('اختر صورة PNG أو JPG أو WebP لا تتجاوز 8 ميجابايت. ستضبطها داخل المحرر قبل الحفظ.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => { setPendingArtwork({ kind, source: String(reader.result || '') }); setArtworkError(''); };
    reader.onerror = () => setArtworkError('تعذر قراءة الصورة. حاول اختيارها مرة أخرى أو استخدم نسخة محفوظة في الهاتف.');
    reader.readAsDataURL(file);
  };
  const saveArtwork = (value: string) => {
    if (!pendingArtwork) return;
    updateSettings(pendingArtwork.kind === 'logo' ? { ...settings, storeLogoArtwork: value, showStoreLogo: true } : { ...settings, footerArtwork: value, showFooterArtwork: true });
    setPendingArtwork(null);
  };
  const updateProfile = (patch: Partial<MerchantProfile>) => {
    if (!profile || !onProfileChange) return;
    onProfileChange({ ...profile, ...patch, onboardingComplete: true, updatedAt: Date.now() });
  };

  return <section className="space-y-4" dir="rtl">
    <div className="reference-card p-5 sm:p-7">
      <span className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary"><Settings2 size={15} /> إعدادات اختيارية</span>
      <h2 className="text-2xl font-black text-foreground">عدّل شكل الإعلان عند الحاجة</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">لإنشاء إعلانك الأول لا تحتاج إلى تغيير أي شيء هنا. افتح بطاقة واحدة فقط عندما تريد تعديل المقاس أو هوية المتجر، وستبقى اختياراتك محفوظة على هذا الهاتف.</p>
      <div className="mt-5 grid grid-cols-3 gap-2 rounded-2xl border border-primary/10 bg-gradient-to-l from-primary/10 to-violet-50 p-3 text-center"><div><span className="block text-[10px] font-bold text-muted-foreground">المقاس والنمط</span><span className="mt-1 block text-xs font-black text-primary">{sizeOptions.find(option => option.value === settings.size)?.title} · {selectedTheme.title}</span></div><div className="border-x border-primary/10"><span className="block text-[10px] font-bold text-muted-foreground">العناصر</span><span className="mt-1 block text-sm font-black text-primary">{visibleCount}</span></div><div><span className="block text-[10px] font-bold text-muted-foreground">الشارات</span><span className="mt-1 block text-sm font-black text-primary">{selectedBadges.length || '—'}</span></div></div>
    </div>

    <SettingsCard id="size" icon={MonitorSmartphone} title="المقاس ومنصة النشر" summary={sizeOptions.find(option => option.value === settings.size)?.subtitle || 'اختر المقاس المناسب'} open={openCard === 'size'} onToggle={() => setCard('size')}>
      <div className="grid grid-cols-2 gap-3">{sizeOptions.map(option => <button key={option.value} type="button" onClick={() => updateSettings({ ...settings, size: option.value })} className={`rounded-2xl border p-4 text-right transition active:scale-[.99] ${settings.size === option.value ? 'border-primary bg-white shadow-sm' : 'border-transparent bg-white/70 text-muted-foreground'}`}><span className="block text-sm font-black">{option.title}</span><span className="mt-1 block text-xs">{option.subtitle}</span></button>)}</div>
    </SettingsCard>

    <SettingsCard id="theme" icon={Palette} title="نمط الإعلان" summary={`${selectedTheme.title}: ${selectedTheme.description}`} open={openCard === 'theme'} onToggle={() => setCard('theme')}>
      <p className="mb-3 text-xs leading-5 text-muted-foreground">اختر أسلوباً بصرياً واحداً. لا يغير النمط المقاس أو النصوص أو مواضع العناصر، ويظل فحص الجودة المحلي فعالاً قبل الحفظ.</p>
      <div className="grid gap-2 sm:grid-cols-2">{TEMPLATE_THEME_LIST.map(theme => {
        const selected = selectedTheme.id === theme.id;
        return <button key={theme.id} type="button" onClick={() => updateSettings({ ...settings, visualTheme: theme.id as TemplateVisualTheme })} className="rounded-2xl border p-3 text-right transition active:scale-[.99]" style={{ backgroundColor: theme.palette.background, borderColor: selected ? theme.palette.primary : 'rgba(42,40,101,.12)' }} aria-pressed={selected}><span className="flex items-center gap-2"><span className="h-7 w-7 rounded-full border border-primary/10" style={{ backgroundColor: theme.palette.accent }} /><span className="text-sm font-black" style={{ color: theme.palette.primary }}>{theme.title}</span>{selected && <Check size={15} style={{ color: theme.palette.primary }} />}</span><span className="mt-1 block text-[11px] leading-5" style={{ color: theme.palette.muted }}>{theme.description}</span></button>;
      })}</div>
    </SettingsCard>

    <SettingsCard id="studio" icon={Sparkles} title="استديو المنتج" summary="خلفية وظل محليان داخل منطقة المنتج" open={openCard === 'studio'} onToggle={() => setCard('studio')}>
      <p className="mb-3 text-xs leading-5 text-muted-foreground">هذه إضافات رسم محلية داخل القالب؛ لا تولّد صورة جديدة ولا ترسل صورة القطعة إلى الإنترنت.</p>
      <div className="grid grid-cols-2 gap-2">{backdropOptions.map(option => <button key={option.value} type="button" onClick={() => updateSettings({ ...settings, productBackdrop: option.value })} className={`rounded-xl border p-3 text-right transition active:scale-[.99] ${(settings.productBackdrop || 'auto') === option.value ? 'border-primary bg-white text-primary shadow-sm' : 'border-transparent bg-white/70 text-muted-foreground'}`}><span className="block text-xs font-black">{option.title}</span><span className="mt-1 block text-xs">{option.detail}</span></button>)}</div>
      <p className="mb-2 mt-4 text-xs font-black text-primary">ظل المنتج</p><div className="grid grid-cols-3 gap-2">{shadowOptions.map(option => <button key={option.value} type="button" onClick={() => updateSettings({ ...settings, productShadow: option.value })} className={`rounded-xl px-3 py-2 text-xs font-black transition active:scale-[.99] ${(settings.productShadow || 'soft') === option.value ? 'bg-primary text-white' : 'bg-white text-primary shadow-sm'}`}>{option.title}</button>)}</div>
    </SettingsCard>

    <SettingsCard id="identity" icon={Store} title="بيانات المركز والهوية" summary={profile?.storeName ? `${profile.storeName} · تُضاف للنص التسويقي تلقائياً` : settings.storeLogoArtwork || settings.footerArtwork ? 'الشعار أو التذييل محفوظان ويمكن تعديلهما' : 'أضف بيانات المركز والشعار والتذييل عند الحاجة'} open={openCard === 'identity'} onToggle={() => setCard('identity')}>
      <p className="text-xs leading-5 text-muted-foreground">هذه البيانات لا تظهر فوق الصورة تلقائياً. يستخدمها النص التسويقي فقط، أما الشعار والتذييل فهما اختياريان داخل القالب.</p>
      {profile && onProfileChange && <div className="mt-4 grid gap-3 rounded-2xl bg-white p-3 sm:grid-cols-2"><input value={profile.storeName} onChange={event => updateProfile({ storeName: event.target.value.slice(0, 80) })} className="min-h-11 rounded-xl border border-stone-200 px-3 text-sm text-foreground outline-none focus:border-primary" placeholder="اسم المركز" aria-label="اسم المركز للنص التسويقي" /><input value={profile.storeCategory} onChange={event => updateProfile({ storeCategory: event.target.value.slice(0, 48) })} className="min-h-11 rounded-xl border border-stone-200 px-3 text-sm text-foreground outline-none focus:border-primary" placeholder="نوع المبيعات: نسائي، رجالي…" aria-label="نوع مبيعات المركز" /><input value={profile.storePhone} inputMode="tel" onChange={event => updateProfile({ storePhone: event.target.value.slice(0, 32) })} className="min-h-11 rounded-xl border border-stone-200 px-3 text-sm text-foreground outline-none focus:border-primary" placeholder="رقم الهاتف للتوصيل" aria-label="رقم الهاتف للتوصيل" /><input value={profile.storeLocation} onChange={event => updateProfile({ storeLocation: event.target.value.slice(0, 80) })} className="min-h-11 rounded-xl border border-stone-200 px-3 text-sm text-foreground outline-none focus:border-primary" placeholder="العنوان — اختياري" aria-label="عنوان المركز" /><input value={profile.defaultDiscount || ''} inputMode="decimal" onChange={event => updateProfile({ defaultDiscount: event.target.value.replace(/[^0-9.]/g, '').slice(0, 16) })} className="min-h-11 rounded-xl border border-stone-200 px-3 text-sm text-foreground outline-none focus:border-primary" placeholder="الخصم الافتراضي % — اختياري" aria-label="الخصم الافتراضي" /><p style={{ alignSelf: 'center' }} className="text-xs leading-5 text-muted-foreground">احفظها مرة واحدة؛ عند تجهيز النص ستدخل تلقائياً، وتبقى حقول القطعة هي ما تغيّره كل مرة.</p></div>}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="cursor-pointer rounded-2xl border border-primary/10 bg-white p-3 text-sm font-black text-primary transition hover:bg-primary/5 active:scale-[.99]"><span className="flex items-center gap-2"><ImagePlus size={17} />اختيار شعار المتجر</span><span className="mt-1 block text-[11px] font-medium text-muted-foreground">أي نسبة مناسبة؛ اضبط القص والاحتواء قبل الحفظ.</span><input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={event => selectArtwork('logo', event.target.files?.[0])} /></label>
        <label className="cursor-pointer rounded-2xl border border-primary/10 bg-white p-3 text-sm font-black text-primary transition hover:bg-primary/5 active:scale-[.99]"><span className="flex items-center gap-2"><LayoutTemplate size={17} />اختيار تذييل المتجر</span><span className="mt-1 block text-[11px] font-medium text-muted-foreground">أي نسبة مناسبة؛ اضبطه إلى 2688 × 494 قبل الحفظ.</span><input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={event => selectArtwork('footer', event.target.files?.[0])} /></label>
      </div>
      {(settings.storeLogoArtwork || settings.footerArtwork) && <div className="mt-4 rounded-xl bg-white p-3"><p className="mb-2 text-xs font-black text-foreground">معاينة هوية المتجر</p><div className="flex flex-wrap items-center gap-3">{settings.storeLogoArtwork && <div className="text-center"><img src={settings.storeLogoArtwork} alt="معاينة شعار المتجر" className="mx-auto h-12 w-12 rounded-full border-2 border-white bg-white object-cover shadow-sm" /><button type="button" className="mt-1 text-[11px] font-bold text-red-700" onClick={() => updateSettings({ ...settings, storeLogoArtwork: '', showStoreLogo: false })}>حذف الشعار</button></div>}{settings.footerArtwork && <div className="w-full"><img src={settings.footerArtwork} alt="معاينة تذييل المتجر الكامل" className="h-auto w-full rounded-lg bg-white object-contain" /><button type="button" className="mt-1 text-[11px] font-bold text-red-700" onClick={() => updateSettings({ ...settings, footerArtwork: '', showFooterArtwork: false })}>حذف تذييل المتجر</button></div>}</div></div>}
      <ArtworkPositionEditor settings={settings} onChange={updateSettings} />
      {artworkError && <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs font-bold leading-5 text-red-800">{artworkError}</p>}
    </SettingsCard>

    <SettingsCard id="badges" icon={Tag} title="شارات العرض" summary={selectedBadges.length ? `${selectedBadges.length} شارات ظاهرة أعلى الإعلان` : 'لا توجد شارات مختارة'} open={openCard === 'badges'} onToggle={() => setCard('badges')}>
      <p className="mb-3 text-xs leading-5 text-muted-foreground">اختر حتى ثلاث شارات. يضعها القالب في صف ثابت أعلى الإعلان حتى لا تغطي الملابس أو السعر.</p>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={() => updateSettings({ ...settings, badgeTypes: [], badgeType: 'none', badgeText: '' })} className={`rounded-xl px-3 py-2 text-xs font-black ${selectedBadges.length === 0 ? 'bg-primary text-white' : 'bg-white text-primary shadow-sm'}`}>بدون</button>{badgeOptions.filter(option => option.value !== 'none').map(option => <button key={option.value} type="button" onClick={() => toggleBadge(option.value as Exclude<TemplateBadgeType, 'none'>)} className={`rounded-xl px-3 py-2 text-xs font-black ${selectedBadges.includes(option.value as Exclude<TemplateBadgeType, 'none'>) ? 'bg-primary text-white' : 'bg-white text-primary shadow-sm'}`}>{option.title}</button>)}</div>
      {selectedBadges.length === 1 && <input value={settings.badgeText} onChange={event => updateSettings({ ...settings, badgeText: event.target.value })} className="mt-3 h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm font-bold" placeholder="نص مخصص للشارة الوحيدة" />}
      {selectedBadges.length > 1 && <p className="mt-3 text-xs font-bold text-muted-foreground">تستخدم الشارات المتعددة عناوينها الافتراضية كي تبقى واضحة داخل الإعلان.</p>}
    </SettingsCard>

    <SettingsCard id="elements" icon={Palette} title="عناصر الإعلان الظاهرة" summary={`${visibleCount} من ${toggles.length} عناصر مفعّلة`} open={openCard === 'elements'} onToggle={() => setCard('elements')}>
      <div className="space-y-2">{toggles.map(item => <ToggleRow key={item.key} item={item} active={settings[item.key]} onToggle={() => setToggle(item.key)} />)}</div>
    </SettingsCard>

    <SettingsCard id="help" icon={CircleHelp} title="المساعدة والتطبيق" summary="دليل الاستخدام، معلومات المشروع، ولوحة المطور المحمية" open={openCard === 'help'} onToggle={() => setCard('help')}>
      {localToolSetup && <div className="rounded-2xl border border-primary/15 bg-white p-3"><div className="flex items-center gap-3"><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${localToolSetup.status === 'failed' ? 'bg-red-50 text-red-700' : 'bg-primary/10 text-primary'}`}>{localToolSetup.status === 'ready' ? <CheckCircle2 size={18} /> : <Wrench size={18} />}</span><div className="min-w-0 flex-1"><p className="text-sm font-black text-primary">أدوات إزالة الخلفية</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{localToolSetup.status === 'ready' ? 'جاهزة داخل التطبيق للعمل المحلي.' : localToolSetup.label}</p></div></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{ width: `${localToolSetup.progress}%` }} /></div><div className="mt-3 flex items-center justify-between gap-2"><span className="text-[11px] font-bold text-muted-foreground">نموذج محلي بحجم تقريبي 4.4MB</span><button type="button" disabled={!onPrepareLocalTools || localToolSetup.status === 'preparing'} onClick={onPrepareLocalTools} className="rounded-xl border border-primary/20 bg-white px-3 py-2 text-xs font-black text-primary disabled:opacity-50">{localToolSetup.status === 'preparing' ? 'جارٍ التجهيز…' : 'إعادة التحميل'}</button></div></div>}
      <button type="button" onClick={() => setTheme?.(theme === 'dark' ? 'light' : 'dark')} className="flex min-h-12 w-full items-center gap-2 rounded-2xl border border-primary/15 bg-white px-4 py-3 text-right text-sm font-black text-primary transition active:scale-[0.99]"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</span>{theme === 'dark' ? 'العودة للوضع الفاتح' : 'تفعيل الوضع الليلي'}<span style={{ marginRight: 'auto' }} className="text-[11px] text-muted-foreground">محفوظ على هذا الهاتف</span></button>
      {onRestoreNormal && <button type="button" onClick={onRestoreNormal} className="mt-3 flex min-h-12 w-full items-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-right text-sm font-black text-primary transition active:scale-[0.99]"><RotateCcw size={18} />استعادة الوضع الطبيعي<span style={{ marginRight: 'auto' }} className="text-[11px] font-medium text-muted-foreground">لا يحذف الصور أو الحساب أو المفاتيح</span></button>}
      <button type="button" onClick={onAbout} className="flex min-h-12 w-full items-center gap-2 rounded-2xl border border-primary/15 bg-white px-4 py-3 text-right text-sm font-black text-primary transition active:scale-[0.99]"><Sparkles size={18} />حول التطبيق وبيانات المطور</button>
      {onDeveloper && <button type="button" onClick={onDeveloper} className="mt-3 flex min-h-12 w-full items-center gap-2 rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-right text-sm font-black text-primary transition active:scale-[0.99]"><Wrench size={18} />فتح لوحة المطور المحمية</button>}
      <button type="button" onClick={() => setPhoneChecklistVisible(value => !value)} className="mt-3 flex min-h-12 w-full items-center gap-2 rounded-2xl border border-primary/15 bg-white px-4 py-3 text-right text-sm font-black text-primary transition active:scale-[0.99]"><MonitorSmartphone size={18} />اختبار الهاتف السريع</button>
      {phoneChecklistVisible && <div className="mt-3 rounded-2xl border border-primary/10 bg-white p-3"><p className="text-sm font-black text-primary">جرّب هذه الخطوات الست فقط</p><ol className="mt-2 space-y-2 text-xs leading-5 text-muted-foreground"><li>١. ارفع صورة من المعرض أو الكاميرا.</li><li>٢. تأكد أن القالب والأدوات لا تحتاج تمرير الصفحة.</li><li>٣. جرّب 2D أصلي ثم 2.5D مرتفع ثم منصة.</li><li>٤. اسحب شريط المقاسات واختر نسبة أخرى.</li><li>٥. أضف عنواناً وحرّكه ثم انقر خارج اللوحة.</li><li>٦. جرّب تنزيل، الصورة فقط، ثم واتساب.</li></ol></div>}
    </SettingsCard>

    <button type="button" onClick={saveSettings} className={`inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl px-4 text-base font-black shadow-lg transition active:scale-[0.98] ${isSaved ? 'bg-emerald-600 text-white shadow-emerald-200' : 'bg-primary text-primary-foreground shadow-primary/20'}`}><CheckCircle2 size={19} />{isSaved ? 'تم حفظ الإعدادات على هذا الهاتف' : 'حفظ الإعدادات'}</button>
    <button type="button" onClick={onBack} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-secondary px-4 text-sm font-black text-primary transition active:scale-[0.98]"><ArrowRight size={18} />العودة إلى الإنشاء</button>
    {pendingArtwork && <ArtworkCropEditor kind={pendingArtwork.kind} source={pendingArtwork.source} onSave={saveArtwork} onCancel={() => setPendingArtwork(null)} />}
  </section>;
}
