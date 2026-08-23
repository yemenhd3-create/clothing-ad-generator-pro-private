import type {
  AdDetails,
  MarketingTextCampaign,
  MarketingTextEmphasis,
  MarketingTextFormat,
  MarketingTextGoal,
  MarketingTextLength,
  MarketingTextPreferences,
  MarketingTextTone,
} from './types';

export const DEFAULT_MARKETING_TEXT_PREFERENCES: MarketingTextPreferences = {
  tone: 'persuasive',
  length: 'medium',
  goal: 'purchase',
  format: 'whatsapp',
  campaign: 'professional',
  emphasis: 'featured',
};

export const MARKETING_TEXT_TONE_LABELS: Record<MarketingTextTone, string> = {
  exciting: 'مثير وجذاب',
  persuasive: 'مقنع وواثق',
  formal: 'رسمي وأنيق',
  playful: 'مرح ومبهج',
};

export const MARKETING_TEXT_LENGTH_LABELS: Record<MarketingTextLength, string> = {
  short: 'قصير',
  medium: 'متوسط',
  long: 'مفصل',
};

export const MARKETING_TEXT_GOAL_LABELS: Record<MarketingTextGoal, string> = {
  purchase: 'تشجيع الطلب',
  inquiry: 'تشجيع الاستفسار',
  showcase: 'عرض المنتج',
};

export const MARKETING_TEXT_FORMAT_LABELS: Record<MarketingTextFormat, string> = {
  whatsapp: 'منسق لواتساب',
  plain: 'نص بسيط',
};

export const MARKETING_TEXT_CAMPAIGN_LABELS: Record<MarketingTextCampaign, string> = {
  professional: 'احترافي',
  passion: 'شغف',
  persuasive: 'إقناع',
  'new-arrival': 'الجديد وصل',
  'eid-fitr': 'عروض عيد الفطر',
  'eid-adha': 'عروض عيد الأضحى',
  festival: 'عروض المهرجان',
  women: 'موجّه للنساء',
};

export const MARKETING_TEXT_EMPHASIS_LABELS: Record<MarketingTextEmphasis, string> = {
  normal: 'عادي',
  bold: 'عريض',
  featured: 'مميز',
};

export type LocalMarketingTextResult = {
  text: string;
  source: 'local';
};

const clean = (value: string | undefined) => (value || '').replace(/\s+/g, ' ').trim();

export function resolveMarketingTextPreferences(
  preferences?: Partial<MarketingTextPreferences>
): MarketingTextPreferences {
  const tone = preferences?.tone;
  const length = preferences?.length;
  const goal = preferences?.goal;
  const campaign = preferences?.campaign;
  const emphasis = preferences?.emphasis;
  return {
    tone: tone === 'exciting' || tone === 'persuasive' || tone === 'formal' || tone === 'playful'
      ? tone
      : DEFAULT_MARKETING_TEXT_PREFERENCES.tone,
    length: length === 'short' || length === 'medium' || length === 'long'
      ? length
      : DEFAULT_MARKETING_TEXT_PREFERENCES.length,
    goal: goal === 'purchase' || goal === 'inquiry' || goal === 'showcase'
      ? goal
      : DEFAULT_MARKETING_TEXT_PREFERENCES.goal,
    format: preferences?.format === 'whatsapp' || preferences?.format === 'plain'
      ? preferences.format
      : DEFAULT_MARKETING_TEXT_PREFERENCES.format,
    campaign: campaign === 'professional' || campaign === 'passion' || campaign === 'persuasive' || campaign === 'new-arrival' || campaign === 'eid-fitr' || campaign === 'eid-adha' || campaign === 'festival' || campaign === 'women'
      ? campaign
      : DEFAULT_MARKETING_TEXT_PREFERENCES.campaign,
    emphasis: emphasis === 'normal' || emphasis === 'bold' || emphasis === 'featured'
      ? emphasis
      : DEFAULT_MARKETING_TEXT_PREFERENCES.emphasis,
  };
}

function choose<T>(values: readonly T[], variant: number): T {
  return values[Math.abs(variant) % values.length];
}

function benefitLead(product: string, tone: MarketingTextTone, variant: number) {
  const leads: Record<MarketingTextTone, readonly string[]> = {
    exciting: [
      `${product} بتفاصيل تلفت الأنظار`,
      `امنح إطلالتك لمسة مميزة مع ${product}`,
      `${product} اختيار أنيق يضيف حضوراً أجمل`,
    ],
    persuasive: [
      `${product} يجمع بين الأناقة والعملية`,
      `اختيار مدروس لمن يبحث عن ${product} بتفاصيل جميلة`,
      `${product} مصمم ليكون إضافة مميزة لخزانتك`,
    ],
    formal: [
      `اكتشف ${product} بتفاصيل أنيقة`,
      `${product} خيار متوازن للاستخدام اليومي والمناسبات`,
      `نقدم ${product} بصياغة تجمع الوضوح والأناقة`,
    ],
    playful: [
      `لأن الإطلالة الجميلة تبدأ بتفصيل مميز: ${product}`,
      `${product} يضيف لمسة مبهجة إلى يومك`,
      `اختيار لطيف ومختلف مع ${product}`,
    ],
  };
  return choose(leads[tone], variant);
}

function callToAction(goal: MarketingTextGoal, product: string, variant: number) {
  const actions: Record<MarketingTextGoal, readonly string[]> = {
    purchase: [
      `اطلب ${product} الآن`,
      `أضف ${product} إلى اختياراتك اليوم`,
      `ابدأ طلبك الآن واستمتع بتفاصيله`,
    ],
    inquiry: [
      'راسلنا لمعرفة التفاصيل المتاحة',
      'تواصل معنا للاستفسار عن المقاسات والتوفر',
      'اسألنا الآن عن التفاصيل التي تهمك',
    ],
    showcase: [
      'اكتشف تفاصيله عن قرب',
      'تعرّف على ألوانه وتفاصيله المتاحة',
      'شاهد التفاصيل واختر ما يناسبك',
    ],
  };
  return choose(actions[goal], variant);
}

function campaignLead(campaign: MarketingTextCampaign, product: string) {
  const leads: Record<MarketingTextCampaign, string> = {
    professional: '',
    passion: `اختيار يمنح إطلالتك إحساساً أجمل مع ${product}.`,
    persuasive: `تفاصيل مختارة بعناية في ${product}.`,
    'new-arrival': `وصل حديثاً ${product}.`,
    'eid-fitr': `ضمن اختيارات عيد الفطر: ${product}.`,
    'eid-adha': `ضمن اختيارات عيد الأضحى: ${product}.`,
    festival: `ضمن عروض المهرجان: ${product}.`,
    women: `اختيار أنيق بذوق أنثوي مع ${product}.`,
  };
  return leads[campaign];
}

/**
 * مؤلف محلي لا يحتاج اتصالاً أو نموذجاً خارجياً. لا يذكر إلا بيانات أدخلها المستخدم،
 * ويغيّر الصياغة وفق النبرة والطول والهدف من دون اختلاق خصم أو ضمان أو ندرة.
 */
export function generateLocalMarketingText(
  details: AdDetails,
  suppliedPreferences?: Partial<MarketingTextPreferences>,
  variant = 0
): LocalMarketingTextResult {
  const preferences = resolveMarketingTextPreferences(suppliedPreferences || details.marketingPreferences);
  const product = clean(details.productName) || 'هذه القطعة المميزة';
  const features = details.features.map(clean).filter(Boolean).slice(0, 2);
  const colors = details.colors.map(clean).filter(Boolean).slice(0, 3);
  const headline = clean(details.headline);
  const price = clean(details.price);
  const currency = clean(details.currency);
  const discount = clean(details.discount);
  const quantity = clean(details.quantity);
  const store = clean(details.storeName);
  const phone = clean(details.storePhone);

  const lead = benefitLead(product, preferences.tone, variant);
  const featureSentence = features.length > 0 ? `يتميّز بـ ${features.join('، ')}.` : '';
  const colorSentence = colors.length > 0 ? `متوفر بألوان ${colors.join('، ')}.` : '';
  const offerParts = [
    price ? `السعر ${price}${currency ? ` ${currency}` : ''}.` : '',
    discount ? `خصم ${discount}%.` : '',
    quantity ? `الكمية المتاحة: ${quantity}.` : '',
  ].filter(Boolean);
  const contact = [
    store ? `متاح لدى ${store}.` : '',
    phone ? `${preferences.goal === 'inquiry' ? 'للتواصل' : 'للطلب والاستفسار'}: ${phone}.` : '',
  ].filter(Boolean);
  const action = callToAction(preferences.goal, product, variant + 1);
  const campaign = campaignLead(preferences.campaign, product);

  const sentences = [
    `${lead}${headline ? ` — ${headline}` : ''}.`,
    featureSentence,
    colorSentence,
    ...offerParts,
    ...contact,
    campaign,
    `${action}.`,
  ].filter(Boolean);

  const selected = preferences.length === 'short'
    ? [sentences[0], campaign, sentences[sentences.length - 1]]
    : preferences.length === 'medium'
      ? [sentences[0], campaign || featureSentence || colorSentence || offerParts[0], contact.join(' '), sentences[sentences.length - 1]]
      : sentences;

  const plainText = sanitizeMarketingText(selected.filter(Boolean).join(' '));
  return {
    text: preferences.format === 'whatsapp'
      ? formatMarketingTextForWhatsApp(details, plainText, preferences)
      : plainText,
    source: 'local',
  };
}

function escapeWhatsAppEmphasis(value: string): string {
  return clean(value).replace(/[\*_~`]/g, '');
}

/** ينشئ نسخة سهلة النسخ في واتساب ولا يعرض إلا المعلومات التي أدخلها المستخدم. */
export function formatMarketingTextForWhatsApp(
  details: AdDetails,
  text: string,
  preferences?: Partial<MarketingTextPreferences>
): string {
  const resolved = resolveMarketingTextPreferences(preferences || details.marketingPreferences);
  const product = escapeWhatsAppEmphasis(details.productName) || 'قطعة مميزة';
  const headline = escapeWhatsAppEmphasis(details.headline);
  const features = details.features.map(escapeWhatsAppEmphasis).filter(Boolean).slice(0, 3);
  const colors = details.colors.map(escapeWhatsAppEmphasis).filter(Boolean).slice(0, 3);
  const price = escapeWhatsAppEmphasis(details.price);
  const currency = escapeWhatsAppEmphasis(details.currency);
  const discount = escapeWhatsAppEmphasis(details.discount);
  const quantity = escapeWhatsAppEmphasis(details.quantity);
  const store = escapeWhatsAppEmphasis(details.storeName);
  const phone = escapeWhatsAppEmphasis(details.storePhone);
  const summary = sanitizeMarketingText(text, 340);
  const priceLine = price ? `💰 ${resolved.emphasis === 'normal' ? 'السعر:' : '*السعر:*'} ${price}${currency ? ` ${currency}` : ''}` : '';
  if (resolved.emphasis === 'normal') {
    return sanitizeWhatsAppText([
      `✨ ${product}`,
      headline ? `🌟 ${headline}` : '',
      summary ? `📝 ${summary}` : '',
      features.length ? `✅ المميزات\n${features.map(feature => `• ${feature}`).join('\n')}` : '',
      colors.length ? `🎨 الألوان: ${colors.join('، ')}` : '',
      priceLine,
      discount ? `🏷️ الخصم: ${discount}%` : '',
      quantity ? `📦 الكمية المتاحة: ${quantity}` : '',
      resolved.goal === 'inquiry' ? '💬 راسلنا للاستفسار والتفاصيل.' : resolved.goal === 'showcase' ? '👀 اكتشف التفاصيل واختر ما يناسبك.' : '🛍️ اطلب الآن قبل انتهاء التوفر.',
      store ? `🏪 ${store}` : '',
      phone ? `📲 🚚 اطلب الآن عبر خدمة التوصيل: ${phone}` : '',
    ].filter(Boolean).join('\n\n'), 620);
  }
  const emphasizedSummary = resolved.emphasis === 'bold' && summary ? `*${summary}*` : summary;
  const lines = [
    `✨ *${product}*`,
    headline ? `🌟 ${headline}` : '',
    emphasizedSummary ? `📝 ${emphasizedSummary}` : '',
    features.length ? `✅ *المميزات*\n${features.map(feature => `• ${feature}`).join('\n')}` : '',
    colors.length ? `🎨 *الألوان:* ${colors.join('، ')}` : '',
    priceLine,
    discount ? `🏷️ *خصم:* ${discount}%` : '',
    quantity ? `📦 *الكمية المتاحة:* ${quantity}` : '',
    resolved.goal === 'inquiry' ? '💬 راسلنا للاستفسار والتفاصيل.' : resolved.goal === 'showcase' ? '👀 اكتشف التفاصيل واختر ما يناسبك.' : '🛍️ اطلب الآن قبل انتهاء التوفر.',
    store ? `🏪 *${store}*` : '',
    phone ? `📲 🚚 اطلب الآن عبر خدمة التوصيل: ${phone}` : '',
  ].filter(Boolean);
  return sanitizeWhatsAppText(lines.join('\n\n'), 620);
}

/** تحافظ على مخرجات قابلة للعرض والمشاركة ولا تسمح بنص طويل جداً أو أسطر زائدة. */
export function sanitizeMarketingText(value: string, maxLength = 520): string {
  return clean(value).slice(0, maxLength).trim();
}

export function sanitizeWhatsAppText(value: string, maxLength = 620): string {
  return value
    .split('\n')
    .map(line => clean(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .slice(0, maxLength)
    .trim();
}
