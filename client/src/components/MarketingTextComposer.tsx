import React, { useState } from 'react';
import { Bot, LoaderCircle, RefreshCw, Sparkles, WandSparkles } from 'lucide-react';
import type { AdDetails, MarketingTextCampaign, MarketingTextEmphasis, MarketingTextFormat, MarketingTextGoal, MarketingTextLength, MarketingTextPreferences, MarketingTextTone } from '@shared/types';
import {
  DEFAULT_MARKETING_TEXT_PREFERENCES,
  MARKETING_TEXT_CAMPAIGN_LABELS,
  MARKETING_TEXT_EMPHASIS_LABELS,
  MARKETING_TEXT_FORMAT_LABELS,
  MARKETING_TEXT_GOAL_LABELS,
  MARKETING_TEXT_LENGTH_LABELS,
  MARKETING_TEXT_TONE_LABELS,
  generateLocalMarketingText,
  resolveMarketingTextPreferences,
} from '@shared/marketingText';
import { Textarea } from './ui/textarea';

interface MarketingTextComposerProps {
  details: AdDetails;
  onChange: (details: AdDetails) => void;
  generateCloudText?: (details: AdDetails, preferences: MarketingTextPreferences, variant: number) => Promise<{ text: string; source?: string; message?: string }>;
}

const campaignOptions = Object.entries(MARKETING_TEXT_CAMPAIGN_LABELS) as Array<[MarketingTextCampaign, string]>;
const lengthOptions = Object.entries(MARKETING_TEXT_LENGTH_LABELS) as Array<[MarketingTextLength, string]>;
const emphasisOptions = Object.entries(MARKETING_TEXT_EMPHASIS_LABELS) as Array<[MarketingTextEmphasis, string]>;
const toneOptions = Object.entries(MARKETING_TEXT_TONE_LABELS) as Array<[MarketingTextTone, string]>;
const goalOptions = Object.entries(MARKETING_TEXT_GOAL_LABELS) as Array<[MarketingTextGoal, string]>;

export default function MarketingTextComposer({ details, onChange, generateCloudText }: MarketingTextComposerProps) {
  const preferences = resolveMarketingTextPreferences(details.marketingPreferences || DEFAULT_MARKETING_TEXT_PREFERENCES);
  const [variant, setVariant] = useState(0);
  const [notice, setNotice] = useState('يعمل المسار المحلي دون إنترنت. يمكنك تعديل النص كما تريد قبل المشاركة.');
  const [isCloudGenerating, setIsCloudGenerating] = useState(false);

  const updatePreferences = (patch: Partial<MarketingTextPreferences>) => {
    onChange({ ...details, marketingPreferences: { ...preferences, ...patch } });
  };

  const generateLocal = () => {
    const nextVariant = variant + 1;
    const result = generateLocalMarketingText(details, preferences, nextVariant);
    setVariant(nextVariant);
    onChange({ ...details, marketingText: result.text, marketingPreferences: preferences, marketingTextEngine: 'local' });
    setNotice('تمت صياغة نص محلياً على الهاتف. غيّر النبرة أو اضغط إعادة الصياغة لتجربة نسخة أخرى.');
  };

  const generateCloud = async () => {
    if (!generateCloudText) {
      generateLocal();
      setNotice('التحسين السحابي غير متاح في هذه الشاشة، لذلك استخدمنا النص المحلي على الهاتف.');
      return;
    }
    setNotice('جارٍ تحسين النص بالذكاء السحابي…');
    setIsCloudGenerating(true);
    try {
      const result = await generateCloudText({ ...details, marketingText: '' }, preferences, variant + 1);
      setVariant(value => value + 1);
      onChange({ ...details, marketingText: result.text, marketingPreferences: preferences, marketingTextEngine: result.source === 'cloud' ? 'cloud' : 'local' });
      setNotice(result.message || 'تمت صياغة النص بالذكاء السحابي. راجعه وعدّله قبل المشاركة.');
    } catch {
      const fallback = generateLocalMarketingText(details, preferences, variant + 1);
      setVariant(value => value + 1);
      onChange({ ...details, marketingText: fallback.text, marketingPreferences: preferences, marketingTextEngine: 'local' });
      setNotice('تعذر الاتصال بالخدمة السحابية، لذلك استخدمنا نصاً محلياً على الهاتف.');
    } finally {
      setIsCloudGenerating(false);
    }
  };

  return (
    <section className="rounded-3xl border border-violet-200 bg-gradient-to-bl from-violet-50 via-white to-amber-50 p-4" aria-label="مولد النص التسويقي">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm"><WandSparkles size={19} /></div>
        <div className="min-w-0 flex-1">
          <h3 className="font-black text-primary">مولد النص التسويقي</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">أنشئ نصاً جذاباً مناسباً للمنتج ثم حرره قبل الحفظ أو المشاركة.</p>
        </div>
      </div>

      <OptionGroup label="الحملة التسويقية" options={campaignOptions} value={preferences.campaign || 'professional'} onChange={campaign => updatePreferences({ campaign })} />
      <OptionGroup label="طول النص" options={lengthOptions} value={preferences.length || 'medium'} onChange={length => updatePreferences({ length })} />
      <OptionGroup label="تنسيق واتساب" options={emphasisOptions} value={preferences.emphasis || 'featured'} onChange={emphasis => updatePreferences({ emphasis, format: 'whatsapp' })} />
      <OptionGroup label="نبرة الإعلان" options={toneOptions} value={preferences.tone || 'persuasive'} onChange={tone => updatePreferences({ tone })} />
      <OptionGroup label="الهدف من الرسالة" options={goalOptions} value={preferences.goal || 'purchase'} onChange={goal => updatePreferences({ goal })} />

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={generateLocal} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-black text-primary-foreground transition active:scale-[.98]"><Sparkles size={17} />{details.marketingText ? 'إعادة صياغة محلية' : 'توليد نص محلي'}</button>
        <button type="button" onClick={() => void generateCloud()} disabled={isCloudGenerating} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-white px-4 text-sm font-black text-primary transition active:scale-[.98] disabled:opacity-60"><Bot size={17} />{isCloudGenerating ? <><LoaderCircle className="animate-spin" size={16} /> جارٍ التحسين…</> : 'تحسين بالذكاء السحابي'}</button>
      </div>
      <p className="mt-2 text-center text-[11px] leading-5 text-muted-foreground">تنسيق واتساب يضيف رموزاً وعناوين ونقاطاً قابلة للتحرير. المسار المحلي هو الافتراضي ويعمل بلا إنترنت.</p>

      <label className="mt-4 block space-y-2">
        <span className="flex items-center justify-between text-sm font-black text-foreground"><span>النص القابل للتحرير</span>{details.marketingText && <span className="text-[11px] font-bold text-emerald-700">جاهز للمشاركة</span>}</span>
        <Textarea
          className="min-h-28 rounded-2xl border-violet-200 bg-white p-4 text-right text-base leading-7 shadow-none focus-visible:border-primary"
          value={details.marketingText}
          onChange={event => onChange({ ...details, marketingText: event.target.value })}
          placeholder="اضغط «توليد نص محلي» لكتابة اقتراح يعمل دون إنترنت."
        />
      </label>
      <p className="mt-2 text-xs leading-5 text-primary" aria-live="polite">{notice}</p>
    </section>
  );
}

function OptionGroup<T extends string>({ label, options, value, onChange }: { label: string; options: Array<[T, string]>; value: T; onChange: (value: T) => void }) {
  return (
    <div className="mt-3.5 space-y-1.5" dir="rtl">
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold text-muted-foreground">{label}:</span>
        <span className="font-black text-primary">{options.find(([opt]) => opt === value)?.[1] || ''}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map(([option, optionLabel]) => {
          const active = value === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className={`min-h-8 rounded-xl px-2.5 py-1 text-xs font-bold transition active:scale-95 ${
                active
                  ? 'bg-primary text-primary-foreground shadow-sm ring-1 ring-primary'
                  : 'bg-white text-foreground ring-1 ring-stone-200/90 hover:bg-stone-50'
              }`}
            >
              {optionLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}
