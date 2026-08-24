/**
 * Core Types for Clothing Ad Generator
 * All types are shared between client and server
 */

// ========== Product Data Types ==========
export interface ProductData {
  id?: string;
  productName: string;
  subtitle: string;
  storeName: string;
  oldPrice: string;
  newPrice: string;
  currency: string;
  season?: string;
  colors?: string[];
  sizes?: string[];
  quantity?: number;
  description?: string;
}

// ========== Three-step Ad Workflow ==========
/**
 * Data entered by a regular user on the second screen. Every field is optional
 * so the local poster can always be generated from the uploaded garment image.
 */
export interface AdDetails {
  productName: string;
  headline: string;
  discount: string;
  quantity: string;
  colors: string[];
  price: string;
  currency: string;
  features: string[];
  storeName: string;
  storePhone: string;
  storeLocation?: string;
  storeCategory?: string;
  marketingText: string;
  marketingPreferences?: MarketingTextPreferences;
  marketingTextEngine?: MarketingTextEngine;
}

export type MarketingTextTone = 'exciting' | 'persuasive' | 'formal' | 'playful';
export type MarketingTextLength = 'short' | 'medium' | 'long';
export type MarketingTextGoal = 'purchase' | 'inquiry' | 'showcase';
export type MarketingTextEngine = 'local' | 'cloud';
export type MarketingTextFormat = 'whatsapp' | 'plain';
export type MarketingTextCampaign = 'professional' | 'passion' | 'persuasive' | 'new-arrival' | 'eid-fitr' | 'eid-adha' | 'festival' | 'women';
export type MarketingTextEmphasis = 'normal' | 'bold' | 'featured';

/** اختيارات توليد النص، وهي اختيارية حتى تبقى المسودات القديمة متوافقة. */
export interface MarketingTextPreferences {
  tone: MarketingTextTone;
  length: MarketingTextLength;
  goal: MarketingTextGoal;
  format: MarketingTextFormat;
  campaign: MarketingTextCampaign;
  emphasis: MarketingTextEmphasis;
}

export type AdWorkflowStep = 'upload' | 'details' | 'final';

export type TryOnStatus = 'idle' | 'processing' | 'success' | 'fallback' | 'unavailable';

/** اختيارات محدودة يتحول كل منها إلى Prompt ثابت على الخادم؛ لا تستقبل الواجهة وصفاً حراً للمزود. */
export type TryOnPresentation = 'women-fashion' | 'men-fashion' | 'kids-fashion' | 'accessories';
export type TryOnPose = 'studio-standing' | 'lifestyle-standing';

export interface TryOnResult {
  status: TryOnStatus;
  imageUrl?: string;
  message: string;
  providerId?: string;
  isTransparent?: boolean;
  transparentSubject?: 'person' | 'garment';
}

// ========== Batch advertisement workflow ==========
export const BATCH_MAX_IMAGES = 10;
export const BATCH_EXPIRY_MS = 24 * 60 * 60 * 1000;
export type BatchItemStatus = 'ready' | 'preparing' | 'processing' | 'success' | 'failed' | 'stopped';

/** بيانات عنصر واحد في دفعة محلية؛ تحفظ الصور نفسها في IndexedDB وليس localStorage. */
export interface BatchAdItem {
  id: string;
  fileName: string;
  sourceUrl: string;
  thumbnailUrl: string;
  status: BatchItemStatus;
  outputUrl?: string;
  error?: string;
  /** وصف قصير لمرحلة المعالجة المحلية الجارية لهذه الصورة. */
  progressMessage?: string;
  usedLocalRemoval?: boolean;
  /** بيانات أساسية خاصة بهذه الصورة؛ عند غيابها تستخدم الدفعة البيانات المشتركة. */
  details?: Partial<Pick<AdDetails, 'productName' | 'headline' | 'discount' | 'price' | 'quantity' | 'colors'>>;
  /** نص مستقل اختياري لهذا الإعلان عند اعتماد وضع النصوص الفردية. */
  marketingText?: string;
  /** اقتراح محلي مستقل لهذه الصورة؛ لا يحتوي على الصورة ولا يُرسل للخادم. */
  designSuggestion?: DesignSuggestion;
  /** لا يطبق اقتراح الدفعة على Canvas إلا بعد لمس المستخدم لهذا الخيار. */
  designSuggestionApplied?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface BatchAdDraft {
  id: string;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  details: AdDetails;
  template: TemplateSettings;
  useLocalBackgroundRemoval: boolean;
  marketingTextMode?: BatchMarketingTextMode;
  items: BatchAdItem[];
}

export type BatchMarketingTextMode = 'shared' | 'perItem';

export type TemplateSize = 'portrait' | 'square' | 'story' | 'whatsapp' | 'landscape';

// ========== Local design intelligence ==========
/** موضع نسبي داخل منطقة بطل الإعلان وليس داخل كامل Canvas. */
export interface GarmentDesignTransform {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type DesignQualityVerdict = 'excellent' | 'good' | 'usable' | 'needs-attention';

export interface DesignColorSwatch {
  hex: string;
  label: string;
  weight: number;
}

/** سبب صريح قابل للعرض؛ الأرقام ناتجة من قواعد محلية وليست من مزود خارجي. */
export interface DesignDecisionReason {
  title: string;
  explanation: string;
  metrics: Record<string, number>;
}

export interface DesignLayoutCandidate {
  size: TemplateSize;
  score: number;
  garmentTransform: GarmentDesignTransform;
  reasons: DesignDecisionReason[];
}

/** نتيجة هندسية قابلة للتفسير تمنع تداخل منطقة القطعة مع النصوص والشعار والسعر. */
export interface CompositionScore {
  size: TemplateSize;
  score: number;
  metrics: Record<string, number>;
  reason: DesignDecisionReason;
  garmentTransform: GarmentDesignTransform;
}

/** تفضيلات صغيرة محلية فقط؛ لا تحتوي صورة أو بيانات متجر أو أي مفتاح. */
export interface PreferenceProfile {
  version: 1;
  enabled: boolean;
  acceptedLayouts: Partial<Record<TemplateSize, number>>;
  rejectedLayouts: Partial<Record<TemplateSize, number>>;
  updatedAt: number;
}

/**
 * ناتج محلل التصميم المحلي. يحفظ metadata صغيرة فقط ولا يحتوي على الصورة أو أي مفتاح.
 * الإصدار يجعل المسودات القديمة قابلة للاسترجاع بأمان.
 */
export interface DesignSuggestion {
  version: 1;
  status: 'ready' | 'degraded';
  generatedAt: number;
  confidence: number;
  warnings: string[];
  quality: { score: number; verdict: DesignQualityVerdict; brightness: number; contrast: number; sharpness: number };
  foreground: { x: number; y: number; width: number; height: number; coverage: number };
  crop: { x: number; y: number; width: number; height: number; safeMargin: number };
  colors: DesignColorSwatch[];
  suggestedBackground: string;
  suggestedTextColor: string;
  selectedLayout: TemplateSize;
  candidates: DesignLayoutCandidate[];
  suggestedText: string;
  /** درجات تكوين اختيارية مضافة للإصدارات الحديثة؛ تبقى المسودات القديمة متوافقة. */
  compositionScores?: CompositionScore[];
  preferenceApplied?: boolean;
}
export type TemplateBadgeType = 'none' | 'discount' | 'new' | 'offer' | 'price' | 'quality';
/** حجم القطعة داخل مساحتها الآمنة؛ يحمي القص من التداخل مع عناصر القالب. */
export const PRODUCT_SCALE_MIN = 0.72;
export const PRODUCT_SCALE_MAX = 1.16;
export const PRODUCT_SCALE_STEP = 0.04;
export const DEFAULT_PRODUCT_SCALE = 0.92;
/** نمط بصري محلي مستقل عن مقاس التصدير؛ يبقى اختياريًا لتوافق المسودات القديمة. */
export type TemplateVisualTheme = 'classic' | 'midnight' | 'rose' | 'mint' | 'sand';
/** خلفية استديو محلية داخل منطقة المنتج؛ لا تتطلب نموذج صور أو اتصالاً خارجياً. */
export type ProductStudioBackdrop = 'auto' | 'soft' | 'warm' | 'cool' | 'spotlight' | 'rose' | 'sand' | 'plum' | 'peach' | 'blush' | 'navy' | 'denim' | 'sky' | 'teal' | 'mint' | 'sage' | 'lemon' | 'coral' | 'charcoal' | 'ivory' | 'lavender';
/** ظل هندسي محلي يوضع أسفل المنتج الشفاف داخل مساحة البطل. */
export type ProductShadowPreset = 'none' | 'soft' | 'grounded';
/** بروز بصري محلي خفيف؛ ليس نموذج 3D ولا ينشئ زوايا أو محتوى جديداً. */
export type ProductPresentationEffect = 'flat' | 'lifted' | 'platform';
/** موضع نسبي داخل قالب غرفة الملابس لطبقة نص اختيارية. */
export interface StudioOverlayPosition { x: number; y: number; }
export type ArtworkLayerKey = 'header' | 'footer' | 'logo';
export type ArtworkFitMode = 'contain' | 'cover' | 'stretch';

/** موضع وحجم نسبيان داخل مساحة الإعلان، حتى يحفظان بصورة مستقلة لكل مقاس تصدير. */
export interface ArtworkLayerTransform {
  x: number;
  y: number;
  width: number;
  height: number;
  fit: ArtworkFitMode;
}

export type ArtworkLayoutsBySize = Partial<Record<TemplateSize, Partial<Record<ArtworkLayerKey, ArtworkLayerTransform>>>>;

/** Settings exposed to the regular user. AI providers and API keys are deliberately excluded. */
export interface TemplateSettings {
  size: TemplateSize;
  visualTheme?: TemplateVisualTheme;
  showProductName: boolean;
  showHeadline: boolean;
  showDiscount: boolean;
  showQuantity: boolean;
  showColors: boolean;
  showFeatures: boolean;
  showPrice: boolean;
  showStoreInfo: boolean;
  showFrame: boolean;
  showQualityMark: boolean;
  badgeType: TemplateBadgeType;
  /** قائمة الشارات المختارة؛ يبقى badgeType لقراءة الإعدادات القديمة. */
  badgeTypes?: Array<Exclude<TemplateBadgeType, 'none'>>;
  badgeText: string;
  showHeaderArtwork: boolean;
  headerArtwork?: string;
  showStoreLogo: boolean;
  storeLogoArtwork?: string;
  showFooterArtwork: boolean;
  footerArtwork?: string;
  artworkLayouts?: ArtworkLayoutsBySize;
  /** لون خلفية اختياري اعتمده المستخدم من اقتراح المصمم المحلي. */
  smartBackgroundColor?: string;
  /** لون نص اختياري اعتمده المستخدم من اقتراح المصمم المحلي. */
  smartTextColor?: string;
  /** تحويل اختياري للقطعة اعتمده المستخدم من اقتراح المصمم المحلي. */
  smartGarmentTransform?: GarmentDesignTransform;
  /** تكبير مرئي للقطعة داخل منطقتها الآمنة، من دون تغيير مكان السعر أو التذييل. */
  productScale?: number;
  productBackdrop?: ProductStudioBackdrop;
  productShadow?: ProductShadowPreset;
  productPresentation?: ProductPresentationEffect;
  /** نص اختياري في أعلى قالب غرفة الملابس؛ يبقى القالب خالياً عند غيابه. */
  studioCaption?: string;
  studioCaptionTextColor?: string;
  /** اتركها فارغة أو transparent لعرض النص من دون شارة خلفية. */
  studioCaptionBackgroundColor?: string;
  studioCaptionPosition?: StudioOverlayPosition;
  /** سعر اختياري في أسفل قالب غرفة الملابس؛ لا يعتمد على بيانات الإعلان القديمة. */
  studioPrice?: string;
  studioPriceTextColor?: string;
  studioPriceBackgroundColor?: string;
  studioPricePosition?: StudioOverlayPosition;
  /** وضع غرفة الملابس: يرسم المنتج المفصول داخل خلفية كاملة بلا بيانات أو شارات أو طبقات إعلان. */
  wardrobeStudio?: boolean;
}

// ========== Store Settings ==========
export interface StoreSettings {
  storeName: string;
  storePhone: string;
  storeLocation: string;
  storeCategory?: string;
  storeLogo?: string;
  defaultCurrency: string;
  defaultColors?: string[];
  defaultFonts?: {
    title: string;
    subtitle: string;
    body: string;
  };
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  showQualityBadge: boolean;
  showDiscount: boolean;
}

// ========== Canvas Settings ==========
export interface CanvasSettings extends StoreSettings {
  productName: string;
  subtitle: string;
  oldPrice: string;
  newPrice: string;
  currency: string;
  season?: string;
  colors?: string[];
  sizes?: string[];
  quantity?: number;
}

// ========== AI Provider Configuration ==========
export interface AIProvider {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  enabled: boolean;
  type?: 'text' | 'image' | 'both';
}

/** Public provider metadata shown to the authenticated developer. API keys are never returned. */
export interface DeveloperProviderSummary {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  enabled: boolean;
  hasApiKey: boolean;
  updatedAt: number;
}

// ========== Subscription Token ==========
export interface SubscriptionToken {
  id: string;
  token: string;
  createdAt: number;
  expiresAt?: number;
  isActive: boolean;
  usageCount: number;
  maxUsage?: number;
}

// ========== User Preferences ==========
export interface UserPreferences {
  theme: 'light' | 'dark';
  language: 'ar' | 'en';
  notifications: boolean;
  autoSave: boolean;
  defaultFormat: 'png' | 'jpg' | 'webp';
}

// ========== Generated Ad ==========
export interface GeneratedAd {
  id: string;
  imageUrl: string;
  productData: ProductData;
  settings: CanvasSettings;
  createdAt: number;
  updatedAt: number;
  shareCount: number;
  downloadCount: number;
}

// ========== API Response Types ==========
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface TextGenerationResponse {
  text: string;
  title?: string;
  description?: string;
  keywords?: string[];
}

export interface ImageGenerationResponse {
  imageUrl: string;
  imageBase64?: string;
  format: string;
  width: number;
  height: number;
}

// ========== Developer Panel Types ==========
export interface DeveloperPanelState {
  unlocked: boolean;
  password: string;
  devKey: string;
  lastAccessTime?: number;
  accessCount: number;
}

// ========== Canvas Render Options ==========
export interface CanvasRenderOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'png' | 'jpg' | 'webp';
  includeWatermark?: boolean;
}

// ========== Share Options ==========
export interface ShareOptions {
  platform: 'whatsapp' | 'email' | 'clipboard' | 'download';
  includeCaption: boolean;
  caption?: string;
  fileName?: string;
}

// ========== Error Types ==========
export interface AppError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: number;
}

// ========== Notification Types ==========
export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// ========== Local Storage Keys ==========
export enum StorageKeys {
  STORE_SETTINGS = 'clothing_ad_store_settings',
  AI_PROVIDERS = 'clothing_ad_ai_providers',
  SUBSCRIPTION_TOKENS = 'clothing_ad_subscription_tokens',
  USER_PREFERENCES = 'clothing_ad_user_preferences',
  GENERATED_ADS = 'clothing_ad_generated_ads',
  DEVELOPER_STATE = 'clothing_ad_developer_state',
  LAST_PRODUCT_DATA = 'clothing_ad_last_product_data',
  LAST_AD_DETAILS = 'clothing_ad_last_ad_details',
  TEMPLATE_SETTINGS = 'clothing_ad_template_settings',
  LAST_WORKFLOW_STEP = 'clothing_ad_last_workflow_step',
  LAST_APP_SECTION = 'clothing_ad_last_app_section',
  DESIGN_SUGGESTION = 'clothing_ad_design_suggestion_v1',
  DESIGN_HISTORY = 'clothing_ad_design_history_v1',
  LOCAL_ANALYSIS_CACHE = 'clothing_ad_local_analysis_cache_v1',
  DESIGN_QUALITY_BASELINE = 'clothing_ad_design_quality_baseline_v1',
  MERCHANT_PROFILE = 'clothing_ad_merchant_profile_v1',
  MERCHANT_ASSISTANT_SESSION = 'clothing_ad_merchant_assistant_session_v1',
}

// ========== Constants ==========
export const DEFAULT_CANVAS_WIDTH = 1080;
export const DEFAULT_CANVAS_HEIGHT = 1350;
export const DEFAULT_CURRENCY = 'ريال';
export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  storeName: 'متجري',
  storePhone: '',
  storeLocation: '',
  defaultCurrency: DEFAULT_CURRENCY,
  backgroundColor: '#FFFFFF',
  textColor: '#000000',
  accentColor: '#C41A1A',
  showQualityBadge: true,
  showDiscount: true,
};

export const DEFAULT_AD_DETAILS: AdDetails = {
  productName: '',
  headline: '',
  discount: '',
  quantity: '',
  colors: [],
  price: '',
  currency: DEFAULT_CURRENCY,
  features: [],
  storeName: '',
  storePhone: '',
  storeLocation: '',
  storeCategory: '',
  marketingText: '',
  marketingPreferences: {
    tone: 'persuasive',
    length: 'medium',
    goal: 'purchase',
    format: 'whatsapp',
    campaign: 'professional',
    emphasis: 'featured',
  },
  marketingTextEngine: 'local',
};

export const DEFAULT_TEMPLATE_SETTINGS: TemplateSettings = {
  size: 'portrait',
  visualTheme: 'classic',
  showProductName: true,
  showHeadline: true,
  showDiscount: true,
  showQuantity: true,
  showColors: true,
  showFeatures: false,
  showPrice: true,
  showStoreInfo: true,
  showFrame: false,
  showQualityMark: false,
  badgeType: 'none',
  badgeTypes: [],
  badgeText: '',
  showHeaderArtwork: false,
  headerArtwork: '',
  showStoreLogo: false,
  storeLogoArtwork: '',
  showFooterArtwork: false,
  footerArtwork: '',
  artworkLayouts: {},
  productScale: DEFAULT_PRODUCT_SCALE,
  productBackdrop: 'soft',
  productShadow: 'grounded',
  productPresentation: 'flat',
  studioCaption: '',
  studioCaptionTextColor: '#111827',
  studioCaptionBackgroundColor: '',
  studioCaptionPosition: { x: .73, y: .055 },
  studioPrice: '',
  studioPriceTextColor: '#111827',
  studioPriceBackgroundColor: '',
  studioPricePosition: { x: .78, y: .89 },
};

export const DISCOUNT_BADGE_COLOR = '#C41A1A';
export const DISCOUNT_BADGE_GOLD = '#F5C200';
export const FOOTER_COLOR = '#8B0000';
export const QUALITY_BADGE_COLOR = '#4CAF50';
