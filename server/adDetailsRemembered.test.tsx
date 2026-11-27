// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AdDetails } from '../shared/types';
import AdDetailsForm from '../client/src/components/AdDetailsForm';

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

function seedRemembered() {
  localStorage.setItem(
    'clothing_ad_remembered_inputs_v1',
    JSON.stringify({ productName: ['فستان بناتي'], price: ['5000'], discount: ['20'] }),
  );
}

describe('اقتراح آخر المدخلات في نموذج بيانات الإعلان', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('تظهر الرقائق عندما يكون الحقل فارغاً فقط', () => {
    seedRemembered();
    render(<AdDetailsForm details={emptyDetails()} onChange={() => undefined} />);
    expect(screen.getByTestId('remembered-productName')).toBeTruthy();
    expect(screen.getByText('فستان بناتي')).toBeTruthy();
    expect(screen.getByText('5000')).toBeTruthy();
    expect(screen.getByText('20')).toBeTruthy();
  });

  it('الضغط على الرقاقة يملأ الحقل', () => {
    seedRemembered();
    const onChange = vi.fn();
    render(<AdDetailsForm details={emptyDetails()} onChange={onChange} />);
    fireEvent.click(screen.getByText('فستان بناتي'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ productName: 'فستان بناتي' }));
  });

  it('تختفي الرقائق عندما يكون للحقل قيمة', () => {
    seedRemembered();
    render(<AdDetailsForm details={{ ...emptyDetails(), productName: 'قيمة حالية' }} onChange={() => undefined} />);
    expect(screen.queryByTestId('remembered-productName')).toBeNull();
  });

  it('بلا سجل سابق لا تظهر رقائق', () => {
    render(<AdDetailsForm details={emptyDetails()} onChange={() => undefined} />);
    expect(screen.queryByTestId('remembered-productName')).toBeNull();
  });

  it('تعبئة الحقل والخروج منه تحفظ القيمة للمرة القادمة', () => {
    const onChange = vi.fn();
    render(<AdDetailsForm details={{ ...emptyDetails(), price: '8000' }} onChange={onChange} />);
    const priceInput = screen.getByPlaceholderText('5000');
    fireEvent.blur(priceInput);
    const stored = JSON.parse(localStorage.getItem('clothing_ad_remembered_inputs_v1') ?? '{}');
    expect(stored.price).toEqual(['8000']);
  });
});
