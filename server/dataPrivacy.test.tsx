// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  DEVICE_DATA_CATEGORIES,
  clearAllBatchDrafts,
  clearDynamicTemplateCache,
  clearRememberedInputs,
  clearSmartMarketingMemory,
  formatBytes,
} from '../client/src/lib/dataPrivacy';

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    get length() { return map.size; },
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    removeItem: (key: string) => { map.delete(key); },
    key: (index: number) => Array.from(map.keys())[index] ?? null,
    _map: map,
  };
}

describe('formatBytes', () => {
  it('يعرض غير متاح عند غياب القيمة', () => {
    expect(formatBytes(null)).toBe('غير متاح');
    expect(formatBytes(undefined)).toBe('غير متاح');
  });

  it('ينسّق البايت والميجابايت', () => {
    expect(formatBytes(512)).toBe('512 بايت');
    expect(formatBytes(4.4 * 1024 * 1024)).toBe('4.4 ميجابايت');
    expect(formatBytes(120 * 1024 * 1024)).toBe('120 ميجابايت');
  });
});

describe('مسح فئات بيانات الجهاز', () => {
  it('يمسح اقتراحات الحقول فقط عند وجودها', () => {
    const storage = fakeStorage({ clothing_ad_remembered_inputs_v1: '{}' });
    expect(clearRememberedInputs(storage)).toBe(true);
    expect(storage.getItem('clothing_ad_remembered_inputs_v1')).toBeNull();
    expect(clearRememberedInputs(storage)).toBe(false);
  });

  it('يمسح ذاكرة النصوص التسويقية', () => {
    const storage = fakeStorage({ clogen_smart_marketing_instructions: '[]', other_key: 'keep' });
    expect(clearSmartMarketingMemory(storage)).toBe(true);
    expect(storage.getItem('clogen_smart_marketing_instructions')).toBeNull();
    expect(storage.getItem('other_key')).toBe('keep');
  });

  it('يمسح القوالب المخصصة بالبادئة فقط دون بقية المفاتيح', () => {
    const storage = fakeStorage({
      clogen_dyn_tpl_a: '1',
      clogen_dyn_tpl_b: '2',
      'clothing-high-contrast': '1',
    });
    expect(clearDynamicTemplateCache(storage)).toBe(2);
    expect(storage.getItem('clogen_dyn_tpl_a')).toBeNull();
    expect(storage.getItem('clothing-high-contrast')).toBe('1');
  });

  it('يعيد صفراً لمسودات الدفعات عند غياب قاعدة البيانات', async () => {
    expect(await clearAllBatchDrafts()).toBe(0);
  });
});

describe('الفئات المعروضة', () => {
  it('لكل فئة عنوان وشرح واضح لما سيُحذف', () => {
    for (const category of Object.values(DEVICE_DATA_CATEGORIES)) {
      expect(category.title.length).toBeGreaterThan(2);
      expect(category.description.length).toBeGreaterThan(10);
    }
  });
});
