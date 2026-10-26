import type { AdCopyInput, AdCopySuggestion } from '../shared/adCopyStudio';
import { ENV } from './_core/env';

export const AD_COPY_MODEL_CHAIN = ['gpt-5-mini', 'gemini-3-flash-preview', 'claude-haiku-4-5', 'gpt-5-nano'] as const;
export type AdCopyModel = (typeof AD_COPY_MODEL_CHAIN)[number];

const EMPTY: AdCopySuggestion = { productTitle: '', shortDescription: '', priceText: '', discountText: '', quantityText: '', colorsText: '', contactText: '', locationText: '', ctaText: '' };

function prompt(input: AdCopyInput) {
  return JSON.stringify({ input, rules: ['أعد JSON فقط.', 'اكتب نصوصاً عربية قصيرة ومشرقة ومناسبة للإعلان البصري.', 'لا تخترع سعراً أو خصماً أو كمية أو عنواناً أو رقم هاتف.', 'استخدم فقط الحقول الموجودة في input.', 'إذا لم توجد قيمة لحقل مختار فأعده فارغاً.', 'الوصف القصير من 3 إلى 8 كلمات، واضح وغير مبالغ.'] });
}

function schema() { return { type: 'json_schema', json_schema: { name: 'ad_copy_suggestion', strict: true, schema: { type: 'object', properties: { productTitle: { type: 'string', maxLength: 80 }, shortDescription: { type: 'string', maxLength: 100 }, priceText: { type: 'string', maxLength: 40 }, discountText: { type: 'string', maxLength: 40 }, quantityText: { type: 'string', maxLength: 60 }, colorsText: { type: 'string', maxLength: 80 }, contactText: { type: 'string', maxLength: 80 }, locationText: { type: 'string', maxLength: 100 }, ctaText: { type: 'string', maxLength: 40 } }, required: ['productTitle', 'shortDescription', 'priceText', 'discountText', 'quantityText', 'colorsText', 'contactText', 'locationText', 'ctaText'], additionalProperties: false } } } as const; }

function clean(value: unknown, max: number) { return typeof value === 'string' ? value.replace(/[\u0000-\u001f]/g, '').trim().slice(0, max) : ''; }
function parse(raw: unknown): AdCopySuggestion { const data = typeof raw === 'string' ? JSON.parse(raw) as Record<string, unknown> : {}; return { productTitle: clean(data.productTitle, 80), shortDescription: clean(data.shortDescription, 100), priceText: clean(data.priceText, 40), discountText: clean(data.discountText, 40), quantityText: clean(data.quantityText, 60), colorsText: clean(data.colorsText, 80), contactText: clean(data.contactText, 80), locationText: clean(data.locationText, 100), ctaText: clean(data.ctaText, 40) }; }

async function ask(model: AdCopyModel, input: AdCopyInput, timeoutMs: number) {
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) throw new Error('لا تتوفر خدمة النموذج المتصل');
  const response = await fetch(`${ENV.forgeApiUrl.replace(/\/$/, '')}/v1/chat/completions`, { method: 'POST', headers: { authorization: `Bearer ${ENV.forgeApiKey}`, 'content-type': 'application/json' }, body: JSON.stringify({ model, max_completion_tokens: 260, messages: [{ role: 'system', content: 'أنت محرر نصوص قصيرة لإعلانات الملابس العربية. مهمتك تجهيز محتوى النص فقط، لا تصميم الصورة ولا اقتراح مواقع العناصر. أعد JSON وفق المخطط.' }, { role: 'user', content: prompt(input) }], response_format: schema() }), signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`ad-copy model ${response.status}`);
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  return parse(payload.choices?.[0]?.message?.content || '{}');
}

export async function generateAdCopySuggestion(input: AdCopyInput): Promise<{ suggestion: AdCopySuggestion; source: 'cloud' | 'fallback'; model?: string; message?: string }> {
  const deadline = Date.now() + 4_500;
  for (const model of AD_COPY_MODEL_CHAIN) {
    const remaining = deadline - Date.now();
    if (remaining < 250) break;
    try { return { suggestion: await ask(model, input, Math.min(1_200, remaining)), source: 'cloud', model }; } catch { /* try next configured model */ }
  }
  const selected = new Set(input.selectedFields);
  return { suggestion: { ...EMPTY, productTitle: selected.has('productTitle') ? input.productName : '', shortDescription: selected.has('shortDescription') ? (input.productContext || 'أناقة مريحة لكل يوم') : '', priceText: selected.has('price') && input.price ? `${input.price} ${input.currency}`.trim() : '', discountText: selected.has('discount') && input.discount ? `خصم ${input.discount}%` : '', quantityText: selected.has('quantity') ? input.quantity : '', colorsText: selected.has('colors') ? input.colors.join('، ') : '', contactText: selected.has('contact') ? input.storePhone : '', locationText: selected.has('location') ? input.storeLocation : '', ctaText: selected.has('cta') ? (input.cta || 'اطلب الآن') : '' }, source: 'fallback', message: 'تعذر الاتصال بالنموذج الآن؛ تم تجهيز نص آمن من البيانات المدخلة.' };
}
