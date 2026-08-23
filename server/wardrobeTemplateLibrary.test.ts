import { describe, expect, it } from 'vitest';
import { WARDROBE_TEMPLATE_OPTIONS } from '../client/src/pages/Home';

describe('مكتبة قوالب غرفة الملابس', () => {
  it('تقدم عشرين قالباً محلياً بعينات ملونة وفئات يدوية واضحة', () => {
    expect(WARDROBE_TEMPLATE_OPTIONS).toHaveLength(20);
    expect(new Set(WARDROBE_TEMPLATE_OPTIONS.map(item => item.id)).size).toBe(20);
    expect(new Set(WARDROBE_TEMPLATE_OPTIONS.map(item => item.category))).toEqual(new Set(['أساسي', 'نسائي', 'بناتي', 'رجالي', 'ولادي', 'مواليد', 'شبابي']));
    expect(WARDROBE_TEMPLATE_OPTIONS.every(item => item.colors.length === 2 && item.colors.every(color => color.startsWith('#')))).toBe(true);
  });
});
