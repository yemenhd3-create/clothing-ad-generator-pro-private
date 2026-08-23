import { describe, expect, it } from 'vitest';
import { getWardrobeOverlayHelp } from '../client/src/lib/wardrobeOverlayHelp';

describe('Wardrobe title guidance', () => {
  it('يعرض مثالاً واضحاً لعنوان الصورة', () => {
    expect(getWardrobeOverlayHelp('caption')).toEqual({
      placeholder: 'مثال: متوفر لدى مركز أحمد للتخفيضات',
      hint: 'اكتب جملة قصيرة تظهر أعلى الصورة.',
    });
  });

  it('يعرض مثال السعر بصيغة الرقم ثم ريال', () => {
    expect(getWardrobeOverlayHelp('price')).toEqual({
      placeholder: 'مثال: 5000 ريال',
      hint: 'اكتب الرقم ثم كلمة ريال؛ سيظهر السعر أسفل الصورة.',
    });
  });
});
