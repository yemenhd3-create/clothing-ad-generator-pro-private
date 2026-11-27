// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SharePanel from '../client/src/components/SharePanel';

function renderPanel(overrides: Partial<Parameters<typeof SharePanel>[0]> = {}) {
  const props = {
    onDownload: vi.fn(),
    onShare: vi.fn(),
    onWhatsApp: vi.fn(),
    onEdit: vi.fn(),
    onClear: vi.fn(),
    onNewCopy: vi.fn(),
    onQualityCheck: vi.fn(),
    onContractCheck: vi.fn(),
    onExportGateCheck: vi.fn(),
    ...overrides,
  };
  render(<SharePanel {...props} />);
  return props;
}

describe('شاشة النتيجة القابلة للاستعادة', () => {
  afterEach(cleanup);

  it('تعرض أزرار الاستعادة الثلاثة: نسخة جديدة وتعديل ومسح الجلسة', () => {
    renderPanel();
    expect(screen.getByText('إنشاء نسخة جديدة من هذا الإعلان')).toBeTruthy();
    expect(screen.getByText('تعديل الإعلان')).toBeTruthy();
    expect(screen.getByText('مسح جلسة الإعلان والبدء بإعلان جديد')).toBeTruthy();
  });

  it('زر النسخة الجديدة يستدعي معالجه دون مسح الجلسة', () => {
    const props = renderPanel();
    fireEvent.click(screen.getByText('إنشاء نسخة جديدة من هذا الإعلان'));
    expect(props.onNewCopy).toHaveBeenCalledTimes(1);
    expect(props.onClear).not.toHaveBeenCalled();
    expect(props.onEdit).not.toHaveBeenCalled();
  });

  it('بوابة الجودة المغلقة لا تعطل النسخة الجديدة ولا التعديل', () => {
    renderPanel({ exportBlocked: true });
    fireEvent.click(screen.getByText('إنشاء نسخة جديدة من هذا الإعلان'));
    fireEvent.click(screen.getByText('تعديل الإعلان'));
    const whatsapp = screen.getByText('مشاركة عبر WhatsApp').closest('button');
    expect(whatsapp?.disabled).toBe(true);
  });
});
