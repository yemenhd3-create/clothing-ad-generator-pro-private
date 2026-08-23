import { describe, expect, it } from 'vitest';
import { getWardrobeShareText } from '../client/src/lib/wardrobeShare';

describe('Wardrobe sharing choices', () => {
  it('يرسل الصورة فقط من دون أي نص تسويقي', () => {
    expect(getWardrobeShareText('image', 'نص تسويقي لا ينبغي إرساله')).toBe('');
  });

  it('يرسل نص واتساب المنسق عند اختيار المشاركة مع النص', () => {
    expect(getWardrobeShareText('whatsapp', '  *فستان بناتي*  ')).toBe('*فستان بناتي*');
  });
});
