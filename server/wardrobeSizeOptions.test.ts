import { describe, expect, it } from 'vitest';
import { getCanvasDimensions } from '../shared/adWorkflow';
import { WARDROBE_SIZE_OPTIONS } from '../client/src/pages/Home';

describe('مقاسات غرفة الملابس', () => {
  it('تعرض كل مقاس مدعوم مرة واحدة فقط داخل شريط المقاسات', () => {
    expect(WARDROBE_SIZE_OPTIONS.map(option => option.id)).toEqual(['portrait', 'square', 'story', 'whatsapp', 'landscape']);
    expect(new Set(WARDROBE_SIZE_OPTIONS.map(option => option.ratio)).size).toBe(WARDROBE_SIZE_OPTIONS.length);
  });

  it('ترتبط كل نسبة في الشريط بأبعاد تصدير صالحة في محرك القالب', () => {
    for (const option of WARDROBE_SIZE_OPTIONS) {
      const dimensions = getCanvasDimensions(option.id);
      expect(dimensions.width).toBeGreaterThan(0);
      expect(dimensions.height).toBeGreaterThan(0);
    }
  });
});
