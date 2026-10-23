import { describe, expect, it } from 'vitest';
import { applyMerchantProfileToMarketingDetails, createMerchantProfile } from '../shared/merchantAssistant';
import { generateLocalMarketingText, buildWhatsAppSignature, buildWhatsAppUserPrompt } from '../shared/marketingText';
import { DEFAULT_AD_DETAILS } from '../shared/types';

describe('بيانات المركز المحفوظة في النص التسويقي والتخصيص الأولي', () => {
  it('تملأ بيانات المركز وتفصل بين هاتف الاستفسار وهاتف التوصيل والتصنيفات المختارة', () => {
    const profile = {
      ...createMerchantProfile(),
      storeName: 'مركز الأناقة اليمني',
      storePhone: '777111222',
      deliveryPhone: '777333444',
      storeLocation: 'صنعاء - شارع حدة',
      storeCategories: ['نسائي', 'بناتي', 'شنط'],
      defaultDiscount: '20',
      defaultColors: ['أسود', 'كحلي'],
      onboardingComplete: true,
    };

    const details = applyMerchantProfileToMarketingDetails(
      { ...DEFAULT_AD_DETAILS, productName: 'عباية مطرزة', quantity: '2' },
      profile
    );

    expect(details).toMatchObject({
      storeName: 'مركز الأناقة اليمني',
      storePhone: '777111222',
      deliveryPhone: '777333444',
      storeLocation: 'صنعاء - شارع حدة',
      storeCategories: ['نسائي', 'بناتي', 'شنط'],
      discount: '20',
      colors: ['أسود', 'كحلي'],
    });

    // فحص توقيع واتساب المفصل
    const signature = buildWhatsAppSignature(details);
    expect(signature).toContain('📞 للاستفسار: 777111222');
    expect(signature).toContain('🚚 للطلب والتوصيل: 777333444');
    expect(signature).toContain('📍 مركز الأناقة اليمني');
    expect(signature).toContain('🏢 صنعاء - شارع حدة');

    // فحص التوليد المحلي
    const localResult = generateLocalMarketingText(details);
    expect(localResult.text).toContain('مركز الأناقة اليمني');
    expect(localResult.text).toContain('777111222');

    // فحص موجه الموديل السحابي (Prompt)
    const prompt = buildWhatsAppUserPrompt(details);
    expect(prompt).toContain('مركز الأناقة اليمني');
    expect(prompt).toContain('نسائي، بناتي، شنط');
    expect(prompt).toContain('صنعاء - شارع حدة');
  });

  it('يستخدم رقماً واحداً موحداً إذا كان هاتف التوصيل والاستفسار متطابقين أو أحدهما فارغاً', () => {
    const signature = buildWhatsAppSignature({
      storeName: 'بوتيك المودة',
      storePhone: '777888999',
      deliveryPhone: '777888999',
    });
    expect(signature).toContain('📞 للطلب والاستفسار: 777888999');
    expect(signature).not.toContain('🚚 للطلب والتوصيل');
  });
});
