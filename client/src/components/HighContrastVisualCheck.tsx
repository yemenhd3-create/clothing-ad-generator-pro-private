import { Contrast } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { applyHighContrast, loadHighContrast } from '@/lib/highContrast';

/**
 * معاينة تطويرية لوضع التباين المرتفع: نموذج نصوص خافتة وحدود قبل وبعد التفعيل.
 * تُفتح من ?high-contrast-check أثناء التطوير فقط.
 */
export default function HighContrastVisualCheck() {
  const [enabled, setEnabled] = useState(loadHighContrast);
  useEffect(() => () => applyHighContrast(false), []);
  return (
    <div dir="rtl" className="min-h-screen bg-background p-4">
      <p className="mb-3 rounded-xl bg-white p-3 text-sm font-bold text-stone-700 shadow-sm">معاينة وضع التباين المرتفع (وضع تطويري).</p>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => { const next = !enabled; applyHighContrast(next); setEnabled(next); }}
        className={`mb-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black transition active:scale-95 ${enabled ? 'bg-primary text-primary-foreground' : 'bg-secondary text-primary'}`}
      >
        <Contrast size={18} />{enabled ? 'التباين المرتفع مفعّل — اضغط للإيقاف' : 'التباين العادي — اضغط للتفعيل'}
      </button>
      <div className="rounded-[28px] border bg-card p-5 shadow-sm">
        <h3 className="font-black text-primary">بيانات الإعلان</h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">يكفي اسم المنتج والسعر إن وجدا. أضف تفاصيل أكثر فقط إذا احتجت.</p>
        <div className="mt-4 rounded-2xl border border-[#e9e5ef] bg-white p-3">
          <span className="text-xs font-bold text-primary">الصورة جاهزة</span>
          <p className="mt-1 text-[11px] text-muted-foreground">سيجهّز التطبيق الخلفية والنص تلقائياً على الهاتف.</p>
        </div>
        <button type="button" className="mt-4 min-h-11 w-full rounded-2xl border border-primary/20 bg-white text-sm font-black text-primary">متابعة</button>
      </div>
    </div>
  );
}
