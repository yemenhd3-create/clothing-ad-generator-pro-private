import { describe, expect, it } from 'vitest';
import { ensureAndroidSafeEmoji, generateLocalMarketingText } from '../shared/marketingText';
import type { AdDetails } from '../shared/types';

describe('تنقية الرموز التعبيرية لأندرويد', () => {
  it('يبقي الرموز الآمنة الشائعة', () => {
    expect(ensureAndroidSafeEmoji('عرض خاص ✨ بسعر 🔥 مميز')).toBe('عرض خاص ✨ بسعر 🔥 مميز');
  });

  it('يزيل الرموز الحديثة التي قد تظهر كمربع فارغ', () => {
    expect(ensureAndroidSafeEmoji('فستان 🩷 جميل 🫶 جداً 🪩')).toBe('فستان جميل جداً');
  });

  it('يزيل أوصال التسلسلات المركبة بعد الحذف', () => {
    const result = ensureAndroidSafeEmoji('مهنة 👩‍💻 ممتازة');
    expect(result).not.toContain('\u200D');
  });

  it('لا يترك مسافات مضاعفة بعد الحذف', () => {
    expect(ensureAndroidSafeEmoji('أهلاً  🩷  بك')).toBe('أهلاً بك');
  });

  it('نص المولد المحلي لا يحتوي رموزاً خارج القائمة الآمنة', () => {
    const details: AdDetails = {
      productName: 'فستان', headline: '', discount: '20', quantity: '', colors: [], price: '5000', currency: 'ريال',
      features: [], storeName: 'متجر النور', storePhone: '777123456', marketingText: '',
    };
    const campaigns = ['professional', 'passion', 'persuasive', 'new-arrival', 'eid-fitr', 'eid-adha', 'festival', 'women'] as const;
    const lengths = ['concise', 'short', 'medium', 'long'] as const;
    for (const campaign of campaigns) {
      for (const length of lengths) {
        const result = generateLocalMarketingText(details, {
          tone: 'exciting', length, goal: 'purchase', format: 'whatsapp', campaign, emphasis: 'featured',
        }, 1);
        for (const char of result.text) {
          const cp = char.codePointAt(0) || 0;
          const isEmoji = (cp >= 0x1F000 && cp <= 0x1FAFF) || (cp >= 0x2600 && cp <= 0x27BF) || (cp >= 0x2B00 && cp <= 0x2BFF);
          if (isEmoji) {
            expect(ensureAndroidSafeEmoji(char), `رمز غير آمن «${char}» في حملة ${campaign} بطول ${length}`).toBe(char);
          }
        }
      }
    }
  });
});
