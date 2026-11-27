import type { AdDetails } from '@shared/types';
import React, { useEffect, useState } from 'react';
import AdDetailsForm from './AdDetailsForm';
import StepHelpHint from './StepHelpHint';

const emptyDetails = (): AdDetails => ({
  productName: '',
  headline: '',
  discount: '',
  quantity: '',
  colors: [],
  price: '',
  currency: 'ريال',
  features: [],
  storeName: '',
  storePhone: '',
  marketingText: '',
});

/**
 * معاينة تطويرية لنموذج بيانات الإعلان مع رقائق «آخر ما استخدمت».
 * تزرع قيماً محفوظة محلياً ثم تعرض النموذج. تُفتح من ?ad-details-form-check أثناء التطوير فقط.
 */
export default function AdDetailsFormVisualCheck() {
  const [details, setDetails] = useState<AdDetails>(emptyDetails);

  useEffect(() => {
    try {
      localStorage.setItem(
        'clothing_ad_remembered_inputs_v1',
        JSON.stringify({ productName: ['فستان بناتي', 'عباية سوداء'], price: ['5000'], discount: ['20'] }),
      );
      setDetails(emptyDetails());
    } catch {
      // التخزين غير متاح: تبقى المعاينة بلا رقائق.
    }
  }, []);

  return (
    <div dir="rtl" className="min-h-screen bg-stone-100 p-4">
      <p className="mb-3 rounded-xl bg-white p-3 text-sm font-bold text-stone-700 shadow-sm">
        معاينة رقائق آخر المدخلات في نموذج بيانات الإعلان (وضع تطويري).
      </p>
      <StepHelpHint step="details" />
      <div className="rounded-[24px] bg-white p-4 shadow-sm">
        <AdDetailsForm details={details} onChange={setDetails} />
      </div>
    </div>
  );
}
