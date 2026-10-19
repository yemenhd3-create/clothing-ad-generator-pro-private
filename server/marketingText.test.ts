import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_AD_DETAILS } from '../shared/types';
import {
  CAMPAIGN_CONFIGS,
  calculateOldPrice,
  cleanForWhatsApp,
  formatMarketingTextForWhatsApp,
  generateLocalMarketingText,
  sanitizeMarketingText,
  validateMarketingText,
} from '../shared/marketingText';

vi.mock('./_core/env', () => ({ ENV: { forgeApiUrl: 'https://forge.test', forgeApiKey: 'test-key' } }));

const mockStoredProviders = vi.fn().mockResolvedValue([]);
vi.mock('./developerProviders', () => ({
  listEnabledTextProviders: () => mockStoredProviders(),
}));

const { generateMarketingTextWithFallback, MARKETING_TEXT_MODEL_CHAIN } = await import('./marketingText');

function modelResponse(text: string) {
  return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ text }) } }] }) };
}

afterEach(() => {
  vi.unstubAllGlobals();
  mockStoredProviders.mockResolvedValue([]);
});

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

describe('محرك النصوص التسويقية وقواعد واتساب', () => {
  it('يحسب السعر القديم المشطوب بدقة عند وجود نسبة خصم', () => {
    // 5000 مع خصم 20% -> 5000 / 0.8 = 6250
    const oldPrice = calculateOldPrice('5000', '20');
    expect(oldPrice).toBe('6250');

    // مدخلات غير صحيحة لا تعطل الدالة
    expect(calculateOldPrice('5000', '0')).toBeNull();
    expect(calculateOldPrice('0', '20')).toBeNull();
    expect(calculateOldPrice('', '')).toBeNull();
  });

  it('ينظف تنسيقات Markdown العامة ويحولها إلى قواعد واتساب الصارمة', () => {
    const raw = '## عنوان رئيسي\n**نص عريض جداً** مع ~~نص مشطوب~~ و "علامات اقتباس"\n\n\n\nسطر جديد';
    const cleaned = cleanForWhatsApp(raw);

    expect(cleaned).not.toContain('##');
    expect(cleaned).not.toContain('**');
    expect(cleaned).not.toContain('~~');
    expect(cleaned).toContain('*نص عريض جداً*');
    expect(cleaned).toContain('~نص مشطوب~');
    expect(cleaned).not.toContain('\n\n\n');
  });

  it('يفحص أخطاء التنسيق وهلوسة الأرقام بنجاح', () => {
    const invalidText = '## عرض خاص **فستان** برقم هاتف 777123456';
    const errors = validateMarketingText(invalidText, { price: '5000' });

    expect(errors).toContain('markdown');
    expect(errors).toContain('price-missing');
    expect(errors).toContain('phone-in-text');
  });

  it('ينشئ نصاً محلياً غنياً ومتوافقاً مع واتساب بنسبة 100% دون إنترنت', () => {
    const result = generateLocalMarketingText(details, {
      campaign: 'professional',
      length: 'long',
      emphasis: 'featured',
      format: 'whatsapp',
    }, 1);

    expect(result.source).toBe('local');
    expect(result.text).toContain('فستان صيفي');
    expect(result.text).toContain('━━━━━━━━━━'); // الفاصل المميز
    expect(result.text).toContain('قطن ناعم');
    expect(result.text).toContain('أبيض');
    expect(result.text).toContain('~6250~'); // السعر القديم المشطوب
    expect(result.text).toContain('*5000* ريال');
    expect(result.text).toContain('خصم 20%');
    expect(result.text).toContain('12 قطعة');
    expect(result.text).toContain('متجر مروان');
    expect(result.text).toContain('770976559');
    expect(result.text).not.toContain('**');
    expect(result.text).not.toContain('##');
  });

  it('يدعم الحملات والتنسيق العادي دون نجوم عريضة في النص', () => {
    const text = generateLocalMarketingText(details, {
      campaign: 'eid-fitr',
      emphasis: 'normal',
      length: 'medium',
      format: 'whatsapp',
    }, 2).text;

    expect(text).toContain('عيد الفطر');
    expect(text).toContain('5000 ريال');
    expect(text).not.toContain('*السعر:*');
    expect(text).not.toContain('━━━━━━━━━━');
    expect(text).toContain('770976559');
  });

  it('يغير الخطاف الدعائي لكل رقم نسخة (Variant) لتجنب التكرار', () => {
    const v0 = generateLocalMarketingText(details, { campaign: 'new-arrival' }, 0).text;
    const v1 = generateLocalMarketingText(details, { campaign: 'new-arrival' }, 1).text;
    const v2 = generateLocalMarketingText(details, { campaign: 'new-arrival' }, 2).text;

    expect(v0).not.toBe(v1);
    expect(v1).not.toBe(v2);
  });

  it('ينسق نصاً قابلاً للنسخ في واتساب بالرموز مع حقول المنتج وتوقيع المركز', () => {
    const text = formatMarketingTextForWhatsApp(details, 'إطلالة مريحة بتفاصيل ناعمة.', { emphasis: 'bold', format: 'whatsapp' });

    expect(text).toContain('✨ *فستان صيفي*');
    expect(text).toContain('✅ *المميزات*');
    expect(text).toContain('~6250~');
    expect(text).toContain('*5000* ريال');
    expect(text).toContain('📝 *إطلالة مريحة بتفاصيل ناعمة.*');
    expect(text).toContain('📞 للطلب والاستفسار: 770976559');
    expect(text).toContain('📍 متجر مروان');
    expect(text).not.toContain('**');
  });

  it('يستخدم مزود النص المخزن في لوحة المطور أولاً بنجاح مع تنسيق واتساب والتوقيع البرمجي', async () => {
    mockStoredProviders.mockResolvedValueOnce([
      {
        id: 'prov-groq-1',
        name: 'Groq Llama 3',
        baseUrl: 'https://api.groq.com/openai/v1',
        model: 'llama-3.3-70b-versatile',
        apiKey: 'gsk_test123',
      },
    ]);

    const fetchMock = vi.fn().mockResolvedValueOnce(modelResponse('✨ *تشكيلة مميزة*\n\nفستان صيفي بأناقة فائقة.\n\n💰 *السعر:* *5000* ريال'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await generateMarketingTextWithFallback(details, { tone: 'formal', length: 'medium', goal: 'inquiry' });

    expect(result).toMatchObject({ source: 'cloud', provider: 'Groq Llama 3' });
    expect(result.text).toContain('فستان صيفي');
    expect(result.text).toContain('770976559'); // التوقيع البرمجي أضيف تلقائياً
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.groq.com/openai/v1/chat/completions');
  });

  it('ينتقل للمزود المخزن التالي عند تعثر المزود الأول بنظام التدوير والتهدئة', async () => {
    mockStoredProviders.mockResolvedValueOnce([
      {
        id: 'prov-down',
        name: 'OpenRouter Unavailable',
        baseUrl: 'https://openrouter.ai/api/v1',
        model: 'openai/gpt-4o',
        apiKey: 'sk_test_down',
      },
      {
        id: 'prov-backup',
        name: 'Groq Backup',
        baseUrl: 'https://api.groq.com/openai/v1',
        model: 'llama-3.3-70b-versatile',
        apiKey: 'gsk_test_backup',
      },
    ]);

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503, text: async () => 'Service Unavailable' })
      .mockResolvedValueOnce(modelResponse('فستان صيفي خفيف وأنيق جاهز للطلب الفوري.'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await generateMarketingTextWithFallback(details, { tone: 'persuasive', length: 'medium', goal: 'purchase' });

    expect(result).toMatchObject({ source: 'cloud', provider: 'Groq Backup' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('يستخدم أول نموذج متصل صالحاً ويتوقف من دون استدعاء بقية النماذج', async () => {
    mockStoredProviders.mockResolvedValueOnce([]);
    const fetchMock = vi.fn().mockResolvedValueOnce(modelResponse('فستان صيفي بتفاصيل أنيقة، تواصلي معنا لمعرفة الألوان المتاحة.'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await generateMarketingTextWithFallback(details, { tone: 'formal', length: 'medium', goal: 'inquiry' });

    expect(result).toMatchObject({ source: 'cloud', provider: 'gpt-5-mini' });
    expect(result.text).toContain('فستان صيفي');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('ينتقل إلى النموذج التالي بسرعة عند فشل الأول ثم يقبل أول رد صالح', async () => {
    mockStoredProviders.mockResolvedValueOnce([]);
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(modelResponse('وصل فستان صيفي بتفاصيل ناعمة وجاهز للطلب.'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await generateMarketingTextWithFallback(details, { tone: 'persuasive', length: 'medium', goal: 'purchase' });

    expect(result).toMatchObject({ source: 'cloud', provider: 'gemini-3-flash-preview' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('يرجع للنص المحلي فقط بعد تعذر النماذج ولا يوقف الأداة', async () => {
    mockStoredProviders.mockResolvedValueOnce([]);
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await generateMarketingTextWithFallback(details, { tone: 'persuasive', length: 'medium', goal: 'purchase' });

    expect(result.source).toBe('local-fallback');
    expect(result.text).toContain('فستان صيفي');
    expect(result.text).toContain('770976559');
    expect(result.message).toContain('الصياغة المحلية');
  });
});
