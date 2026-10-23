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
  short: 'أساسي (قصير)',
  medium: 'متوسط',
  long: 'كبير (مفصل)',
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

export interface CampaignConfig {
  tone: string;
  hooks: readonly string[];
  icons: string;
  cta: string;
}

export const CAMPAIGN_CONFIGS: Record<MarketingTextCampaign, CampaignConfig> = {
  professional: {
    tone: 'واثق، مرتب، بدون مبالغة',
    hooks: ['تشكيلة جديدة مميزة', 'اختيارنا الأنيق لكِ', 'أناقة بتفاصيل مدروسة'],
    icons: '✨ 🤍',
    cta: 'أضفها إلى اختياراتكِ وللطلب والاستفسار راسلينا',
  },
  passion: {
    tone: 'مشاعر وإطلالة تلفت الأنظار',
    hooks: ['وقعنا في حب هذه الإطلالة', 'ستحبين إطلالتكِ بها من أول نظرة', 'قطعة تستحق الإعجاب والتميز'],
    icons: '💕 🌸 😍',
    cta: 'لا تفوّتي حبها واطلبيها اليوم',
  },
  persuasive: {
    tone: 'سبب واضح للشراء الآن: القيمة أو الندرة',
    hooks: ['سبب يجعلكِ تطلبينها اليوم دون تردد', 'قيمة تستحق وتفاصيل لا تتكرر', 'فرصة مميزة قبل نفاد الكمية'],
    icons: '✅ ⏳ 💰',
    cta: 'احجزي قطعتكِ الآن قبل النفاد',
  },
  'new-arrival': {
    tone: 'حماس وإعلان وصول',
    hooks: ['الجديد وصل بكل أناقة!', 'وصلتنا للتو تشكيلة تخطف الأنظار', 'وصل حديثاً بأحدث صيحات الموضة'],
    icons: '🆕 ✨ 🛍️',
    cta: 'كوني أول من تقتنيها وتتألق بها',
  },
  'eid-fitr': {
    tone: 'أجواء الفرحة وتجهيز الإطلالة',
    hooks: ['استعدي لعيد الفطر بإطلالة تخطف الأنظار', 'فرحة عيد الفطر تبدأ من أناقتكِ هنا', 'كشخة عيد الفطر جاهزة لتليق بكِ'],
    icons: '🌙 🎁 ✨',
    cta: 'جهّزي إطلالة عيد الفطر من الآن',
  },
  'eid-adha': {
    tone: 'أجواء العيد والتجمعات العائلية',
    hooks: ['إطلالتكِ لأيام عيد الأضحى جاهزة ومكتملة', 'عيد الأضحى المبارك وأناقة تدوم', 'تميزي في مناسبات عيد الأضحى بأبهى حلة'],
    icons: '🐑 🎉 🌙',
    cta: 'احجزي قبل زحمة عيد الأضحى',
  },
  festival: {
    tone: 'طاقة وعروض محدودة المدة',
    hooks: ['عروض المهرجان بدأت بأقوى المفاجآت!', 'فرصة المهرجان بين يديكِ اليوم', 'خصومات وتشكيلات لا تتكرر'],
    icons: '🎊 🔥 🏷️',
    cta: 'العرض متاح لفترة محدودة جداً',
  },
  women: {
    tone: 'لغة قريبة وحميمة كأنها صديقة',
    hooks: ['يا جميلة، شوفي هذه القطعة الرائعة', 'اخترناها لكِ بحب وذوق راقٍ', 'دللي إطلالتكِ بما يليق بجمالكِ'],
    icons: '🌷 💖 🎀',
    cta: 'تواصلي معنا عبر الخاص ويسعدنا خدمتكِ',
  },
};

export const LENGTH_CONFIGS: Record<MarketingTextLength, { lineCount: string; description: string }> = {
  short: {
    lineCount: '5-6 أسطر',
    description: 'خطّاف + وصف + سعر + دعوة للطلب، بدون قائمة مزايا.',
  },
  medium: {
    lineCount: '8-9 أسطر',
    description: 'خطّاف + وصف + ميزتان (2 مزايا) + سعر + كمية + دعوة للطلب.',
  },
  long: {
    lineCount: '11-12 أسطر',
    description: 'خطّاف + وصف + 3 مزايا + سطر عاطفي + سعر + كمية + دعوة للطلب.',
  },
};

export const FORMAT_CONFIGS: Record<MarketingTextEmphasis, string> = {
  normal: 'بدون فواصل زخرفية، إيموجي قليل (3 كحد أقصى)، عريض للسعر فقط بدون نجوم في بقية النص.',
  bold: 'العناوين والسعر والعبارات المهمة بالعريض بنجمة واحدة (*نص*)، إيموجي معتدل.',
  featured: 'فاصل زخرفي ━━━━━━━━━━ تحت الخطّاف، عريض بنجمة واحدة (*نص*) ومائل (_نص_)، إيموجي منسق، وسطر ختامي مائل.',
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

export function calculateOldPrice(priceStr?: string, discountStr?: string): string | null {
  if (!priceStr || !discountStr) return null;
  const price = parseFloat(priceStr.replace(/[^\d.]/g, ''));
  const discount = parseFloat(discountStr.replace(/[^\d.]/g, ''));
  if (!Number.isFinite(price) || !Number.isFinite(discount) || price <= 0 || discount <= 0 || discount >= 100) {
    return null;
  }
  const oldPrice = Math.round(price / (1 - discount / 100));
  return oldPrice > price ? String(oldPrice) : null;
}

export function cleanForWhatsApp(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '*$1*')     // **نص** إلى *نص*
    .replace(/~~(.+?)~~/g, '~$1~')          // ~~نص~~ إلى ~نص~
    .replace(/^#{1,6}\s*/gm, '')            // إزالة عناوين Markdown
    .replace(/^["«»“”]+|["«»“”]+$/g, '')    // إزالة علامات الاقتباس المحيطة
    .replace(/\n{3,}/g, '\n\n')             // أسطر فارغة زائدة
    .trim();
}

export function validateMarketingText(text: string, input: { price?: string }): string[] {
  const errors: string[] = [];
  if (/\*\*|^#/m.test(text)) errors.push('markdown');
  if (input.price && !text.includes(String(input.price).trim())) errors.push('price-missing');
  if (/\d{8,}/.test(text.replace(/[,\s]/g, ''))) errors.push('phone-in-text');
  if (text.length > 750) errors.push('too-long');
  return errors;
}

export function buildWhatsAppSignature(
  details: Pick<AdDetails, 'storeName' | 'storePhone' | 'storeLocation'> & {
    deliveryPhone?: string;
    storeCategories?: string[];
  }
): string {
  const parts: string[] = [];
  const inquiry = clean(details.storePhone);
  const delivery = clean(details.deliveryPhone);
  const store = clean(details.storeName);
  const location = clean(details.storeLocation);

  if (inquiry && delivery && inquiry !== delivery) {
    parts.push(`📞 للاستفسار: ${inquiry}`);
    parts.push(`🚚 للطلب والتوصيل: ${delivery}`);
  } else {
    const singlePhone = delivery || inquiry;
    if (singlePhone) parts.push(`📞 للطلب والاستفسار: ${singlePhone}`);
  }

  if (store) parts.push(`📍 ${store}`);
  if (location && !store.includes(location)) parts.push(`🏢 ${location}`);

  return parts.length ? ('\n\n' + parts.join('\n')) : '';
}

export function buildWhatsAppSystemPrompt(preferences: MarketingTextPreferences): string {
  const campaign = CAMPAIGN_CONFIGS[preferences.campaign];
  const length = LENGTH_CONFIGS[preferences.length];
  const format = FORMAT_CONFIGS[preferences.emphasis];

  return `أنت كاتب محتوى تسويقي متخصص لمركز ملابس نسائية وأزياء، تكتب رسائل جاهزة للنشر في قناة واتساب مباشرة.

قواعد تنسيق واتساب الصارمة:
1. أخرج نص الرسالة فقط، بلا مقدمة ولا شرح ولا علامات اقتباس ولا كود.
2. استخدم تنسيق واتساب فقط: *عريض بنجمة واحدة فقط*، _مائل_، ~مشطوب~. ممنوع قطيعاً استخدام ** وممنوع استخدام # وممنوع أي Markdown عام آخر.
3. لا تخترع معلومات: لا ألوان ولا أقمشة ولا مقاسات ولا خصومات ولا أسعار لم تُعطَ لك صراحة.
4. اكتب بالعربية البيضاء البسيطة، بنبرة دافئة وخطاب مؤنث موجّه للزبونة.
5. لا تكتب رقم هاتف ولا عنواناً ولا اسم المركز إطلاقاً (الكود يضيف التوقيع برمجياً).
6. استخدم الأرقام كما أُعطيت لك حرفياً، ولا تغيّر السعر أو الكمية.
7. كل سطر لا يزيد عن 12 كلمة، وبين الأقسام سطر فارغ.
8. لا تبدأ بعبارة مكررة، واختر خطّافاً مميزاً.

الهيكل المطلوب:
[سطر الخطّاف بالعريض + إيموجي]
${preferences.emphasis === 'featured' ? '[فاصل زخرفي ━━━━━━━━━━]' : ''}
[جملة وصف واحدة موجزة]
[المزايا - إن طُلبت في نوع الطول]
[السعر مع السعر القديم مشطوباً إن وُجد]
[الكمية / التوفر]
[دعوة صريحة للطلب]

كتلة الحملة (${MARKETING_TEXT_CAMPAIGN_LABELS[preferences.campaign]}):
- النبرة: ${campaign.tone}
- أمثلة الخطّافات المقترحة: ${campaign.hooks.map(h => `«${h}»`).join(' أو ')}
- الأيقونات المناسبة: ${campaign.icons}
- صياغة الدعوة للطلب: «${campaign.cta}»

كتلة الطول (${length.lineCount}):
- ${length.description}

كتلة الشكل والتنسيق:
- ${format}`;
}

export function buildWhatsAppUserPrompt(
  details: AdDetails,
  preferences?: Partial<MarketingTextPreferences>,
  variant = 0
): string {
  const prefs: MarketingTextPreferences = {
    ...DEFAULT_MARKETING_TEXT_PREFERENCES,
    ...preferences,
  };
  const oldPrice = calculateOldPrice(details.price, details.discount);
  return JSON.stringify({
    item: clean(details.productName) || 'هذه القطعة المميزة',
    headline: clean(details.headline) || undefined,
    features: details.features?.map(clean).filter(Boolean) || [],
    colors: details.colors?.map(clean).filter(Boolean) || [],
    price: clean(details.price) || undefined,
    currency: clean(details.currency) || 'ريال',
    oldPrice: oldPrice || undefined,
    discountPercentage: clean(details.discount) || undefined,
    quantity: clean(details.quantity) || undefined,
    storeName: clean(details.storeName) || undefined,
    storeCategory: clean(details.storeCategory) || (details.storeCategories && details.storeCategories.length > 0 ? details.storeCategories.join('، ') : undefined),
    storeLocation: clean(details.storeLocation) || undefined,
    campaign: MARKETING_TEXT_CAMPAIGN_LABELS[prefs.campaign] || MARKETING_TEXT_CAMPAIGN_LABELS.professional,
    length: MARKETING_TEXT_LENGTH_LABELS[prefs.length] || MARKETING_TEXT_LENGTH_LABELS.medium,
    format: MARKETING_TEXT_EMPHASIS_LABELS[prefs.emphasis] || MARKETING_TEXT_EMPHASIS_LABELS.featured,
    variantSeed: variant,
  });
}

/**
 * مؤلف محلي كامل يعمل دون اتصال بالإنترنت 100%. يلتزم بتنسيق واتساب الصارم
 * ويبني الخطاف والمزايا والأسعار والتوقيع برمجياً دون هلوسة.
 */
export function generateLocalMarketingText(
  details: AdDetails,
  suppliedPreferences?: Partial<MarketingTextPreferences>,
  variant = 0
): LocalMarketingTextResult {
  const preferences = resolveMarketingTextPreferences(suppliedPreferences || details.marketingPreferences);
  const campaign = CAMPAIGN_CONFIGS[preferences.campaign];
  const product = clean(details.productName) || 'هذه القطعة المميزة';
  const headline = clean(details.headline);
  const features = (details.features || []).map(clean).filter(Boolean);
  const colors = (details.colors || []).map(clean).filter(Boolean);
  const price = clean(details.price);
  const currency = clean(details.currency) || 'ريال';
  const discount = clean(details.discount);
  const oldPrice = calculateOldPrice(price, discount);
  const quantity = clean(details.quantity);

  // 1. الخطاف
  const hookIndex = Math.abs(variant) % campaign.hooks.length;
  const hookText = campaign.hooks[hookIndex];
  const hookIcon = campaign.icons.split(' ')[0] || '✨';
  const hookLine = preferences.emphasis === 'normal'
    ? `${hookIcon} ${hookText}`
    : `${hookIcon} *${hookText}*`;

  // 2. الفاصل للشكل المميز
  const divider = preferences.emphasis === 'featured' ? '━━━━━━━━━━' : '';

  // 3. جملة الوصف
  const descLead = headline ? `${product} — ${headline}` : `${product} بتصميم راقٍ وتفاصيل تمنحكِ إطلالة متألقة.`;
  const descLine = preferences.emphasis === 'featured' ? `_${descLead}_` : descLead;

  // 4. المزايا والألوان حسب الطول
  let featureLines: string[] = [];
  const maxFeatures = preferences.length === 'short' ? 0 : preferences.length === 'medium' ? 2 : 3;
  const pickedFeatures = features.slice(0, maxFeatures);

  if (pickedFeatures.length > 0) {
    const listHeader = preferences.emphasis === 'normal' ? 'المميزات:' : '*المميزات:*';
    const items = pickedFeatures.map(f => `• ${f}`);
    featureLines = [listHeader, ...items];
  }

  let colorLine = '';
  if (colors.length > 0 && preferences.length !== 'short') {
    colorLine = preferences.emphasis === 'normal'
      ? `🎨 الألوان المتاحة: ${colors.join('، ')}`
      : `🎨 *الألوان المتاحة:* ${colors.join('، ')}`;
  }

  // 5. السعر
  let priceLine = '';
  if (price) {
    if (oldPrice) {
      priceLine = preferences.emphasis === 'normal'
        ? `💰 السعر: ~${oldPrice}~ ${price} ${currency} (خصم ${discount}%)`
        : `💰 *السعر:* ~${oldPrice}~ *${price}* ${currency} (خصم ${discount}%)`;
    } else {
      priceLine = preferences.emphasis === 'normal'
        ? `💰 السعر: ${price} ${currency}`
        : `💰 *السعر:* *${price}* ${currency}`;
    }
  } else if (discount) {
    priceLine = preferences.emphasis === 'normal' ? `🏷️ خصم: ${discount}%` : `🏷️ *خصم خاص:* ${discount}%`;
  }

  // 6. الكمية
  let qtyLine = '';
  if (quantity) {
    qtyLine = preferences.emphasis === 'normal' ? `📦 الكمية المتاحة: ${quantity}` : `📦 *الكمية المتاحة:* ${quantity}`;
  }

  // 7. سطر عاطفي للطول الكبير
  let emotionalLine = '';
  if (preferences.length === 'long') {
    emotionalLine = preferences.emphasis === 'featured'
      ? `_إطلالة تجمع النعومة والراحة لتليق بأدق تفاصيل يومكِ._`
      : 'إطلالة تجمع النعومة والراحة لتليق بأدق تفاصيل يومكِ.';
  }

  // 8. الدعوة للطلب
  const ctaLine = preferences.emphasis === 'normal' ? campaign.cta : `🛍️ *${campaign.cta}*`;

  // تجميع الأقسام
  const sections: string[] = [
    hookLine,
    divider,
    descLine,
    featureLines.length ? featureLines.join('\n') : '',
    colorLine,
    priceLine,
    qtyLine,
    emotionalLine,
    ctaLine,
  ].filter(Boolean);

  const mainBody = cleanForWhatsApp(sections.join('\n\n'));

  // 9. التوقيع
  const signature = buildWhatsAppSignature(details);

  const fullText = preferences.format === 'whatsapp'
    ? `${mainBody}${signature}`
    : sanitizeMarketingText(mainBody);

  return {
    text: fullText,
    source: 'local',
  };
}

/** ينشئ نسخة سهلة النسخ في واتساب مع التوقيع البرمجي الموحد. */
export function formatMarketingTextForWhatsApp(
  details: AdDetails,
  text: string,
  preferences?: Partial<MarketingTextPreferences>
): string {
  const resolved = resolveMarketingTextPreferences(preferences || details.marketingPreferences);
  const cleaned = cleanForWhatsApp(text);
  const signature = buildWhatsAppSignature(details);

  // إذا كان النص مقتصراً على سطر وصف قصير (وليس رسالة واتساب كاملة مهيكلة)
  const isShortSummaryOnly = !cleaned.includes('\n') || (!cleaned.includes('💰') && !cleaned.includes('للطلب') && !cleaned.includes(details.storePhone || '___none___'));

  if (isShortSummaryOnly) {
    const product = escapeWhatsAppEmphasis(details.productName) || 'قطعة مميزة';
    const headline = escapeWhatsAppEmphasis(details.headline);
    const features = (details.features || []).map(escapeWhatsAppEmphasis).filter(Boolean).slice(0, 3);
    const colors = (details.colors || []).map(escapeWhatsAppEmphasis).filter(Boolean).slice(0, 3);
    const price = escapeWhatsAppEmphasis(details.price);
    const currency = escapeWhatsAppEmphasis(details.currency) || 'ريال';
    const discount = escapeWhatsAppEmphasis(details.discount);
    const oldPrice = calculateOldPrice(price, discount);
    const quantity = escapeWhatsAppEmphasis(details.quantity);
    const summary = sanitizeMarketingText(cleaned, 340);

    let priceLine = '';
    if (price) {
      if (oldPrice) {
        priceLine = resolved.emphasis === 'normal'
          ? `💰 السعر: ~${oldPrice}~ ${price} ${currency}`
          : `💰 *السعر:* ~${oldPrice}~ *${price}* ${currency}`;
      } else {
        priceLine = resolved.emphasis === 'normal'
          ? `💰 السعر: ${price} ${currency}`
          : `💰 *السعر:* ${price} ${currency}`;
      }
    }

    const emphasizedSummary = resolved.emphasis === 'bold' && summary ? `*${summary}*` : summary;
    const summaryLine = emphasizedSummary ? (resolved.emphasis === 'bold' ? `📝 *${summary}*` : `📝 ${summary}`) : '';

    if (resolved.emphasis === 'normal') {
      const normalLines = [
        `✨ ${product}`,
        headline ? `🌟 ${headline}` : '',
        summaryLine,
        features.length ? `المميزات:
${features.map(f => `• ${f}`).join('\n')}` : '',
        colors.length ? `🎨 الألوان: ${colors.join('، ')}` : '',
        priceLine,
        discount ? `🏷️ الخصم: ${discount}%` : '',
        quantity ? `📦 الكمية المتاحة: ${quantity}` : '',
        '🛍️ اطلب الآن قبل انتهاء التوفر.',
      ].filter(Boolean);
      return sanitizeWhatsAppText(`${normalLines.join('\n\n')}${signature}`, 720);
    }

    const lines = [
      `✨ *${product}*`,
      headline ? `🌟 ${headline}` : '',
      summaryLine,
      features.length ? `✅ *المميزات*
${features.map(f => `• ${f}`).join('\n')}` : '',
      colors.length ? `🎨 *الألوان:* ${colors.join('، ')}` : '',
      priceLine,
      discount ? `🏷️ *خصم:* ${discount}%` : '',
      quantity ? `📦 *الكمية المتاحة:* ${quantity}` : '',
      '🛍️ *اطلب الآن قبل انتهاء التوفر.*',
    ].filter(Boolean);

    return sanitizeWhatsAppText(`${lines.join('\n\n')}${signature}`, 720);
  }

  // إذا كان النص يحمل التوقيع مسبقاً، لا نكرره
  if (details.storePhone && cleaned.includes(details.storePhone)) {
    return sanitizeWhatsAppText(cleaned, 720);
  }

  return sanitizeWhatsAppText(`${cleaned}${signature}`, 720);
}

function escapeWhatsAppEmphasis(value: string | undefined): string {
  return clean(value).replace(/[*_~`]/g, '');
}

export function sanitizeMarketingText(value: string, maxLength = 520): string {
  return clean(value).slice(0, maxLength).trim();
}

export function sanitizeWhatsAppText(value: string, maxLength = 720): string {
  return value
    .split('\n')
    .map(line => clean(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .slice(0, maxLength)
    .trim();
}
