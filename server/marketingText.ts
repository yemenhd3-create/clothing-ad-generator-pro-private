import { formatMarketingTextForWhatsApp, generateLocalMarketingText, resolveMarketingTextPreferences, sanitizeMarketingText } from '../shared/marketingText';
import type { AdDetails, MarketingTextPreferences } from '../shared/types';
import { ENV } from './_core/env';

export type MarketingTextGenerationResult = {
  text: string;
  source: 'cloud' | 'local-fallback';
  provider?: MarketingTextCloudProvider;
  message?: string;
};

export const MARKETING_TEXT_MODEL_CHAIN = [
  'gpt-5-mini',
  'gemini-3-flash-preview',
  'claude-haiku-4-5',
  'gpt-5-nano',
  'claude-sonnet-4-6',
] as const;

export type MarketingTextCloudProvider = (typeof MARKETING_TEXT_MODEL_CHAIN)[number];

const MODEL_TIMEOUT_MS = 650;
const TOTAL_CHAIN_TIMEOUT_MS = 1_800;

function isUsableMarketingText(text: string) {
  const meaningful = text.replace(/[\s.,،…!?؟:;؛_\-]/g, '');
  return meaningful.length >= 6 && /[A-Za-z0-9\u0600-\u06FF]/.test(meaningful);
}

function buildMarketingPrompt(details: AdDetails, preferences: MarketingTextPreferences, variant: number) {
  return JSON.stringify({
    details: {
      productName: details.productName,
      headline: details.headline,
      features: details.features,
      colors: details.colors,
      price: details.price,
      currency: details.currency,
      discount: details.discount,
      quantity: details.quantity,
      storeName: details.storeName,
      storePhone: details.storePhone,
    },
    preferences,
    copyVariant: variant,
    rules: {
      short: 'جملة أو جملتان قصيرتان.',
      medium: '2 إلى 3 جمل موجزة.',
      long: '3 إلى 5 جمل موجزة.',
      price: 'اكتب السعر دائماً بعد الرقم، مثل 5000 ريال.',
      privacy: 'لا توجد صورة في هذا الطلب. استخدم البيانات النصية فقط.',
    },
  });
}

function responseSchema() {
  return {
    type: 'json_schema',
    json_schema: {
      name: 'arabic_marketing_copy',
      strict: true,
      schema: {
        type: 'object',
        properties: { text: { type: 'string', minLength: 8, maxLength: 520 } },
        required: ['text'],
        additionalProperties: false,
      },
    },
  } as const;
}

async function askMarketingModel(model: MarketingTextCloudProvider, details: AdDetails, preferences: MarketingTextPreferences, variant: number, timeoutMs: number): Promise<string> {
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) throw new Error('لا تتوفر خدمة النماذج المتصلة');
  const response = await fetch(`${ENV.forgeApiUrl.replace(/\/$/, '')}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${ENV.forgeApiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      ...(model.startsWith('gpt-') ? { max_completion_tokens: 360 } : { max_tokens: 360 }),
      messages: [
        {
          role: 'system',
          content: 'أنت كاتب نصوص تسويقية عربية لمنتجات الملابس. اكتب بالفصحى الطبيعية في اتجاه RTL. كن جذاباً ومبهجاً ومقنعاً دون مبالغة أو ضغط. لا تخترع خامة أو سعراً أو خصماً أو كمية أو ضماناً أو تقييمات أو شحناً أو ندرة غير موجودة في البيانات. لا تذكر أنك ذكاء اصطناعي. أعد JSON فقط وفق المخطط.',
        },
        { role: 'user', content: buildMarketingPrompt(details, preferences, variant) },
      ],
      response_format: responseSchema(),
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`تعذر النموذج المتصل: ${response.status}`);
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const raw = payload.choices?.[0]?.message?.content;
  const parsed = typeof raw === 'string' ? JSON.parse(raw) as { text?: unknown } : null;
  const text = typeof parsed?.text === 'string' ? sanitizeMarketingText(parsed.text) : '';
  if (!isUsableMarketingText(text)) throw new Error('لم يرجع النموذج نصاً صالحاً');
  return text;
}

export async function generateMarketingTextWithFallback(
  details: AdDetails,
  preferences?: Partial<MarketingTextPreferences>,
  variant = 0
): Promise<MarketingTextGenerationResult> {
  const resolvedPreferences = resolveMarketingTextPreferences(preferences || details.marketingPreferences);
  const local = generateLocalMarketingText(details, resolvedPreferences, variant);
  const deadline = Date.now() + TOTAL_CHAIN_TIMEOUT_MS;

  for (const provider of MARKETING_TEXT_MODEL_CHAIN) {
    const remainingMs = deadline - Date.now();
    if (remainingMs < 150) break;
    try {
      const text = await askMarketingModel(provider, details, resolvedPreferences, variant, Math.min(MODEL_TIMEOUT_MS, remainingMs));
      return {
        text: resolvedPreferences.format === 'whatsapp' ? formatMarketingTextForWhatsApp(details, text, resolvedPreferences) : text,
        source: 'cloud',
        provider,
      };
    } catch {
      // يحاول النموذج التالي فور انتهاء المهلة أو رفض الاستجابة، من دون عرض الخطأ للمستخدم.
    }
  }
  return {
    text: local.text,
    source: 'local-fallback',
    message: 'تعذر التوليد المتصل، فاستخدمنا الصياغة المحلية على هذا الهاتف.',
  };
}
