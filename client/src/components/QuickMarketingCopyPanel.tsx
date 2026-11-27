import { Copy, LoaderCircle, RefreshCw, Send, Sparkles, Wand2 } from 'lucide-react';
import React, { useState } from 'react';
import type { AdDetails } from '@shared/types';

interface QuickMarketingCopyPanelProps {
  details: AdDetails;
  onChange: (patch: Partial<AdDetails>) => void;
  onGenerate: (variant: number) => void;
  isGenerating: boolean;
  onCopy: () => void;
  onShareWhatsApp: () => void;
  onSwitchToFull: () => void;
}

/**
 * مسار «صورتي جاهزة»: لا تفريغ للخلفية ولا تصميم،
 * فقط حقول بسيطة ثم نص تسويقي فوري قابل للنسخ والمشاركة.
 */
export default function QuickMarketingCopyPanel({ details, onChange, onGenerate, isGenerating, onCopy, onShareWhatsApp, onSwitchToFull }: QuickMarketingCopyPanelProps) {
  const [variant, setVariant] = useState(1);
  const hasText = Boolean(details.marketingText.trim());
  return (
    <div className="space-y-5" dir="rtl">
      <p className="rounded-2xl border border-primary/10 bg-primary/[0.045] p-4 text-xs leading-5 text-muted-foreground">سنستخدم صورتك كما هي: بدون تفريغ خلفية وبدون تعديل. اكتب اسم المنتج والسعر فقط إن أردت، ثم اضغط زر النص.</p>

      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-black text-foreground">اسم المنتج</span>
          <input type="text" value={details.productName} onChange={event => onChange({ productName: event.target.value })} placeholder="مثال: فستان سهرة أحمر" className="w-full rounded-xl border border-[#e8e4ed] bg-white px-4 py-3 text-sm font-bold text-foreground outline-none focus:border-primary" />
        </label>
        <div className="flex gap-3">
          <label className="block flex-1">
            <span className="mb-1 block text-xs font-black text-foreground">السعر (اختياري)</span>
            <input type="text" inputMode="numeric" value={details.price} onChange={event => onChange({ price: event.target.value })} placeholder="5000" className="w-full rounded-xl border border-[#e8e4ed] bg-white px-4 py-3 text-sm font-bold text-foreground outline-none focus:border-primary" />
          </label>
          <label className="block w-28">
            <span className="mb-1 block text-xs font-black text-foreground">العملة</span>
            <input type="text" value={details.currency} onChange={event => onChange({ currency: event.target.value })} placeholder="ريال" className="w-full rounded-xl border border-[#e8e4ed] bg-white px-4 py-3 text-sm font-bold text-foreground outline-none focus:border-primary" />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-black text-foreground">رقم واتساب المتجر (اختياري)</span>
          <input type="tel" inputMode="tel" dir="ltr" value={details.storePhone} onChange={event => onChange({ storePhone: event.target.value })} placeholder="77xxxxxxx" className="w-full rounded-xl border border-[#e8e4ed] bg-white px-4 py-3 text-left text-sm font-bold text-foreground outline-none focus:border-primary" />
        </label>
      </div>

      <button type="button" disabled={isGenerating} onClick={() => onGenerate(variant)} className="reference-primary w-full">
        {isGenerating ? <LoaderCircle className="animate-spin" size={20} /> : <Sparkles size={20} />}
        {isGenerating ? 'جارٍ تحسين النص…' : hasText ? 'حسّن النص مرة أخرى' : 'اكتب لي النص الآن'}
      </button>

      {hasText && (
        <div className="space-y-3">
          <textarea value={details.marketingText} onChange={event => onChange({ marketingText: event.target.value })} rows={7} className="w-full rounded-2xl border border-[#e8e4ed] bg-white p-4 text-sm font-bold leading-7 text-foreground outline-none focus:border-primary" aria-label="النص التسويقي" />
          <p className="text-center text-[11px] font-bold text-muted-foreground">{details.marketingTextEngine === 'cloud' ? 'نص محسّن بأفضل نموذج متاح — عدّله بحرية' : 'نص فوري من مولد الهاتف — عدّله بحرية'}</p>
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={onCopy} className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-2xl bg-primary px-2 text-sm font-black text-primary-foreground transition active:scale-[.98]"><Copy size={17} />نسخ</button>
            <button type="button" onClick={onShareWhatsApp} className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-2xl bg-emerald-600 px-2 text-sm font-black text-white transition active:scale-[.98]"><Send size={17} />واتساب</button>
            <button type="button" disabled={isGenerating} onClick={() => { const next = variant + 1; setVariant(next); onGenerate(next); }} className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-2xl border border-primary/20 bg-white px-2 text-sm font-black text-primary transition active:scale-[.98] disabled:opacity-50"><RefreshCw size={17} />صيغة أخرى</button>
          </div>
        </div>
      )}

      <button type="button" onClick={onSwitchToFull} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[#e8e4ed] bg-white px-4 text-xs font-black text-muted-foreground transition active:scale-[.98]">
        <Wand2 size={16} />أريد تصميم الإعلان كاملاً (تفريغ الخلفية)
      </button>
    </div>
  );
}
