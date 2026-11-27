import { describe, expect, it } from 'vitest';
import { sanitizeAdDetails, sanitizeCanvasMultiline, sanitizeCanvasText, sanitizeTemplateText } from '../client/src/lib/canvasText';
import { DEFAULT_TEMPLATE_SETTINGS } from '../shared/types';
import type { AdDetails } from '../shared/types';

function detailsWith(patch: Partial<AdDetails>): AdDetails {
  return {
    productName: '', headline: '', discount: '', quantity: '', colors: [], price: '', currency: '',
    features: [], storeName: '', storePhone: '', marketingText: 'نص تسويقي يبقى كما هو', ...patch,
  };
}

describe('تنظيف نص المستخدم قبل رسمه على القماش', () => {
  it('يزيل محارف التحكم والاتجاه القادمة من اللصق', () => {
    const pasted = 'خصم‮ 50 ‬% على الفساتين‎';
    expect(sanitizeCanvasText(pasted)).toBe('خصم 50 % على الفساتين');
    expect(sanitizeCanvasText('سعر﻿ جديد؜')).toBe('سعر جديد');
  });

  it('يجمع الفراغات والأسطر في سطر واحد ويقصّ الأطراف', () => {
    expect(sanitizeCanvasText('  فستان\nسهرة\tجميل  ')).toBe('فستان سهرة جميل');
  });

  it('يسقط الأسفنجة غير المقترنة ولا يكسر الإيموجي المقترن عند القص', () => {
    expect(sanitizeCanvasText('قبعة\uD800 شتوية')).toBe('قبعة شتوية');
    const family = '👨‍👩‍👧‍👦';
    const long = `${family}${'أ'.repeat(200)}`;
    const cleaned = sanitizeCanvasText(long, 12);
    expect(cleaned.startsWith(family)).toBe(true);
    expect(Array.from(cleaned).length).toBeLessThanOrEqual(12);
    expect(() => encodeURIComponent(cleaned)).not.toThrow();
  });

  it('يحافظ على سطرين في نص الشارة ويتجاهل الأسطر الزائدة', () => {
    expect(sanitizeCanvasMultiline('خصم 50%\nلفترة محدودة\nسطر ثالث')).toBe('خصم 50%\nلفترة محدودة');
    expect(sanitizeCanvasMultiline('  عرض \n\n جديد  ')).toBe('عرض\nجديد');
  });

  it('ينظّف تفاصيل الإعلان ويبقي النص التسويقي خارج القماش كما هو', () => {
    const cleaned = sanitizeAdDetails(detailsWith({ productName: '  عباية‮ سوداء', price: '١٥٠٠٠٠٠٠٠٠٠٠٠٠٠٠٠٠٠٠٠٠ ريال إضافي طويل', features: ['قماش قطني', '', 'خياطة‫ فاخرة'], colors: ['أسود', '  '] }));
    expect(cleaned.productName).toBe('عباية سوداء');
    expect(cleaned.price.length).toBeLessThanOrEqual(24);
    expect(cleaned.features).toEqual(['قماش قطني', 'خياطة فاخرة']);
    expect(cleaned.colors).toEqual(['أسود']);
    expect(cleaned.marketingText).toBe('نص تسويقي يبقى كما هو');
  });

  it('يتعامل مع حقول غير نصية أو قوائم تالفة بلا أعطال', () => {
    expect(sanitizeCanvasText(undefined)).toBe('');
    expect(sanitizeCanvasText(42)).toBe('');
    const broken = detailsWith({ colors: 'ليس-قائمة' as unknown as string[], features: null as unknown as string[] });
    const cleaned = sanitizeAdDetails(broken);
    expect(cleaned.colors).toEqual([]);
    expect(cleaned.features).toEqual([]);
  });

  it('ينظّف نصوص القالب المرسومة: الشارة وطبقات النص ونصوص الغرفة', () => {
    const template = {
      ...DEFAULT_TEMPLATE_SETTINGS,
      badgeText: 'جديد‮ ',
      studioCaption: 'غرفة‫ الملابس',
      studioPrice: '1500 ريال',
      adCopyLayers: [
        { id: 'headline', label: '', text: 'تخفيضات‮ كبرى', visible: true, x: .5, y: .5, fontSize: 40, fontFamily: 'Cairo', color: '#000', align: 'right', weight: 800 },
      ],
    } as typeof DEFAULT_TEMPLATE_SETTINGS;
    const cleaned = sanitizeTemplateText(template);
    expect(cleaned.badgeText).toBe('جديد');
    expect(cleaned.studioCaption).toBe('غرفة الملابس');
    expect(cleaned.studioPrice).toBe('1500 ريال');
    expect(cleaned.adCopyLayers?.[0].text).toBe('تخفيضات كبرى');
  });
});
