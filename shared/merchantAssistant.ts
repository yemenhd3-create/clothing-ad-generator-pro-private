import {
  DEFAULT_PRODUCT_SCALE,
  PRODUCT_SCALE_MAX,
  PRODUCT_SCALE_MIN,
  PRODUCT_SCALE_STEP,
  type AdDetails,
  type MarketingTextPreferences,
  type TemplateSettings,
  type TemplateVisualTheme,
} from './types';
import { generateLocalMarketingText, resolveMarketingTextPreferences } from './marketingText';

export type MerchantStoreField = 'storeName' | 'storePhone' | 'storeLocation' | 'storeCategory';
export type MerchantVisibilityElement = 'headline' | 'price' | 'productName' | 'discount' | 'features' | 'storeInfo' | 'storeLogo';
export type MerchantUnsupportedCode = 'price-size' | 'store-name-position' | 'unknown';
export type MerchantEditableAdField = 'headline' | 'productName';

export type MerchantCommand =
  | { type: 'set-visual-theme'; theme: TemplateVisualTheme }
  | { type: 'adjust-product-scale'; direction: 'increase' | 'decrease' }
  | { type: 'set-element-visibility'; element: MerchantVisibilityElement; visible: boolean }
  | { type: 'set-store-field'; field: MerchantStoreField; value: string }
  | { type: 'set-default-colors'; colors: string[] }
  | { type: 'set-ad-field'; field: MerchantEditableAdField; value: string }
  | { type: 'regenerate-marketing-text'; preferences: Partial<MarketingTextPreferences> }
  | { type: 'unsupported'; code: MerchantUnsupportedCode };

export type MerchantProfile = {
  version: 1;
  onboardingComplete: boolean;
  storeName: string;
  storePhone: string;
  storeLocation: string;
  storeCategory: string;
  preferredTheme?: TemplateVisualTheme;
  preferredProductScale?: number;
  marketingPreferences?: Partial<MarketingTextPreferences>;
  defaultColors: string[];
  hiddenElements: MerchantVisibilityElement[];
  appliedCommandCount: number;
  unsupportedRequests: Partial<Record<Exclude<MerchantUnsupportedCode, 'unknown'>, number>>;
  updatedAt: number;
};

export type MerchantAssistantMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
};

export type MerchantAssistantTaskStatus = 'awaiting-confirmation' | 'applied' | 'needs-guidance' | 'failed';

export type MerchantAssistantTask = {
  id: string;
  request: string;
  summary: string;
  commands: MerchantCommand[];
  status: MerchantAssistantTaskStatus;
  createdAt: number;
  completedAt?: number;
};

export type MerchantAssistantSession = {
  version: 1;
  messages: MerchantAssistantMessage[];
  tasks: MerchantAssistantTask[];
  updatedAt: number;
};

const THEMES: TemplateVisualTheme[] = ['classic', 'midnight', 'rose', 'mint', 'sand'];
const VISIBILITY_ELEMENTS: MerchantVisibilityElement[] = ['headline', 'price', 'productName', 'discount', 'features', 'storeInfo', 'storeLogo'];
const STORE_FIELDS: MerchantStoreField[] = ['storeName', 'storePhone', 'storeLocation', 'storeCategory'];
const VISIBILITY_FIELDS: Record<MerchantVisibilityElement, keyof Pick<TemplateSettings, 'showHeadline' | 'showPrice' | 'showProductName' | 'showDiscount' | 'showFeatures' | 'showStoreInfo' | 'showStoreLogo'>> = {
  headline: 'showHeadline',
  price: 'showPrice',
  productName: 'showProductName',
  discount: 'showDiscount',
  features: 'showFeatures',
  storeInfo: 'showStoreInfo',
  storeLogo: 'showStoreLogo',
};
const MAX_MESSAGES = 32;
const MAX_TASKS = 16;

function cleanText(value: unknown, limit = 80) {
  return typeof value === 'string' ? value.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, limit) : '';
}

function normalizeArabic(value: string) {
  return value
    .toLowerCase()
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
}

function boundedCount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(1_000, Math.floor(parsed)) : 0;
}

function uniqueColors(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map(color => cleanText(color, 24)).filter(Boolean))).slice(0, 4);
}

function hasAny(input: string, terms: string[]) {
  return terms.some(term => input.includes(term));
}

function createId(prefix: string, time = Date.now()) {
  return `${prefix}-${time}-${Math.random().toString(36).slice(2, 8)}`;
}

function createMessage(role: MerchantAssistantMessage['role'], content: string, time = Date.now()): MerchantAssistantMessage {
  return { id: createId(role, time), role, content: cleanText(content, 420), createdAt: time };
}

function normalizeMarketingPreferences(value: unknown): Partial<MarketingTextPreferences> {
  if (!value || typeof value !== 'object') return {};
  const source = value as Record<string, unknown>;
  const resolved = resolveMarketingTextPreferences({
    tone: source.tone as MarketingTextPreferences['tone'],
    length: source.length as MarketingTextPreferences['length'],
    goal: source.goal as MarketingTextPreferences['goal'],
    format: source.format as MarketingTextPreferences['format'],
    campaign: source.campaign as MarketingTextPreferences['campaign'],
    emphasis: source.emphasis as MarketingTextPreferences['emphasis'],
  });
  return {
    ...(source.tone === resolved.tone ? { tone: resolved.tone } : {}),
    ...(source.length === resolved.length ? { length: resolved.length } : {}),
    ...(source.goal === resolved.goal ? { goal: resolved.goal } : {}),
    ...(source.format === resolved.format ? { format: resolved.format } : {}),
    ...(source.campaign === resolved.campaign ? { campaign: resolved.campaign } : {}),
    ...(source.emphasis === resolved.emphasis ? { emphasis: resolved.emphasis } : {}),
  };
}

function normalizeCommand(value: unknown): MerchantCommand | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  if (source.type === 'set-visual-theme' && THEMES.includes(source.theme as TemplateVisualTheme)) return { type: source.type, theme: source.theme as TemplateVisualTheme };
  if (source.type === 'adjust-product-scale' && (source.direction === 'increase' || source.direction === 'decrease')) return { type: source.type, direction: source.direction };
  if (source.type === 'set-element-visibility' && VISIBILITY_ELEMENTS.includes(source.element as MerchantVisibilityElement) && typeof source.visible === 'boolean') return { type: source.type, element: source.element as MerchantVisibilityElement, visible: source.visible };
  if (source.type === 'set-store-field' && STORE_FIELDS.includes(source.field as MerchantStoreField)) return { type: source.type, field: source.field as MerchantStoreField, value: cleanText(source.value, source.field === 'storePhone' ? 32 : 80) };
  if (source.type === 'set-default-colors') return { type: source.type, colors: uniqueColors(source.colors) };
  if (source.type === 'set-ad-field' && (source.field === 'headline' || source.field === 'productName')) return { type: source.type, field: source.field, value: cleanText(source.value, 90) };
  if (source.type === 'regenerate-marketing-text') return { type: source.type, preferences: normalizeMarketingPreferences(source.preferences) };
  if (source.type === 'unsupported' && (source.code === 'price-size' || source.code === 'store-name-position' || source.code === 'unknown')) return { type: source.type, code: source.code };
  return null;
}

export function createMerchantProfile(): MerchantProfile {
  return {
    version: 1,
    onboardingComplete: false,
    storeName: '',
    storePhone: '',
    storeLocation: '',
    storeCategory: '',
    defaultColors: [],
    hiddenElements: [],
    appliedCommandCount: 0,
    unsupportedRequests: {},
    updatedAt: Date.now(),
  };
}

export function normalizeMerchantProfile(value: unknown): MerchantProfile {
  const fallback = createMerchantProfile();
  if (!value || typeof value !== 'object') return fallback;
  const source = value as Record<string, unknown>;
  if (source.version !== 1) return fallback;
  const theme = THEMES.includes(source.preferredTheme as TemplateVisualTheme) ? source.preferredTheme as TemplateVisualTheme : undefined;
  const scale = Number(source.preferredProductScale);
  const hiddenElements = Array.isArray(source.hiddenElements)
    ? source.hiddenElements.filter((entry): entry is MerchantVisibilityElement => VISIBILITY_ELEMENTS.includes(entry as MerchantVisibilityElement))
    : [];
  const unsupported = source.unsupportedRequests && typeof source.unsupportedRequests === 'object' ? source.unsupportedRequests as Record<string, unknown> : {};
  return {
    version: 1,
    onboardingComplete: source.onboardingComplete === true,
    storeName: cleanText(source.storeName),
    storePhone: cleanText(source.storePhone, 32),
    storeLocation: cleanText(source.storeLocation),
    storeCategory: cleanText(source.storeCategory, 48),
    preferredTheme: theme,
    preferredProductScale: Number.isFinite(scale) ? Math.min(PRODUCT_SCALE_MAX, Math.max(PRODUCT_SCALE_MIN, scale)) : undefined,
    marketingPreferences: normalizeMarketingPreferences(source.marketingPreferences),
    defaultColors: uniqueColors(source.defaultColors),
    hiddenElements: Array.from(new Set(hiddenElements)),
    appliedCommandCount: boundedCount(source.appliedCommandCount),
    unsupportedRequests: {
      'price-size': boundedCount(unsupported['price-size']) || undefined,
      'store-name-position': boundedCount(unsupported['store-name-position']) || undefined,
    },
    updatedAt: Number.isFinite(Number(source.updatedAt)) ? Number(source.updatedAt) : fallback.updatedAt,
  };
}

export function createMerchantAssistantSession(): MerchantAssistantSession {
  const now = Date.now();
  return {
    version: 1,
    messages: [createMessage('assistant', 'مرحباً! أنا القائد المحلي لمشروعك. أفهم طلبك، وأستعين بخبراء القالب والملابس والجودة والخصوصية داخل الهاتف. سأشرح ما سأفعله ثم أطبّقه بعد تأكيدك، وسأحتفظ بسجل مهامك حتى لا يضيع آخر طلب.', now)],
    tasks: [],
    updatedAt: now,
  };
}

export function normalizeMerchantAssistantSession(value: unknown): MerchantAssistantSession {
  const fallback = createMerchantAssistantSession();
  if (!value || typeof value !== 'object') return fallback;
  const source = value as Record<string, unknown>;
  if (source.version !== 1) return fallback;
  const messages = Array.isArray(source.messages)
    ? source.messages.map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const message = item as Record<string, unknown>;
      if (message.role !== 'user' && message.role !== 'assistant') return null;
      const content = cleanText(message.content, 420);
      if (!content) return null;
      const createdAt = Number.isFinite(Number(message.createdAt)) ? Number(message.createdAt) : Date.now() + index;
      return { id: cleanText(message.id, 80) || createId(message.role, createdAt), role: message.role, content, createdAt } as MerchantAssistantMessage;
    }).filter((item): item is MerchantAssistantMessage => Boolean(item)).slice(-MAX_MESSAGES)
    : [];
  const tasks = Array.isArray(source.tasks)
    ? source.tasks.map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const task = item as Record<string, unknown>;
      const status = task.status;
      if (status !== 'awaiting-confirmation' && status !== 'applied' && status !== 'needs-guidance' && status !== 'failed') return null;
      const request = cleanText(task.request, 240);
      const summary = cleanText(task.summary, 420);
      if (!request || !summary) return null;
      const commands = Array.isArray(task.commands) ? task.commands.map(normalizeCommand).filter((command): command is MerchantCommand => Boolean(command)).slice(0, 8) : [];
      const createdAt = Number.isFinite(Number(task.createdAt)) ? Number(task.createdAt) : Date.now() + index;
      const completedAt = Number.isFinite(Number(task.completedAt)) ? Number(task.completedAt) : undefined;
      return { id: cleanText(task.id, 80) || createId('task', createdAt), request, summary, commands, status, createdAt, ...(completedAt ? { completedAt } : {}) } as MerchantAssistantTask;
    }).filter((item): item is MerchantAssistantTask => Boolean(item)).slice(-MAX_TASKS)
    : [];
  return {
    version: 1,
    messages: messages.length > 0 ? messages : fallback.messages,
    tasks,
    updatedAt: Number.isFinite(Number(source.updatedAt)) ? Number(source.updatedAt) : Date.now(),
  };
}

function parseColors(input: string) {
  const palette: Array<[string, string[]]> = [
    ['أسود', ['اسود']], ['ذهبي', ['ذهبي', 'ذهب']], ['أحمر', ['احمر', 'حمراء']], ['أزرق', ['ازرق', 'زرقاء']], ['أبيض', ['ابيض', 'بيضاء']], ['وردي', ['وردي', 'زهري']], ['أخضر', ['اخضر', 'خضراء']],
  ];
  return palette.filter(([, aliases]) => hasAny(input, aliases)).map(([color]) => color).slice(0, 4);
}

function inferMarketingPreferences(input: string): Partial<MarketingTextPreferences> {
  return {
    ...(hasAny(input, ['رسمي', 'فخم']) ? { tone: 'formal' as const } : hasAny(input, ['حماسي', 'مشوق', 'اقوى', 'افضل', 'احسن']) ? { tone: 'persuasive' as const } : hasAny(input, ['لطيف', 'مرح']) ? { tone: 'playful' as const } : {}),
    ...(hasAny(input, ['مختصر', 'قصير', 'قصير']) ? { length: 'short' as const } : hasAny(input, ['طويل', 'مفصل']) ? { length: 'long' as const } : {}),
    ...(hasAny(input, ['استفسار', 'واتساب', 'تواصل']) ? { goal: 'inquiry' as const } : hasAny(input, ['عرض', 'استعراض']) ? { goal: 'showcase' as const } : {}),
    ...(hasAny(input, ['واتساب', 'واتس']) ? { format: 'whatsapp' as const } : {}),
  };
}

export function parseMerchantCommands(raw: string): MerchantCommand[] {
  const input = normalizeArabic(raw);
  if (!input) return [{ type: 'unsupported', code: 'unknown' }];
  const commands: MerchantCommand[] = [];

  if (hasAny(input, ['اسم المحل فوق', 'اسم المتجر فوق', 'ضع اسم المحل فوق'])) commands.push({ type: 'unsupported', code: 'store-name-position' });
  if (hasAny(input, ['كبر السعر', 'خلي السعر كبير', 'السعر كبير'])) commands.push({ type: 'unsupported', code: 'price-size' });

  const themeAliases: Array<[TemplateVisualTheme, string[]]> = [
    ['midnight', ['ليلي', 'ليل', 'داكن']], ['rose', ['وردي', 'روز']], ['mint', ['نعناعي', 'مينت']], ['sand', ['رملي']], ['classic', ['كلاسيكي', 'تقليدي']],
  ];
  const matchedTheme = themeAliases.find(([, aliases]) => hasAny(input, aliases));
  if (matchedTheme && hasAny(input, ['قالب', 'نمط', 'ثيم', 'استخدم'])) commands.push({ type: 'set-visual-theme', theme: matchedTheme[0] });

  const asksForProduct = hasAny(input, ['صوره الملابس', 'صورة الملابس', 'القطعه', 'القطعة', 'الملابس', 'المنتج', 'كبرها', 'كبره', 'صغرها', 'صغره']);
  if (asksForProduct && hasAny(input, ['كبر', 'تكبير', 'اكبر', 'أكبر', 'زد الحجم', 'زيد الحجم'])) commands.push({ type: 'adjust-product-scale', direction: 'increase' });
  if (asksForProduct && hasAny(input, ['صغر', 'صغّر', 'اصغر', 'أصغر'])) commands.push({ type: 'adjust-product-scale', direction: 'decrease' });

  const visibility: Array<[MerchantVisibilityElement, string[]]> = [
    ['headline', ['العنوان', 'العنوان الرئيسي']], ['price', ['السعر']], ['productName', ['اسم المنتج']], ['discount', ['الخصم']], ['features', ['المميزات', 'المزايا']], ['storeInfo', ['الشعار النصي', 'اسم المتجر', 'معلومات المتجر', 'التذييل', 'تذييل', 'الفوتر', 'شريط المتجر']], ['storeLogo', ['الشعار الصوري', 'الشعار الصورة', 'شعار المتجر']],
  ];
  const hideActions = ['لا تظهر', 'اخف', 'اخفي', 'اخفاء', 'احذف', 'حذف', 'شيل'];
  const showActions = ['اظهر', 'اعرض', 'اضف', 'اضافه', 'رجع'];
  const allVisibilityActions = [...hideActions, ...showActions];
  const hasActionForElement = (actions: string[], aliases: string[]) => aliases.some(alias => {
    const normalizedAlias = normalizeArabic(alias);
    return actions.some(action => {
      if (input.includes(`${action} ${normalizedAlias}`) || input.includes(`${normalizedAlias} ${action}`)) return true;
      const actionIndex = input.indexOf(`${action} `);
      if (actionIndex < 0) return false;
      const afterAction = input.slice(actionIndex + action.length + 1);
      const nextActionIndex = allVisibilityActions.filter(nextAction => nextAction !== action).map(nextAction => afterAction.indexOf(`${nextAction} `)).filter(index => index >= 0).reduce((nearest, index) => Math.min(nearest, index), Number.POSITIVE_INFINITY);
      return afterAction.slice(0, Number.isFinite(nextActionIndex) ? nextActionIndex : undefined).includes(normalizedAlias);
    });
  });
  visibility.forEach(([element, aliases]) => {
    if (hasActionForElement(hideActions, aliases)) commands.push({ type: 'set-element-visibility', element, visible: false });
    else if (hasActionForElement(showActions, aliases)) commands.push({ type: 'set-element-visibility', element, visible: true });
  });
  if (hasAny(input, ['الشعار']) && !hasAny(input, ['الشعار النصي', 'الشعار الصوري', 'شعار المتجر'])) {
    if (hasAny(input, hideActions)) commands.push({ type: 'set-element-visibility', element: 'storeInfo', visible: false }, { type: 'set-element-visibility', element: 'storeLogo', visible: false });
    if (hasAny(input, showActions)) commands.push({ type: 'set-element-visibility', element: 'storeInfo', visible: true }, { type: 'set-element-visibility', element: 'storeLogo', visible: true });
  }

  const colors = parseColors(input);
  if (colors.length > 0 && hasAny(input, ['الواني', 'ألواني', 'الوان', 'ألوان', 'لون'])) commands.push({ type: 'set-default-colors', colors });
  const nameMatch = raw.match(/(?:اسم\s+(?:المحل|المتجر)|اسمنا)\s*(?:هو|:)?\s*([^،,.\n]{2,60})/i);
  if (nameMatch) commands.push({ type: 'set-store-field', field: 'storeName', value: cleanText(nameMatch[1]) });
  const phoneMatch = raw.match(/(?:رقم(?:نا)?|واتساب)\s*(?:هو|:)?\s*([+0-9\s-]{6,32})/i);
  if (phoneMatch) commands.push({ type: 'set-store-field', field: 'storePhone', value: cleanText(phoneMatch[1], 32) });

  const headlineMatch = raw.match(/(?:غي[ّ]?ر|اكتب|ضع|اجعل)\s+(?:العنوان(?:\s+الرئيسي)?)\s*(?:إلى|الى|:|هو)\s*([^،,.\n]{3,90})/i);
  if (headlineMatch) commands.push({ type: 'set-ad-field', field: 'headline', value: cleanText(headlineMatch[1], 90) });
  const productNameMatch = raw.match(/(?:غي[ّ]?ر|اكتب|ضع|اجعل)\s+(?:اسم\s+المنتج)\s*(?:إلى|الى|:|هو)\s*([^،,.\n]{2,90})/i);
  if (productNameMatch) commands.push({ type: 'set-ad-field', field: 'productName', value: cleanText(productNameMatch[1], 90) });

  const mentionsMarketingText = hasAny(input, ['النص التسويقي', 'الوصف التسويقي', 'كلام تسويقي', 'عباره تسويقيه']);
  if (mentionsMarketingText && hasAny(input, ['غير', 'حسن', 'حسنه', 'اكتب', 'جدد', 'افضل', 'احسن', 'اقوى', 'اعد'])) commands.push({ type: 'regenerate-marketing-text', preferences: inferMarketingPreferences(input) });

  const unique = commands.filter((command, index) => index === commands.findIndex(candidate => JSON.stringify(candidate) === JSON.stringify(command)));
  return unique.length > 0 ? unique : [{ type: 'unsupported', code: 'unknown' }];
}

export type MerchantCommandApplication = {
  template: TemplateSettings;
  profile: MerchantProfile;
  detailsPatch: Partial<AdDetails>;
  applied: MerchantCommand[];
  unsupported: MerchantUnsupportedCode[];
};

export function applyMerchantCommands(template: TemplateSettings, profile: MerchantProfile, commands: MerchantCommand[], details?: AdDetails): MerchantCommandApplication {
  let nextTemplate = { ...template };
  let nextProfile = normalizeMerchantProfile(profile);
  let detailsPatch: Partial<AdDetails> = {};
  const applied: MerchantCommand[] = [];
  const unsupported: MerchantUnsupportedCode[] = [];

  commands.forEach(command => {
    if (command.type === 'unsupported') {
      unsupported.push(command.code);
      if (command.code !== 'unknown') nextProfile = { ...nextProfile, unsupportedRequests: { ...nextProfile.unsupportedRequests, [command.code]: Math.min(1_000, (nextProfile.unsupportedRequests[command.code] || 0) + 1) } };
      return;
    }
    if (command.type === 'set-visual-theme') {
      nextTemplate = { ...nextTemplate, visualTheme: command.theme };
      nextProfile = { ...nextProfile, preferredTheme: command.theme };
    }
    if (command.type === 'adjust-product-scale') {
      const current = nextTemplate.productScale ?? DEFAULT_PRODUCT_SCALE;
      const delta = command.direction === 'increase' ? PRODUCT_SCALE_STEP : -PRODUCT_SCALE_STEP;
      const scale = Math.min(PRODUCT_SCALE_MAX, Math.max(PRODUCT_SCALE_MIN, Math.round((current + delta) * 100) / 100));
      nextTemplate = { ...nextTemplate, productScale: scale };
      nextProfile = { ...nextProfile, preferredProductScale: scale };
    }
    if (command.type === 'set-element-visibility') {
      nextTemplate = { ...nextTemplate, [VISIBILITY_FIELDS[command.element]]: command.visible };
      const hidden = new Set(nextProfile.hiddenElements);
      if (command.visible) hidden.delete(command.element); else hidden.add(command.element);
      nextProfile = { ...nextProfile, hiddenElements: Array.from(hidden) };
    }
    if (command.type === 'set-store-field') {
      nextProfile = { ...nextProfile, [command.field]: cleanText(command.value, command.field === 'storePhone' ? 32 : 80) };
      if (command.field === 'storeName' || command.field === 'storePhone') detailsPatch = { ...detailsPatch, [command.field]: nextProfile[command.field] };
    }
    if (command.type === 'set-default-colors') {
      nextProfile = { ...nextProfile, defaultColors: uniqueColors(command.colors) };
      detailsPatch = { ...detailsPatch, colors: nextProfile.defaultColors };
    }
    if (command.type === 'set-ad-field') detailsPatch = { ...detailsPatch, [command.field]: cleanText(command.value, 90) };
    if (command.type === 'regenerate-marketing-text' && details) {
      const preferences = resolveMarketingTextPreferences({ ...details.marketingPreferences, ...command.preferences });
      const result = generateLocalMarketingText({ ...details, ...detailsPatch, marketingPreferences: preferences }, preferences, nextProfile.appliedCommandCount + applied.length);
      detailsPatch = { ...detailsPatch, marketingText: result.text, marketingPreferences: preferences, marketingTextEngine: 'local' };
    }
    applied.push(command);
  });

  nextProfile = { ...nextProfile, appliedCommandCount: Math.min(1_000, nextProfile.appliedCommandCount + applied.length), updatedAt: Date.now() };
  return { template: nextTemplate, profile: nextProfile, detailsPatch, applied, unsupported };
}

export function describeMerchantCommands(commands: MerchantCommand[]) {
  const visibilityNames: Record<MerchantVisibilityElement, string> = {
    headline: 'العنوان', price: 'السعر', productName: 'اسم المنتج', discount: 'الخصم', features: 'المميزات', storeInfo: 'الشعار النصي والتذييل ومعلومات المتجر', storeLogo: 'الشعار الصوري',
  };
  const descriptions = commands.map(command => {
    if (command.type === 'set-visual-theme') return `سأغيّر النمط إلى ${command.theme}.`;
    if (command.type === 'adjust-product-scale') return command.direction === 'increase' ? 'سأكبّر القطعة خطوة واحدة داخل المساحة الآمنة، مع إبقاء السعر والتذييل واضحين.' : 'سأصغّر القطعة خطوة واحدة مع الحفاظ على توازن الإعلان.';
    if (command.type === 'set-element-visibility') return command.visible ? `سأُظهر ${visibilityNames[command.element]} في الإعلان.` : `سأُخفي ${visibilityNames[command.element]} من الإعلان.`;
    if (command.type === 'set-store-field') return 'سأحدّث معلومة المتجر المحددة محلياً.';
    if (command.type === 'set-default-colors') return `سأحفظ الألوان المفضلة: ${command.colors.join('، ')}.`;
    if (command.type === 'set-ad-field') return command.field === 'headline' ? `سأحدّث العنوان إلى: ${command.value}.` : `سأحدّث اسم المنتج إلى: ${command.value}.`;
    if (command.type === 'regenerate-marketing-text') return 'سأعيد صياغة النص التسويقي محلياً اعتماداً على بيانات الإعلان الموجودة، من دون اختلاق خصم أو معلومات جديدة.';
    if (command.code === 'price-size') return 'فهمت رغبتك في تكبير السعر. هذا التحكم غير متاح بأمان الآن، لذلك لن أغيّر التصميم عشوائياً. أستطيع بدلاً من ذلك تحسين النص التسويقي أو حجم القطعة أو العناصر الظاهرة.';
    if (command.code === 'store-name-position') return 'فهمت أنك تريد تغيير موضع اسم المتجر. هذا الموضع ثابت حالياً لحماية توازن القالب، لذلك لن أحرّكه عشوائياً. يمكنني إظهار الشعار أو إخفاؤه أو تحديث بيانات المتجر.';
    return 'فهمت أنك تريد تحسين الإعلان، لكنني لا أريد أن أغيّر شيئاً بالحدس. أستطيع الآن تكبير أو تصغير القطعة، إظهار أو إخفاء العناصر، تغيير العنوان، أو تحسين النص التسويقي محلياً.';
  });
  return descriptions.join('\n');
}

export function createMerchantAssistantTask(session: MerchantAssistantSession, request: string, commands: MerchantCommand[]) {
  const now = Date.now();
  const summary = describeMerchantCommands(commands);
  const actionable = commands.some(command => command.type !== 'unsupported');
  const task: MerchantAssistantTask = { id: createId('task', now), request: cleanText(request, 240), summary, commands, status: actionable ? 'awaiting-confirmation' : 'needs-guidance', createdAt: now };
  return normalizeMerchantAssistantSession({
    version: 1,
    messages: [...session.messages, createMessage('user', request, now), createMessage('assistant', summary, now + 1)],
    tasks: [...session.tasks, task],
    updatedAt: now,
  });
}

export function appendMerchantAssistantMessage(session: MerchantAssistantSession, role: MerchantAssistantMessage['role'], content: string) {
  const now = Date.now();
  return normalizeMerchantAssistantSession({
    version: 1,
    messages: [...session.messages, createMessage(role, content, now)],
    tasks: session.tasks,
    updatedAt: now,
  });
}

export function completeMerchantAssistantTask(session: MerchantAssistantSession, taskId: string, status: Extract<MerchantAssistantTaskStatus, 'applied' | 'failed'>) {
  const now = Date.now();
  const task = session.tasks.find(item => item.id === taskId);
  const reply = status === 'applied'
    ? 'تم تنفيذ المهمة محلياً وحُفظت في سجل الإعلان. سأعيدك إلى القالب النهائي الآن، ويمكنك الرجوع إليّ لاحقاً لطلب تعديل آخر من دون فقدان هذا التغيير.'
    : 'لم يكتمل تطبيق المهمة، لذلك أبقيت الإعلان كما هو. يمكنك تعديل الطلب أو المحاولة مرة أخرى.';
  return normalizeMerchantAssistantSession({
    version: 1,
    messages: [...session.messages, createMessage('assistant', reply, now)],
    tasks: session.tasks.map(item => item.id === taskId ? { ...item, status, completedAt: now } : item),
    updatedAt: now,
  });
}

export function buildDeveloperInsight(profile: MerchantProfile) {
  const requests = profile.unsupportedRequests;
  if ((requests['price-size'] || 0) > 0) return 'اقتراح محلي للمطور: طلب التاجرون التحكم في حجم السعر، لكن هذا الخيار غير مدعوم في العقد الحالي. لا تُرسل هذه الملاحظة تلقائياً.';
  if ((requests['store-name-position'] || 0) > 0) return 'اقتراح محلي للمطور: طُلب تغيير موضع اسم المتجر، وهو غير مدعوم في العقد الحالي. لا تُرسل هذه الملاحظة تلقائياً.';
  return 'لا توجد ملاحظة تحسين متكررة بعد. ستظهر هنا فقط طلبات غير مدعومة وبصورة مجمعة.';
}
