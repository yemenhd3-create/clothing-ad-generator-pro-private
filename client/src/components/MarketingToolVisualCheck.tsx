import React, { useState } from 'react';
import type { AdDetails } from '@shared/types';
import WardrobeMarketingTextTool from './WardrobeMarketingTextTool';

const sampleDetails: AdDetails = {
  productName: 'طقم بناتي سلا', headline: '', discount: '', quantity: '30', colors: [], price: '3000', currency: 'ريال',
  features: [], storeName: '', storePhone: '', marketingText: '',
};

/**
 * معاينة تطويرية لأداة النص التسويقي بوضعيها المختصر والمفصّل.
 * تُفتح من ?marketing-tool-check أثناء التطوير فقط.
 */
export default function MarketingToolVisualCheck() {
  const [details, setDetails] = useState(sampleDetails);
  return (
    <div dir="rtl" className="min-h-screen bg-stone-100 p-4">
      <p className="mb-3 rounded-xl bg-white p-3 text-sm font-bold text-stone-700 shadow-sm">معاينة أداة النص التسويقي بوضعيها (وضع تطويري).</p>
      <div className="rounded-2xl bg-white p-3 shadow-sm">
        <WardrobeMarketingTextTool
          details={details}
          disabled={false}
          isGenerating={false}
          onChange={patch => setDetails(current => ({ ...current, ...patch }))}
          onGenerate={async () => ({ text: 'نص', source: 'local-fallback', message: 'تم تجهيز النص محلياً.' })}
        />
      </div>
    </div>
  );
}
