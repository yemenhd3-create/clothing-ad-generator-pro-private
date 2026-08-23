import { describe, expect, it } from 'vitest';
import { DEFAULT_AD_DETAILS, DEFAULT_TEMPLATE_SETTINGS } from '../shared/types';
import { applyMerchantCommands, completeMerchantAssistantTask, createMerchantAssistantSession, createMerchantAssistantTask, createMerchantProfile, describeMerchantCommands, normalizeMerchantAssistantSession, normalizeMerchantProfile, parseMerchantCommands } from '../shared/merchantAssistant';

describe('Merchant Assistant rules-first commands', () => {
  it('يفهم أمراً عربياً متعدد التغييرات ويطبّق الحقول المسموحة فقط', () => {
    const commands = parseMerchantCommands('استخدم القالب الليلي وكبّر صورة الملابس ولا تظهر العنوان');
    const result = applyMerchantCommands({ ...DEFAULT_TEMPLATE_SETTINGS }, createMerchantProfile(), commands);

    expect(result.template.visualTheme).toBe('midnight');
    expect(result.template.productScale).toBe(.96);
    expect(result.template.showHeadline).toBe(false);
    expect(result.template.showPrice).toBe(DEFAULT_TEMPLATE_SETTINGS.showPrice);
    expect(result.template.showStoreLogo).toBe(DEFAULT_TEMPLATE_SETTINGS.showStoreLogo);
    expect(result.unsupported).toEqual([]);
  });

  it('يرفض طلب حجم السعر ولا يخترع إعداداً غير موجود', () => {
    const commands = parseMerchantCommands('كبّر السعر');
    const result = applyMerchantCommands({ ...DEFAULT_TEMPLATE_SETTINGS }, createMerchantProfile(), commands);

    expect(result.applied).toEqual([]);
    expect(result.unsupported).toEqual(['price-size']);
    expect(result.template).toEqual(DEFAULT_TEMPLATE_SETTINGS);
    expect(result.profile.unsupportedRequests['price-size']).toBe(1);
  });

  it('يفهم تعديل النتيجة النهائي: تكبير القطعة وإظهار العنوان وإخفاء الشعارين', () => {
    const commands = parseMerchantCommands('تكبير الملابس وإضافة العنوان وإخفاء الشعار النصي والشعار الصوري');
    const result = applyMerchantCommands({ ...DEFAULT_TEMPLATE_SETTINGS, showHeadline: false, showStoreInfo: true, showStoreLogo: true }, createMerchantProfile(), commands);

    expect(result.template.productScale).toBe(.96);
    expect(result.template.showHeadline).toBe(true);
    expect(result.template.showStoreInfo).toBe(false);
    expect(result.template.showStoreLogo).toBe(false);
    expect(describeMerchantCommands(commands)).toMatch(/سأكبّر القطعة/);
    expect(describeMerchantCommands(commands)).toMatch(/الشعار النصي/);
  });

  it('يحفظ ألواناً محدودة للمستقبل من دون تحويلها إلى CSS أو تعديل ثيم الإعلان', () => {
    const commands = parseMerchantCommands('ألواني المفضلة أسود وذهبي وأحمر');
    const result = applyMerchantCommands({ ...DEFAULT_TEMPLATE_SETTINGS, visualTheme: 'mint' }, createMerchantProfile(), commands);

    expect(result.profile.defaultColors).toEqual(['أسود', 'ذهبي', 'أحمر']);
    expect(result.detailsPatch.colors).toEqual(['أسود', 'ذهبي', 'أحمر']);
    expect(result.template.visualTheme).toBe('mint');
  });

  it('يبقي الذاكرة محصورة في الحقول المسموحة حتى لو وصل كائن مخزن تالف', () => {
    const profile = normalizeMerchantProfile({
      version: 1,
      onboardingComplete: true,
      storeName: '<متجري>',
      defaultColors: ['أسود', 'أسود', 'x'.repeat(100)],
      hiddenElements: ['headline', 'unexpected'],
      arbitraryCode: 'alert(1)',
      unsupportedRequests: { 'price-size': 99999 },
    });

    expect(profile.storeName).toBe('متجري');
    expect(profile.defaultColors).toEqual(['أسود', 'xxxxxxxxxxxxxxxxxxxxxxxx']);
    expect(profile.hiddenElements).toEqual(['headline']);
    expect(profile.unsupportedRequests['price-size']).toBe(1000);
    expect('arbitraryCode' in profile).toBe(false);
  });

  it('يحفظ تفضيلات النص التسويقي المعتمدة فقط للصور التالية', () => {
    const profile = normalizeMerchantProfile({
      version: 1,
      defaultColors: [],
      marketingPreferences: { campaign: 'women', emphasis: 'featured', length: 'long', unexpected: 'ignored' },
    });

    expect(profile.marketingPreferences).toEqual({ campaign: 'women', emphasis: 'featured', length: 'long' });
  });

  it('يفهم طلب تحسين النص التسويقي ويعيد توليده محلياً من بيانات الإعلان لا من خدمة خارجية', () => {
    const commands = parseMerchantCommands('قم بتغيير النص التسويقي إلى أفضل وأقصر للواتساب');
    const result = applyMerchantCommands({ ...DEFAULT_TEMPLATE_SETTINGS }, createMerchantProfile(), commands, {
      ...DEFAULT_AD_DETAILS,
      productName: 'فستان سهرة',
      headline: 'أناقة لافتة',
      storeName: 'متجر مروان',
      storePhone: '770976559',
    });

    expect(commands).toContainEqual(expect.objectContaining({ type: 'regenerate-marketing-text' }));
    expect(result.detailsPatch.marketingText).toContain('فستان سهرة');
    expect(result.detailsPatch.marketingTextEngine).toBe('local');
    expect(describeMerchantCommands(commands)).toMatch(/النص التسويقي محلياً/);
  });

  it('يفهم حذف الشعار بصيغته العامة ويخفي طبقتيه بعد التأكيد بدلاً من الرد بأنه لا يفهم', () => {
    const commands = parseMerchantCommands('قم بحذف الشعار من القالب');
    const result = applyMerchantCommands({ ...DEFAULT_TEMPLATE_SETTINGS, showStoreInfo: true, showStoreLogo: true }, createMerchantProfile(), commands);

    expect(result.template.showStoreInfo).toBe(false);
    expect(result.template.showStoreLogo).toBe(false);
    expect(result.applied).toHaveLength(2);
  });

  it('يفهم حذف التذييل من القالب ويطبقه كإخفاء لمعلومات المتجر بدلاً من رفض الطلب', () => {
    const commands = parseMerchantCommands('قم بحذف التذييل من القالب');
    const result = applyMerchantCommands({ ...DEFAULT_TEMPLATE_SETTINGS, showStoreInfo: true }, createMerchantProfile(), commands);

    expect(result.template.showStoreInfo).toBe(false);
    expect(describeMerchantCommands(commands)).toMatch(/التذييل/);
  });

  it('يحفظ آخر مهمة ورسائلها بحجم محدود ويستعيدها بحالة مطبقة بعد العودة', () => {
    const requested = createMerchantAssistantTask(createMerchantAssistantSession(), 'كبّر الملابس في العرض النهائي', parseMerchantCommands('كبّر الملابس في العرض النهائي'));
    const task = requested.tasks.at(-1);
    const completed = completeMerchantAssistantTask(requested, task!.id, 'applied');
    const restored = normalizeMerchantAssistantSession(completed);

    expect(restored.tasks.at(-1)).toMatchObject({ request: 'كبّر الملابس في العرض النهائي', status: 'applied' });
    expect(restored.messages.at(-1)?.content).toMatch(/حُفظت في سجل الإعلان/);
  });
});
