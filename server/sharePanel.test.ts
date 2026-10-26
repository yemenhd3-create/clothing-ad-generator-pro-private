import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import SharePanel from '../client/src/components/SharePanel';

describe('final advertisement share panel', () => {
  it('presents download, quality check, native share, WhatsApp, and edit actions', () => {
    const action = vi.fn();
    const html = renderToStaticMarkup(createElement(SharePanel, { onDownload: action, onShare: action, onWhatsApp: action, onQualityCheck: action, onContractCheck: action, onExportGateCheck: action, onEdit: action, onClear: action }));

    expect(html).toContain('حفظ في الهاتف');
    expect(html).toContain('فحص جودة الإعلان');
    expect(html).toContain('فحص عقد التصميم');
    expect(html).toContain('فحص صلاحية التصدير');
    expect(html).toContain('مشاركة أخرى');
    expect(html).toContain('WhatsApp');
    expect(html).toContain('تعديل');
    expect(html).toContain('مسح جلسة الإعلان');
  });

  it('disables the quality action while the local inspection is running', () => {
    const action = vi.fn();
    const html = renderToStaticMarkup(createElement(SharePanel, { onDownload: action, onShare: action, onWhatsApp: action, onQualityCheck: action, onContractCheck: action, onExportGateCheck: action, onEdit: action, onClear: action, isQualityChecking: true }));

    expect(html).toContain('جارٍ فحص الإعلان محلياً');
    expect(html).toMatch(/disabled=""/);
  });

  it('disables the contract action while the local contract inspection is running', () => {
    const action = vi.fn();
    const html = renderToStaticMarkup(createElement(SharePanel, { onDownload: action, onShare: action, onWhatsApp: action, onQualityCheck: action, onContractCheck: action, onExportGateCheck: action, onEdit: action, onClear: action, isContractChecking: true }));

    expect(html).toContain('جارٍ فحص عقد التصميم');
    expect(html).toMatch(/disabled=""/);
  });

  it('يعطل الحفظ والمشاركة فقط عندما تعلن بوابة الجودة عن خطأ هندسي حرج', () => {
    const action = vi.fn();
    const html = renderToStaticMarkup(createElement(SharePanel, { onDownload: action, onShare: action, onWhatsApp: action, onQualityCheck: action, onContractCheck: action, onExportGateCheck: action, onEdit: action, onClear: action, exportBlocked: true }));

    expect(html).toContain('أوقفت بوابة الجودة الحفظ والمشاركة');
    expect((html.match(/disabled=""/g) || [])).toHaveLength(3);
  });
});
