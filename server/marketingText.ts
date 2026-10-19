import {
  buildWhatsAppSignature,
  buildWhatsAppSystemPrompt,
  buildWhatsAppUserPrompt,
  cleanForWhatsApp,
  formatMarketingTextForWhatsApp,
  generateLocalMarketingText,
  resolveMarketingTextPreferences,
  sanitizeMarketingText,
  validateMarketingText,
} from '../shared/marketingText';
import type { AdDetails, MarketingTextPreferences } from '../shared/types';
import { ENV } from './_core/env';
import { listEnabledTextProviders, type EnabledTextProvider } from './developerProviders';
import { classifyProviderError, isProviderInCooldown, markProviderCooldown, resetProviderCooldown } from './aiProviderErrors';

export type MarketingTextGenerationResult = {
  text: string;
  source: 'cloud' | 'local-fallback';
  provider?: string;
  message?: string;
};

export const MARKETING_TEXT_MODEL_CHAIN = [
  'gpt-5-mini',
  'gemini-3-flash-preview',
  'claude-haiku-4-5',
  'gpt-5-nano',
  'claude-sonnet-4-6',
] as const;

export type MarketingTextCloudProvider = (typeof MARKETING_TEXT_MODEL_CHAIN)[number] | string;

const MODEL_TIMEOUT_MS = 6_000;
const TOTAL_CHAIN_TIMEOUT_MS = 15_000;

function isUsableMarketingText(text: string) {
  const meaningful = text.replace(/[\s.,،؛…!?؟:;_\-]/g, '');
  return meaningful.length >= 6 && /[A-Za-z0-9\u0600-\u06FF]/.test(meaningful);
}

function extractGeneratedText(content: string): string {
  if (!content) return '';
  const trimmed = content.trim();
  try {
    const parsed = JSON.parse(trimmed) as { text?: unknown };
    if (typeof parsed?.text === 'string') return cleanForWhatsApp(parsed.text);
  } catch {
    // not raw JSON
  }
  const cleaned = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try {
    const parsed = JSON.parse(cleaned) as { text?: unknown };
    if (typeof parsed?.text === 'string') return cleanForWhatsApp(parsed.text);
  } catch {
    // not JSON in fence
  }
  return cleanForWhatsApp(cleaned);
}

async function askOpenAiCompatibleModel(
  provider: EnabledTextProvider,
  details: AdDetails,
  preferences: MarketingTextPreferences,
  variant: number,
  timeoutMs: number
): Promise<string> {
  const endpoint = `${provider.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const systemPrompt = buildWhatsAppSystemPrompt(preferences);
  const userPrompt = buildWhatsAppUserPrompt(details, preferences, variant);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify({
      model: provider.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 420,
      temperature: 0.75,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`النموذج ${provider.name} أرجع ${response.status}: ${errorText.slice(0, 120)}`);
  }

  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const raw = payload.choices?.[0]?.message?.content;
  if (!raw) throw new Error(`النموذج ${provider.name} أرجع رداً فارغاً`);
  const text = extractGeneratedText(raw);
  if (!isUsableMarketingText(text)) throw new Error(`النص المسترجع من ${provider.name} غير صالح`);
  return text;
}

async function askGeminiMarketingModel(
  apiKey: string,
  details: AdDetails,
  preferences: MarketingTextPreferences,
  variant: number,
  timeoutMs: number
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
  const systemPrompt = buildWhatsAppSystemPrompt(preferences);
  const userPrompt = buildWhatsAppUserPrompt(details, preferences, variant);

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: `${systemPrompt}\n\nبيانات الطلب:\n${userPrompt}`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.75,
        maxOutputTokens: 420,
      },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) throw new Error(`Gemini أرجع خطأ ${response.status}`);
  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const raw = payload.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('\n').trim();
  if (!raw) throw new Error('Gemini أرجع رداً فارغاً');
  const text = extractGeneratedText(raw);
  if (!isUsableMarketingText(text)) throw new Error('النص المسترجع من Gemini غير صالح');
  return text;
}

async function askForgeMarketingModel(
  model: string,
  details: AdDetails,
  preferences: MarketingTextPreferences,
  variant: number,
  timeoutMs: number
): Promise<string> {
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) throw new Error('لا تتوفر خدمة النماذج المتصلة');
  const systemPrompt = buildWhatsAppSystemPrompt(preferences);
  const userPrompt = buildWhatsAppUserPrompt(details, preferences, variant);

  const response = await fetch(`${ENV.forgeApiUrl.replace(/\/$/, '')}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${ENV.forgeApiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      ...(model.startsWith('gpt-') ? { max_completion_tokens: 420 } : { max_tokens: 420 }),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`تعذر النموذج المتصل: ${response.status}`);
  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const raw = payload.choices?.[0]?.message?.content;
  const text = extractGeneratedText(raw ?? '');
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

  // 1. مزودات الذكاء الاصطناعي النشطة والمحفوظة في لوحة المطور (مثل Groq وOpenRouter وغيرها)
  let storedProviders: EnabledTextProvider[] = [];
  try {
    storedProviders = await listEnabledTextProviders();
  } catch {
    storedProviders = [];
  }

  for (const provider of storedProviders) {
    const remainingMs = deadline - Date.now();
    if (remainingMs < 1_000) break;

    const providerKey = `text-provider:${provider.id}`;
    if (isProviderInCooldown(providerKey)) continue;

    try {
      const rawText = await askOpenAiCompatibleModel(
        provider,
        details,
        resolvedPreferences,
        variant,
        Math.min(MODEL_TIMEOUT_MS, remainingMs)
      );
      resetProviderCooldown(providerKey);
      const finalText = formatMarketingTextForWhatsApp(details, rawText, resolvedPreferences);
      return {
        text: finalText,
        source: 'cloud',
        provider: provider.name || provider.model,
      };
    } catch (err: unknown) {
      const statusMatch = err instanceof Error ? err.message.match(/(\d{3})/) : null;
      const status = statusMatch ? Number(statusMatch[1]) : undefined;
      const classified = classifyProviderError(status, err instanceof Error ? err.message : undefined);
      if (classified.shouldCooldown) {
        markProviderCooldown(providerKey, classified.cooldownMs);
      }
    }
  }

  // 2. سلسلة Forge إذا كانت مهيأة
  if (ENV.forgeApiUrl && ENV.forgeApiKey) {
    for (const provider of MARKETING_TEXT_MODEL_CHAIN) {
      const remainingMs = deadline - Date.now();
      if (remainingMs < 500) break;
      try {
        const rawText = await askForgeMarketingModel(
          provider,
          details,
          resolvedPreferences,
          variant,
          Math.min(MODEL_TIMEOUT_MS, remainingMs)
        );
        const finalText = formatMarketingTextForWhatsApp(details, rawText, resolvedPreferences);
        return {
          text: finalText,
          source: 'cloud',
          provider,
        };
      } catch {
        // تجربة النموذج التالي في السلسلة
      }
    }
  }

  // 3. مزود Google Gemini المباشر عند توفر مفتاح بيئة GEMINI_API_KEY
  if (ENV.geminiApiKey && (deadline - Date.now()) >= 1_000) {
    const geminiKey = 'gemini:marketing';
    if (!isProviderInCooldown(geminiKey)) {
      try {
        const rawText = await askGeminiMarketingModel(
          ENV.geminiApiKey,
          details,
          resolvedPreferences,
          variant,
          Math.min(MODEL_TIMEOUT_MS, deadline - Date.now())
        );
        resetProviderCooldown(geminiKey);
        const finalText = formatMarketingTextForWhatsApp(details, rawText, resolvedPreferences);
        return {
          text: finalText,
          source: 'cloud',
          provider: 'Google Gemini',
        };
      } catch (err: unknown) {
        const statusMatch = err instanceof Error ? err.message.match(/(\d{3})/) : null;
        const status = statusMatch ? Number(statusMatch[1]) : undefined;
        const classified = classifyProviderError(status, err instanceof Error ? err.message : undefined);
        if (classified.shouldCooldown) {
          markProviderCooldown(geminiKey, classified.cooldownMs);
        }
      }
    }
  }

  // 4. المحرك المحلي الاحتياطي التلقائي (يعمل دائماً دون اتصال وبأمان 100%)
  return {
    text: local.text,
    source: 'local-fallback',
    message: 'تعذر التوليد المتصل، فاستخدمنا الصياغة المحلية على هذا الهاتف.',
  };
}
