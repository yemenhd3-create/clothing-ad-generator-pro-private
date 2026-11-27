import { LoaderCircle, MessageSquareText, SlidersHorizontal } from 'lucide-react';
import React, { useState } from 'react';
import type { AdDetails, MarketingTextCampaign, MarketingTextEmphasis, MarketingTextLength, MarketingTextPreferences } from '@shared/types';
import { DEFAULT_MARKETING_TEXT_PREFERENCES, MARKETING_TEXT_CAMPAIGN_LABELS, MARKETING_TEXT_EMPHASIS_LABELS, resolveMarketingTextPreferences } from '@shared/marketingText';

const campaignOptions = Object.entries(MARKETING_TEXT_CAMPAIGN_LABELS) as Array<[MarketingTextCampaign, string]>;
const lengthOptions: Array<[MarketingTextLength, string]> = [['concise', 'مختصر'], ['short', 'أساسي'], ['medium', 'متوسط'], ['long', 'كبير']];
const emphasisOptions = Object.entries(MARKETING_TEXT_EMPHASIS_LABELS) as Array<[MarketingTextEmphasis, string]>;

/**
 * أداة النص التسويقي في غرفة الملابس.
 * الوضع المختصر (الافتراضي): اسم القطعة والسعر وزر «جهّز النص» فقط.
 * زر «خيارات» يفتح الوضع المفصّل: الحملة، طول النص، التنسيق، الكمية، الخصم، الهاتف، والتعليمات الخاصة.
 */
export default function WardrobeMarketingTextTool({ details, savedPreferences, disabled, isGenerating, onChange, onGenerate }: { details: AdDetails; savedPreferences?: Partial<MarketingTextPreferences>; disabled: boolean; isGenerating: boolean; onChange: (patch: Partial<AdDetails>) => void; onGenerate: (details: AdDetails, preferences: MarketingTextPreferences, variant: number) => Promise<{ text: string; source: string; message?: string }> }) {
  const [variant, setVariant] = useState(0);
  const [notice, setNotice] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const preferences = resolveMarketingTextPreferences({ ...DEFAULT_MARKETING_TEXT_PREFERENCES, ...details.marketingPreferences, ...savedPreferences });
  const updatePreferences = (patch: Partial<MarketingTextPreferences>) => onChange({ marketingPreferences: { ...preferences, ...patch } });
  const updateDetails = (patch: Partial<AdDetails>) => onChange(patch);
  const generate = async () => {
    const nextVariant = variant + 1;
    setVariant(nextVariant);
    const result = await onGenerate({ ...details, marketingPreferences: preferences }, preferences, nextVariant);
    setNotice(`${result.message || 'الرسالة جاهزة.'} اضغط «واتساب + نص» أسفل القالب للإرسال.`);
  };

  return <div>
    <p className="mb-2 text-[11px] font-bold text-muted-foreground">اكتب اسم القطعة والسعر فقط. بيانات المركز المحفوظة تدخل تلقائياً ولا تظهر داخل الصورة.</p>
    <div className="grid grid-cols-2 gap-2">
      <input value={details.productName} disabled={disabled} onChange={event => updateDetails({ productName: event.target.value })} placeholder="اسم القطعة" className="min-h-10 rounded-xl border border-primary/10 px-3 text-xs text-foreground outline-none focus:border-primary" aria-label="اسم القطعة للنص التسويقي" />
      <input value={details.price} disabled={disabled} inputMode="numeric" onChange={event => updateDetails({ price: event.target.value, currency: details.currency || 'ريال' })} placeholder="السعر" className="min-h-10 rounded-xl border border-primary/10 px-3 text-xs text-foreground outline-none focus:border-primary" aria-label="السعر للنص التسويقي" />
    </div>
    <div className="mt-2 grid grid-cols-2 gap-2">
      <button type="button" disabled={disabled || isGenerating} onClick={() => void generate()} className="reference-primary w-full">{isGenerating ? <><LoaderCircle className="animate-spin" size={16} />جارٍ التجهيز…</> : <><MessageSquareText size={16} />جهّز النص</>}</button>
      <button type="button" disabled={disabled} aria-expanded={showOptions} onClick={() => setShowOptions(value => !value)} className="reference-outline w-full"><SlidersHorizontal size={16} />{showOptions ? 'إخفاء الخيارات' : 'خيارات'}</button>
    </div>
    {showOptions && (
      <div className="mt-2.5 space-y-2.5 rounded-2xl border border-primary/15 bg-white p-3 shadow-sm" dir="rtl">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-muted-foreground">الحملة:</span>
            <span className="font-black text-primary">{MARKETING_TEXT_CAMPAIGN_LABELS[preferences.campaign || 'professional']}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {campaignOptions.map(([id, label]) => {
              const active = (preferences.campaign || 'professional') === id;
              return (
                <button
                  key={id}
                  type="button"
                  disabled={disabled}
                  onClick={() => updatePreferences({ campaign: id })}
                  className={`min-h-8 rounded-xl px-2.5 py-1 text-xs font-bold transition active:scale-95 ${
                    active
                      ? 'bg-primary text-primary-foreground shadow-sm ring-1 ring-primary'
                      : 'bg-secondary/60 text-foreground ring-1 ring-stone-200/90 hover:bg-secondary'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-muted-foreground">طول النص:</span>
            <span className="font-black text-primary">{lengthOptions.find(([id]) => id === preferences.length)?.[1] || 'متوسط'}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {lengthOptions.map(([id, label]) => {
              const active = preferences.length === id;
              return (
                <button
                  key={id}
                  type="button"
                  disabled={disabled}
                  onClick={() => updatePreferences({ length: id })}
                  className={`min-h-8 rounded-xl px-2.5 py-1 text-xs font-bold transition active:scale-95 ${
                    active
                      ? 'bg-primary text-primary-foreground shadow-sm ring-1 ring-primary'
                      : 'bg-secondary/60 text-foreground ring-1 ring-stone-200/90 hover:bg-secondary'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-muted-foreground">التنسيق:</span>
            <span className="font-black text-primary">{MARKETING_TEXT_EMPHASIS_LABELS[preferences.emphasis || 'featured']}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {emphasisOptions.map(([id, label]) => {
              const active = (preferences.emphasis || 'featured') === id;
              return (
                <button
                  key={id}
                  type="button"
                  disabled={disabled}
                  onClick={() => updatePreferences({ emphasis: id, format: 'whatsapp' })}
                  className={`min-h-8 rounded-xl px-2.5 py-1 text-xs font-bold transition active:scale-95 ${
                    active
                      ? 'bg-primary text-primary-foreground shadow-sm ring-1 ring-primary'
                      : 'bg-secondary/60 text-foreground ring-1 ring-stone-200/90 hover:bg-secondary'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 border-t border-primary/10 pt-2">
          <input
            value={details.quantity}
            disabled={disabled}
            onChange={event => updateDetails({ quantity: event.target.value })}
            placeholder="الكمية"
            className="min-h-9 min-w-0 rounded-lg border border-primary/10 px-2 text-center text-xs text-foreground outline-none focus:border-primary"
            aria-label="الكمية المتاحة"
          />
          <input
            value={details.discount}
            disabled={disabled}
            inputMode="decimal"
            onChange={event => updateDetails({ discount: event.target.value })}
            placeholder="الخصم %"
            className="min-h-9 min-w-0 rounded-lg border border-primary/10 px-2 text-center text-xs text-foreground outline-none focus:border-primary"
            aria-label="الخصم"
          />
          <input
            value={details.storePhone}
            disabled={disabled}
            inputMode="tel"
            onChange={event => updateDetails({ storePhone: event.target.value })}
            placeholder="رقم الهاتف"
            className="min-h-9 min-w-0 rounded-lg border border-primary/10 px-2 text-center text-xs text-foreground outline-none focus:border-primary"
            aria-label="رقم التوصيل وواتساب"
          />
        </div>

        <div className="space-y-1.5 border-t border-primary/10 pt-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-muted-foreground">تعليمات خاصة (اختياري):</span>
          </div>
          <input
            value={preferences.customInstructions || ''}
            disabled={disabled}
            onChange={event => updatePreferences({ customInstructions: event.target.value })}
            placeholder="مثال: ركّز على خامة الصيف، أو عرض حبتين"
            className="min-h-9 w-full rounded-lg border border-primary/10 px-2 text-xs text-foreground outline-none focus:border-primary"
            aria-label="تعليمات إضافية للنص التسويقي"
          />
        </div>
      </div>
    )}
    {notice && <p className="mt-2 text-[10px] leading-4 text-muted-foreground" aria-live="polite">{notice}</p>}
  </div>;
}
