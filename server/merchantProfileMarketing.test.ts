import { describe, expect, it } from 'vitest';
import { applyMerchantProfileToMarketingDetails, createMerchantProfile } from '../shared/merchantAssistant';
import { generateLocalMarketingText } from '../shared/marketingText';
import { DEFAULT_AD_DETAILS } from '../shared/types';

describe('بيانات المركز المحفوظة في النص التسويقي', () => {
  it('تملأ بيانات المركز الافتراضية من دون استبدال أي قيمة يكتبها المستخدم للصورة الحالية', () => {
    const profile = { ...createMerchantProfile(), storeName: 'مركز السعر المناسب', storePhone: '777000000', storeLocation: 'صنعاء', storeCategory: 'نسائي وبناتي', defaultDiscount: '15', defaultColors: ['وردي'] };
    const details = applyMerchantProfileToMarketingDetails({ ...DEFAULT_AD_DETAILS, productName: 'فستان', quantity: '3' }, profile);
    expect(details).toMatchObject({ storeName: 'مركز السعر المناسب', storePhone: '777000000', storeLocation: 'صنعاء', storeCategory: 'نسائي وبناتي', discount: '15', colors: ['وردي'] });
    expect(generateLocalMarketingText(details).text).toContain('مركز السعر المناسب');
    expect(applyMerchantProfileToMarketingDetails({ ...details, storeName: 'اسم خاص للصورة' }, profile).storeName).toBe('اسم خاص للصورة');
  });
});
