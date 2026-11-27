// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AdDetails } from '../shared/types';

import QuickMarketingCopyPanel from '../client/src/components/QuickMarketingCopyPanel';

function buildDetails(patch: Partial<AdDetails> = {}): AdDetails {
  return {
    productName: '', headline: '', discount: '', quantity: '', colors: [], price: '', currency: 'ريال',
    features: [], storeName: '', storePhone: '', marketingText: '', ...patch,
  };
}

function renderPanel(details: AdDetails, overrides: Record<string, unknown> = {}) {
  const props = {
    details,
    onChange: vi.fn(),
    onGenerate: vi.fn(),
    isGenerating: false,
    onCopy: vi.fn(),
    onShareWhatsApp: vi.fn(),
    onSwitchToFull: vi.fn(),
    ...overrides,
  };
  render(<QuickMarketingCopyPanel {...(props as Parameters<typeof QuickMarketingCopyPanel>[0])} />);
  return props;
}

describe('لوحة النص التسويقي السريع (مسار صورتي جاهزة)', () => {
  afterEach(cleanup);

  it('يعرض الحقول البسيطة وزر التوليد', () => {
    renderPanel(buildDetails());
    expect(screen.getByPlaceholderText('مثال: فستان سهرة أحمر')).toBeTruthy();
    expect(screen.getByText('اكتب لي النص الآن')).toBeTruthy();
    expect(screen.getByText(/أريد تصميم الإعلان كاملاً/)).toBeTruthy();
  });

  it('زر التوليد يستدعي onGenerate بالصيغة الأولى', () => {
    const props = renderPanel(buildDetails({ productName: 'عباية' }));
    fireEvent.click(screen.getByText('اكتب لي النص الآن'));
    expect(props.onGenerate).toHaveBeenCalledWith(1);
  });

  it('تحرير الحقول يمرر التغييرات', () => {
    const props = renderPanel(buildDetails());
    fireEvent.change(screen.getByPlaceholderText('مثال: فستان سهرة أحمر'), { target: { value: 'فستان' } });
    expect(props.onChange).toHaveBeenCalledWith({ productName: 'فستان' });
  });

  it('بعد وجود نص تظهر أزرار النسخ والواتساب وصيغة أخرى', () => {
    const props = renderPanel(buildDetails({ productName: 'عباية', marketingText: 'نص جاهز للنشر', marketingTextEngine: 'local' }));
    fireEvent.click(screen.getByText('نسخ'));
    expect(props.onCopy).toHaveBeenCalled();
    fireEvent.click(screen.getByText('واتساب'));
    expect(props.onShareWhatsApp).toHaveBeenCalled();
    fireEvent.click(screen.getByText('صيغة أخرى'));
    expect(props.onGenerate).toHaveBeenCalledWith(2);
  });

  it('زر التصميم الكامل يعيد للمسار الأصلي', () => {
    const props = renderPanel(buildDetails());
    fireEvent.click(screen.getByText(/أريد تصميم الإعلان كاملاً/));
    expect(props.onSwitchToFull).toHaveBeenCalled();
  });

  it('أثناء التوليد يظهر التحميل ويتعطل الزر', () => {
    renderPanel(buildDetails(), { isGenerating: true });
    const button = screen.getByText('جارٍ تحسين النص…').closest('button');
    expect(button?.disabled).toBe(true);
  });
});
