import React, { useState } from 'react';
import ConfirmDestructiveModal from './ConfirmDestructiveModal';

/**
 * معاينة تطويرية لمفتاح بوابة الدخول ونافذة تأكيد إيقافها.
 * تُفتح من ?login-gate-toggle-check أثناء التطوير فقط.
 */
export default function LoginGateToggleVisualCheck() {
  const [required, setRequired] = useState(true);
  const [confirming, setConfirming] = useState(false);
  return (
    <div dir="rtl" className="min-h-screen bg-stone-100 p-4">
      <p className="mb-3 rounded-xl bg-white p-3 text-sm font-bold text-stone-700 shadow-sm">
        معاينة مفتاح بوابة الدخول في لوحة المطور (وضع تطويري).
      </p>
      <section className="rounded-[28px] bg-white p-5 shadow-[0_12px_30px_rgba(37,35,95,0.06)] sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-black text-primary">بوابة الدخول</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">عند الإيقاف يدخل أي شخص لديه رابط التطبيق مباشرة دون رمز وصول، وعند التشغيل تظهر صفحة الدخول وتطلب الرمز.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={required}
            onClick={() => { if (required) { setConfirming(true); } else { setRequired(true); } }}
            className={`shrink-0 rounded-xl px-4 py-3 text-sm font-black transition active:scale-95 ${required ? 'bg-primary text-primary-foreground' : 'bg-amber-50 text-amber-900'}`}
          >
            {required ? 'مفعّلة' : 'متوقفة'}
          </button>
        </div>
      </section>
      <ConfirmDestructiveModal
        isOpen={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => { setRequired(false); setConfirming(false); }}
        title="إيقاف بوابة الدخول"
        description="سيستطيع أي شخص لديه رابط التطبيق الدخول واستخدامه مباشرة دون رمز وصول، بما فيهم من لا تعرفه. هل أنت متأكد؟"
        confirmLabel="إيقاف البوابة"
      />
    </div>
  );
}
