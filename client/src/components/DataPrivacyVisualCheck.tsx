import React from 'react';
import { DEFAULT_TEMPLATE_SETTINGS } from '@shared/types';
import UserTemplateSettings from './UserTemplateSettings';

/**
 * معاينة تطويرية لبطاقة «بيانات الجهاز والمسح» داخل الإعدادات.
 * تُفتح من ?data-privacy-check أثناء التطوير فقط.
 */
export default function DataPrivacyVisualCheck() {
  return (
    <div dir="rtl" className="min-h-screen bg-background p-4">
      <UserTemplateSettings
        settings={DEFAULT_TEMPLATE_SETTINGS}
        onChange={() => undefined}
        onBack={() => undefined}
        onAbout={() => undefined}
      />
    </div>
  );
}
