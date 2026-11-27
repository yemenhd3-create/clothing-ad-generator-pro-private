// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AdDetails } from '../shared/types';

import WardrobeMarketingTextTool from '../client/src/components/WardrobeMarketingTextTool';

function buildDetails(patch: Partial<AdDetails> = {}): AdDetails {
  return {
    productName: '', headline: '', discount: '', quantity: '', colors: [], price: '', currency: 'ريال',
    features: [], storeName: '', storePhone: '', marketingText: '', ...patch,
  };
}

function renderTool(overrides: Record<string, unknown> = {}) {
  const props = {
    details: buildDetails(),
    disabled: false,
    isGenerating: false,
    onChange: vi.fn(),
    onGenerate: vi.fn().mockResolvedValue({ text: 'نص', source: 'local-fallback', message: 'تم' }),
    ...overrides,
  };
  render(<WardrobeMarketingTextTool {...(props as Parameters<typeof WardrobeMarketingTextTool>[0])} />);
  return props;
}

describe('أداة النص التسويقي — الوضعان المختصر والمفصّل', () => {
  afterEach(cleanup);

  it('الوضع المختصر افتراضياً: اسم القطعة والسعر وزر جهّز النص فقط', () => {
    renderTool();
    expect(screen.getByLabelText('اسم القطعة للنص التسويقي')).toBeTruthy();
    expect(screen.getByLabelText('السعر للنص التسويقي')).toBeTruthy();
    expect(screen.getByText('جهّز النص')).toBeTruthy();
    expect(screen.queryByText('الحملة:')).toBeNull();
    expect(screen.queryByText('طول النص:')).toBeNull();
    expect(screen.queryByText('التنسيق:')).toBeNull();
    expect(screen.queryByLabelText('تعليمات إضافية للنص التسويقي')).toBeNull();
    expect(screen.queryByLabelText('الكمية المتاحة')).toBeNull();
  });

  it('زر خيارات يفتح الوضع المفصّل بكل الخيارات', () => {
    renderTool();
    fireEvent.click(screen.getByText('خيارات'));
    expect(screen.getByText('الحملة:')).toBeTruthy();
    expect(screen.getByText('طول النص:')).toBeTruthy();
    expect(screen.getByText('التنسيق:')).toBeTruthy();
    expect(screen.getByLabelText('تعليمات إضافية للنص التسويقي')).toBeTruthy();
    expect(screen.getByLabelText('الكمية المتاحة')).toBeTruthy();
    expect(screen.getByLabelText('الخصم')).toBeTruthy();
    expect(screen.getByLabelText('رقم التوصيل وواتساب')).toBeTruthy();
  });

  it('الضغط مجدداً يخفي الخيارات ويعيد المختصر', () => {
    renderTool();
    fireEvent.click(screen.getByText('خيارات'));
    fireEvent.click(screen.getByText('إخفاء الخيارات'));
    expect(screen.queryByText('الحملة:')).toBeNull();
    expect(screen.getByText('جهّز النص')).toBeTruthy();
  });

  it('تحرير السعر في الوضع المختصر يمرر القيمة', () => {
    const props = renderTool();
    fireEvent.change(screen.getByLabelText('السعر للنص التسويقي'), { target: { value: '3000' } });
    expect(props.onChange).toHaveBeenCalledWith({ price: '3000', currency: 'ريال' });
  });

  it('جهّز النص يستدعي onGenerate بالتفضيلات', async () => {
    const props = renderTool();
    fireEvent.click(screen.getByText('جهّز النص'));
    await Promise.resolve();
    expect(props.onGenerate).toHaveBeenCalled();
  });
});
