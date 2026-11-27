import { describe, expect, it } from 'vitest';
import { getRememberedInputs, rememberInputValue, REMEMBERED_INPUTS_LIMIT } from '../client/src/lib/rememberedInputs';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    dump: () => Object.fromEntries(data),
  };
}

describe('تذكر آخر مدخلات الإعلان', () => {
  it('يحفظ القيمة ويعيدها', () => {
    const storage = memoryStorage();
    rememberInputValue('productName', 'فستان بناتي', storage);
    expect(getRememberedInputs('productName', storage)).toEqual(['فستان بناتي']);
  });

  it('يتجاهل القيم الفارغة', () => {
    const storage = memoryStorage();
    rememberInputValue('price', '   ', storage);
    expect(getRememberedInputs('price', storage)).toEqual([]);
  });

  it('الأحدث أولاً دون تكرار', () => {
    const storage = memoryStorage();
    rememberInputValue('price', '5000', storage);
    rememberInputValue('price', '7000', storage);
    rememberInputValue('price', '5000', storage);
    expect(getRememberedInputs('price', storage)).toEqual(['5000', '7000']);
  });

  it('يحتفظ بخمس قيم كحد أقصى', () => {
    const storage = memoryStorage();
    for (let i = 1; i <= REMEMBERED_INPUTS_LIMIT + 3; i += 1) rememberInputValue('discount', String(i * 5), storage);
    expect(getRememberedInputs('discount', storage)).toEqual(['40', '35', '30', '25', '20']);
  });

  it('يفصل الحقول عن بعضها', () => {
    const storage = memoryStorage();
    rememberInputValue('productName', 'عباية', storage);
    rememberInputValue('price', '9000', storage);
    expect(getRememberedInputs('productName', storage)).toEqual(['عباية']);
    expect(getRememberedInputs('discount', storage)).toEqual([]);
  });

  it('يتحمل بيانات تالفة في التخزين', () => {
    const storage = memoryStorage({ clothing_ad_remembered_inputs_v1: 'not-json' });
    expect(getRememberedInputs('productName', storage)).toEqual([]);
  });

  it('يعمل بدون تخزين متاح', () => {
    expect(getRememberedInputs('price', null)).toEqual([]);
    rememberInputValue('price', '100', null);
  });
});
