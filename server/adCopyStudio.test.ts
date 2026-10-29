import { describe, it, expect } from 'vitest';
import { buildFallbackAdCopy, createAdCopyLayers, type AdCopyInput } from '../shared/adCopyStudio';

describe('adCopyStudio - محرك نصوص القالب الذكية', () => {
  it('يولد نصوصاً إعلانية متوازنة ويمنع لاحقة سعودي في السعر', () => {
    const input: AdCopyInput = {
      productName: 'فستان تركي أنيق',
      price: '4000',
      currency: 'ريال',
      storeLocation: 'التربة الشارع العام',
      storePhone: '770976559',
      discount: '30',
      quantity: '20',
      colors: ['أحمر', 'أسود'],
      cta: 'اطلب الآن عبر واتساب',
      productContext: 'خامة شتوية مميزة',
      selectedFields: ['productTitle', 'price', 'discount', 'cta'],
    };

    const suggestion = buildFallbackAdCopy(input);
    expect(suggestion.productTitle).toBe('فستان تركي أنيق');
    expect(suggestion.priceText).toBe('4000 ريال');
    expect(suggestion.priceText).not.toContain('سعودي');
    expect(suggestion.discountText).toBe('خصم 30%');

    const layers = createAdCopyLayers(suggestion, input.selectedFields);
    expect(layers.length).toBe(4);
    expect(layers.map(l => l.id)).toEqual(['productTitle', 'price', 'discount', 'cta']);
    expect(layers[0].visible).toBe(true);
    expect(layers[0].text).toBe('فستان تركي أنيق');
  });
});
