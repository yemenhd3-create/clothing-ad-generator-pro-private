import React, { useState } from 'react';
import ConfirmDestructiveModal from './ConfirmDestructiveModal';

/**
 * معاينة تطويرية لنافذة تأكيد الإجراءات الحساسة في لوحة المطور.
 * تُفتح من ?developer-confirm-check أثناء التطوير فقط.
 */
export default function DeveloperConfirmVisualCheck() {
  const [open, setOpen] = useState(true);
  return (
    <div dir="rtl" className="min-h-screen bg-stone-100 p-4">
      <p className="mb-3 rounded-xl bg-white p-3 text-sm font-bold text-stone-700 shadow-sm">
        معاينة نافذة تأكيد الحذف في لوحة المطور (وضع تطويري).
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-11 rounded-xl bg-red-50 px-4 text-sm font-black text-red-700"
      >
        فتح نافذة التأكيد
      </button>
      <ConfirmDestructiveModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onConfirm={() => setOpen(false)}
        title="حذف المزود"
        description="سيُحذف المزود «مزود تجريبي» ومفتاحه المحفوظ نهائياً ولا يمكن التراجع. هل أنت متأكد؟"
        confirmLabel="حذف نهائي"
      />
    </div>
  );
}
