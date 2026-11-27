import type { AdCopyLayer } from '@shared/adCopyStudio';
import type { AdDetails, TemplateSettings } from '@shared/types';

/**
 * تنظيف نص المستخدم قبل رسمه على قماش الإعلان.
 * ما يكتبه المستخدم في الحقول يبقى كما هو؛ هذه النسخة للعرض داخل الصورة فقط،
 * حتى لا يشوّه لصقٌ من مصدر خارجي ترتيب النص أو يبطئ الرسم.
 */

// محارف تحكم واتجاه وتنسيق خفي قد تصل من اللصق فتعيد ترتيب المقاطع داخل الصورة (يُستثنى محرف السطر الجديد؛ يعالجه كل وضع على حدة)
const UNWANTED_CHARS = /[\u0000-\u0009\u000B-\u001F\u007F-\u009F\u00AD\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

function dropUnpairedSurrogates(value: string): string {
  let text = '';
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code >= 0xd800 && code <= 0xdfff) continue;
    text += char;
  }
  return text;
}

function capByCodePoints(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return Array.from(value).slice(0, maxLength).join('');
}

/** نص سطر واحد آمن للرسم على القماش. */
export function sanitizeCanvasText(value: unknown, maxLength = 120): string {
  if (typeof value !== 'string') return '';
  const cleaned = dropUnpairedSurrogates(value).replace(/\s+/g, ' ').replace(UNWANTED_CHARS, '').trim();
  return capByCodePoints(cleaned, maxLength);
}

/** نص متعدد الأسطر (سطران كحد أقصى) لشارات القالب التي تعتمد السطر الثاني. */
export function sanitizeCanvasMultiline(value: unknown, maxLength = 60): string {
  if (typeof value !== 'string') return '';
  const cleaned = dropUnpairedSurrogates(value)
    .replace(/\r\n?/g, '\n')
    .replace(UNWANTED_CHARS, '')
    .split('\n')
    .map(line => line.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 2)
    .join('\n');
  return capByCodePoints(cleaned, maxLength);
}

function cleanList(value: unknown, maxItems: number, itemMax: number): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(item => sanitizeCanvasText(item, itemMax)).filter(Boolean).slice(0, maxItems);
}

/** نسخة نظيفة من تفاصيل الإعلان للرسم؛ لا تمس النص التسويقي لأنه لا يُرسم على القماش. */
export function sanitizeAdDetails(details: AdDetails): AdDetails {
  return {
    ...details,
    productName: sanitizeCanvasText(details.productName, 80),
    headline: sanitizeCanvasText(details.headline, 90),
    discount: sanitizeCanvasText(details.discount, 8),
    quantity: sanitizeCanvasText(details.quantity, 24),
    colors: cleanList(details.colors, 8, 20),
    price: sanitizeCanvasText(details.price, 24),
    currency: sanitizeCanvasText(details.currency, 12),
    features: cleanList(details.features, 4, 40),
    storeName: sanitizeCanvasText(details.storeName, 60),
    storePhone: sanitizeCanvasText(details.storePhone, 24),
  };
}

/** نسخة نظيفة من نصوص القالب التي يكتبها المستخدم وتُرسم على القماش. */
export function sanitizeTemplateText(template: TemplateSettings): TemplateSettings {
  const next = { ...template };
  next.badgeText = sanitizeCanvasMultiline(template.badgeText, 60);
  if (template.studioCaption !== undefined) next.studioCaption = sanitizeCanvasText(template.studioCaption, 60);
  if (template.studioPrice !== undefined) next.studioPrice = sanitizeCanvasText(template.studioPrice, 24);
  if (Array.isArray(template.adCopyLayers)) {
    next.adCopyLayers = template.adCopyLayers.map((layer: AdCopyLayer) => ({ ...layer, text: sanitizeCanvasText(layer.text, 140) }));
  }
  return next;
}
