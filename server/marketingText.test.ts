import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_AD_DETAILS } from '../shared/types';
import { formatMarketingTextForWhatsApp, generateLocalMarketingText, sanitizeMarketingText } from '../shared/marketingText';

vi.mock('./_core/env', () => ({ ENV: { forgeApiUrl: 'https://forge.test', forgeApiKey: 'test-key' } }));

const { generateMarketingTextWithFallback, MARKETING_TEXT_MODEL_CHAIN } = await import('./marketingText');

function modelResponse(text: string) {
  return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ text }) } }] }) };
}

afterEach(() => vi.unstubAllGlobals());

const details = {
  ...DEFAULT_AD_DETAILS,
  productName: 'فستان صيفي',
  headline: 'أناقة ناعمة لكل يوم',
  features: ['قطن ناعم', 'مريح للحركة'],
  colors: ['أبيض', 'وردي'],
  price: '5000',
  currency: 'ريال',
  discount: '20',
  quantity: '12 قطعة',
  storeName: 'متجر مروان',
  storePhone: '770976559',
};

describe('مولد النص التسويقي العربي', () => {
  it('ينشئ نصاً محلياً غنياً من البيانات المدخلة فقط عند اختيار طول مفصل', () => {
    const result = generateLocalMarketingText(details, { tone: 'exciting', length: 'long', goal: 'inquiry' }, 1);

    expect(result.source).toBe('local');
    expect(result.text).toContain('فستان صيفي');
    expect(result.text).toContain('قطن ناعم');
    expect(result.text).toContain('أبيض');
    expect(result.text).toContain('5000 ريال');
    expect(result.text).toContain('خصم 20%');
    expect(result.text).toContain('متجر مروان');
    expect(result.text).toContain('770976559');
    expect(result.text).not.toContain('شحن مجاني');
    expect(result.text).not.toContain('ضمان');
  });

  it('يستمر دون اتصال ويبدل الصياغة بحسب النبرة والنسخة', () => {
    const first = generateLocalMarketingText(details, { tone: 'playful', length: 'short', goal: 'purchase' }, 0).text;
    const second = generateLocalMarketingText(details, { tone: 'playful', length: 'short', goal: 'purchase' }, 2).text;

    expect(first.length).toBeLessThan(second.length + 200);
    expect(first).not.toBe(second);
    expect(first).toContain('فستان صيفي');
  });

  it('ينظف الفراغات ويحد النص قبل عرضه أو مشاركته', () => {
    expect(sanitizeMarketingText('  نص   منظم\n وجميل  ')).toBe('نص منظم وجميل');
    expect(sanitizeMarketingText('س'.repeat(600))).toHaveLength(520);
  });

  it('ينسق نصاً قابلاً للنسخ في واتساب بالرموز مع حقول المنتج المدخلة فقط', () => {
    const text = formatMarketingTextForWhatsApp(details, 'إطلالة مريحة بتفاصيل ناعمة.', { goal: 'purchase', format: 'whatsapp' });

    expect(text).toContain('✨ *فستان صيفي*');
    expect(text).toContain('✅ *المميزات*');
    expect(text).toContain('💰 *السعر:* 5000 ريال');
    expect(text).toContain('📲 🚚 اطلب الآن عبر خدمة التوصيل: 770976559');
    expect(text).toContain('\n');
    expect(text).not.toContain('شحن مجاني');
    expect(text).not.toContain('ضمان');
  });

  it('يدعم الحملات والتنسيق العادي من دون إدخال نجوم واتساب', () => {
    const text = generateLocalMarketingText(details, { campaign: 'eid-fitr', emphasis: 'normal', length: 'medium' }, 2).text;

    expect(text).toContain('عيد الفطر');
    expect(text).toContain('5000 ريال');
    expect(text).not.toContain('*السعر:*');
    expect(text).toContain('خدمة التوصيل: 770976559');
  });

  it('يبرز ملخص النص عند اختيار التنسيق العريض', () => {
    const text = formatMarketingTextForWhatsApp(details, 'فستان صيفي بتفاصيل مبهجة.', { emphasis: 'bold', format: 'whatsapp' });

    expect(text).toContain('📝 *فستان صيفي بتفاصيل مبهجة.*');
  });

  it('يستخدم أول نموذج متصل صالحاً ويتوقف من دون استدعاء بقية النماذج', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(modelResponse('فستان صيفي بتفاصيل أنيقة، تواصلي معنا لمعرفة الألوان المتاحة.'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await generateMarketingTextWithFallback(details, { tone: 'formal', length: 'medium', goal: 'inquiry' });

    expect(result).toMatchObject({ source: 'cloud', provider: 'gpt-5-mini' });
    expect(result.text).toContain('فستان صيفي');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({ model: 'gpt-5-mini' });
  });

  it('ينتقل إلى النموذج التالي بسرعة عند فشل الأول ثم يقبل أول رد صالح', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(modelResponse('وصل فستان صيفي بتفاصيل ناعمة وجاهز للطلب.'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await generateMarketingTextWithFallback(details, { tone: 'persuasive', length: 'medium', goal: 'purchase' });

    expect(result).toMatchObject({ source: 'cloud', provider: 'gemini-3-flash-preview' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({ model: MARKETING_TEXT_MODEL_CHAIN[0] });
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toMatchObject({ model: MARKETING_TEXT_MODEL_CHAIN[1] });
  });

  it('يرفض النص المكوّن من نقاط فقط ثم ينتقل إلى النموذج التالي أو الرجوع المحلي', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(modelResponse('........'))
      .mockResolvedValueOnce(modelResponse('وصل فستان صيفي بتفاصيل ناعمة وجاهز للطلب.'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await generateMarketingTextWithFallback(details, { tone: 'persuasive', length: 'medium', goal: 'purchase' });

    expect(result).toMatchObject({ source: 'cloud', provider: 'gemini-3-flash-preview' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.text).not.toBe('........');
  });

  it('يرجع للنص المحلي فقط بعد تعذر النماذج الخمسة ولا يوقف الأداة', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await generateMarketingTextWithFallback(details, { tone: 'persuasive', length: 'medium', goal: 'purchase' });

    expect(result.source).toBe('local-fallback');
    expect(result.text).toContain('فستان صيفي');
    expect(result.message).toContain('الصياغة المحلية');
    expect(fetchMock).toHaveBeenCalledTimes(MARKETING_TEXT_MODEL_CHAIN.length);
  });
});
