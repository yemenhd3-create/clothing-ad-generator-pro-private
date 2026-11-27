import { PenLine, Sparkles } from 'lucide-react';
import React, { useState } from 'react';
import type { AdDetails } from '@shared/types';
import QuickMarketingCopyPanel from './QuickMarketingCopyPanel';

const sampleDetails: AdDetails = {
  productName: 'فستان سهرة أحمر', headline: '', discount: '', quantity: '', colors: [], price: '8500', currency: 'ريال',
  features: [], storeName: '', storePhone: '777123456',
  marketingText: 'فستان سهرة أحمر يلفت الأنظار ✨\nقطعة مختارة بعناية لإطلالة لا تُنسى.\n\nالسعر: 8500 ريال فقط\nللطلب والاستفسار واتساب: 777123456',
  marketingTextEngine: 'local',
};

/**
 * معاينة تطويرية لمسار «صورتي جاهزة»: لوحة النص السريع وزرا الاختيار بعد الرفع.
 * تُفتح من ?quick-copy-check (اللوحة) أو ?quick-copy-check=choice (زرا الاختيار) أثناء التطوير فقط.
 */
export default function QuickCopyVisualCheck() {
  const mode = new URLSearchParams(window.location.search).get('quick-copy-check');
  const [details, setDetails] = useState(sampleDetails);
  if (mode === 'choice') {
    return (
      <div dir="rtl" className="min-h-screen bg-stone-100 p-4">
        <p className="mb-3 rounded-xl bg-white p-3 text-sm font-bold text-stone-700 shadow-sm">معاينة زري الاختيار بعد رفع الصورة (وضع تطويري).</p>
        <div className="space-y-5">
          <button type="button" className="reference-primary w-full"><Sparkles size={20} />إنشاء صورة الاستديو</button>
          <button type="button" className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-white px-4 text-sm font-black text-primary transition active:scale-[.98]"><PenLine size={18} />صورتي جاهزة — أريد نصاً تسويقياً فقط</button>
        </div>
      </div>
    );
  }
  return (
    <div dir="rtl" className="min-h-screen bg-stone-100 p-4">
      <p className="mb-3 rounded-xl bg-white p-3 text-sm font-bold text-stone-700 shadow-sm">معاينة لوحة النص التسويقي السريع (وضع تطويري).</p>
      <div className="reference-card p-5">
        <QuickMarketingCopyPanel
          details={details}
          onChange={patch => setDetails(current => ({ ...current, ...patch }))}
          onGenerate={() => undefined}
          isGenerating={false}
          onCopy={() => undefined}
          onShareWhatsApp={() => undefined}
          onSwitchToFull={() => undefined}
        />
      </div>
    </div>
  );
}
