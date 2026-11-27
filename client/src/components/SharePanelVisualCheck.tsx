import React from 'react';
import SharePanel from './SharePanel';
import StepHelpHint from './StepHelpHint';

/**
 * معاينة تطويرية لخيارات شاشة النتيجة، بما فيها زر «إنشاء نسخة جديدة».
 * تُفتح من ?share-panel-check أثناء التطوير فقط.
 */
export default function SharePanelVisualCheck() {
  const noop = () => undefined;
  return (
    <div dir="rtl" className="min-h-screen bg-stone-100 p-4">
      <p className="mb-3 rounded-xl bg-white p-3 text-sm font-bold text-stone-700 shadow-sm">
        معاينة خيارات شاشة النتيجة (وضع تطويري).
      </p>
      <StepHelpHint step="final" />
      <SharePanel
        onDownload={noop}
        onShare={noop}
        onWhatsApp={noop}
        onCopyText={noop}
        onEdit={noop}
        onClear={noop}
        onNewCopy={noop}
        onQualityCheck={noop}
        onContractCheck={noop}
        onExportGateCheck={noop}
      />
    </div>
  );
}
