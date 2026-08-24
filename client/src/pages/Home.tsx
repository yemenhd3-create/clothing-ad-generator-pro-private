import * as React from 'react';
import { useEffect, useState } from 'react';
import type { AdDetails, AdWorkflowStep, DesignSuggestion, MarketingTextCampaign, MarketingTextEmphasis, MarketingTextLength, MarketingTextPreferences, ProductStudioBackdrop, StudioOverlayPosition, TemplateSettings, TemplateSize, TryOnResult } from '@shared/types';
import {
  DEFAULT_AD_DETAILS,
  DEFAULT_PRODUCT_SCALE,
  DEFAULT_TEMPLATE_SETTINGS,
  PRODUCT_SCALE_MAX,
  PRODUCT_SCALE_MIN,
  PRODUCT_SCALE_STEP,
  StorageKeys,
} from '@shared/types';
import {
  buildMarketingText,
  getCanvasDimensions,
} from '@shared/adWorkflow';
import { DEFAULT_MARKETING_TEXT_PREFERENCES, MARKETING_TEXT_CAMPAIGN_LABELS, MARKETING_TEXT_EMPHASIS_LABELS, generateLocalMarketingText, resolveMarketingTextPreferences } from '@shared/marketingText';
import ImageUploader from '@/components/ImageUploader';
import { TryOnOptIn, type TryOnSelection } from '@/components/TryOnOptIn';
import LocalDesignSuggestionCard from '@/components/LocalDesignSuggestionCard';
import PwaInstallPrompt from '@/components/PwaInstallPrompt';
import DesignPassportCard from '@/components/DesignPassportCard';
import DesignContractCard from '@/components/DesignContractCard';
import { renderAd } from '@/lib/canvasRenderer';
import { createDesignPassport, passportFilename, passportToJson, type DesignPassport } from '@/lib/designPassport';
import { applyDesignDocument, applyDesignRepair, compileDesignDocument } from '@/lib/designCompiler';
import { evaluateDesignContract } from '@/lib/designContract';
import { canExportDesign, evaluateDesignQuality, type DesignQualityReport } from '@/lib/designQualityGate';
import { inspectRenderedPixelTruth } from '@/lib/pixelTruthGate';
import { appendDesignHistory, createDesignHistory, designDocumentFingerprint, parseDesignHistory, redoDesignHistory, removeDesignHistoryEntry, replayDesignHistory, serializeDesignHistory, undoDesignHistory, type DesignHistoryDocument, type DesignHistoryEntry } from '@/lib/designHistory';
import { applyDesignSuggestion } from '@/lib/designSuggestionApplication';
import { buildDesignBenchmarks, createQualityFingerprint, detectDesignRegression } from '@/lib/designBenchmark';
import { createSuggestionFromMetrics } from '@/lib/localDesignIntelligence';
import { prepareLocalAnalysis } from '@/lib/localAnalysisCache';
import { clearPreferenceProfile, loadPreferenceProfile, recordLayoutPreference, setPreferenceEnabled } from '@/lib/localArtDirectorPreferences';
import { clearLocalBackgroundRemovalCache, prewarmLocalBackgroundRemoval, removeBackgroundLocally, type LocalRemovalStage } from '@/lib/localBackgroundRemoval';
import { formatLocalFirstDownloadSize, formatLocalModelSize, getLocalRemovalUnavailableMessage } from '@/lib/localBackgroundRemovalSupport';
import { createLocalToolSetupState, LOCAL_TOOL_READY_KEY, localToolSetupStateForStage, type LocalToolSetupState } from '@/lib/localRemovalSetup';
import { downloadImage, shareToWhatsApp, shareViaWebAPI } from '@/lib/share';
import { getWardrobeShareText } from '@/lib/wardrobeShare';
import { getWardrobeOverlayHelp } from '@/lib/wardrobeOverlayHelp';
import { getFromStorage, removeFromStorage, saveToStorage } from '@/lib/storage';
import { clearMerchantAssistantSession, clearMerchantProfile, loadMerchantAssistantSession, loadMerchantProfile, saveMerchantAssistantSession, saveMerchantProfile } from '@/lib/merchantMemory';
import { applyMerchantCommands, applyMerchantProfileToMarketingDetails, type MerchantAssistantSession, type MerchantCommand, type MerchantProfile } from '@shared/merchantAssistant';
import type { LocalProjectBackup } from '@/lib/localProjectBackup';
import { trpc } from '@/lib/trpc';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import type { DesignContractReport, DesignRepairId } from '@shared/designDocument';
import type { DesignBenchmark, DesignQualityFingerprint, DesignRegression } from '@shared/designBenchmark';
import {
  BadgeCheck,
  Check,
  ImagePlus,
  Images,
  LoaderCircle,
  MessageCircle,
  MessageSquareText,
  Palette,
  Pencil,
  RotateCcw,
  Send,
  Settings,
  Wrench,
  SlidersHorizontal,
  Sparkles,
  Bot,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Maximize2,
  Wand2,
  LayoutTemplate,
} from 'lucide-react';

const EMBEDDED_ANDROID_APP = import.meta.env.VITE_EMBEDDED_ANDROID_APP === 'true';
const LOGO_URL = EMBEDDED_ANDROID_APP ? '/app-logo.png' : '/manus-storage/marwan-designer-logo_df9b28d4.png';
const AboutApp = React.lazy(() => import('@/components/AboutApp'));
const BatchWorkspace = React.lazy(() => import('@/components/BatchWorkspace'));
const DeveloperWorkspace = React.lazy(() => import('@/components/DeveloperWorkspace'));
const AdDetailsForm = React.lazy(() => import('@/components/AdDetailsForm'));
const PersonalMessageCenter = React.lazy(() => import('@/components/PersonalMessageCenter'));
const SharePanel = React.lazy(() => import('@/components/SharePanel'));
const DesignQualityGateCard = React.lazy(() => import('@/components/DesignQualityGateCard'));
const TryOnStatusNotice = React.lazy(() => import('@/components/TryOnStatusNotice').then(module => ({ default: module.TryOnStatusNotice })));
const UserTemplateSettings = React.lazy(() => import('@/components/UserTemplateSettings'));
const MerchantAssistantWorkspace = React.lazy(() => import('@/components/MerchantAssistantWorkspace'));
const ImageRefinementStudio = React.lazy(() => import('@/components/ImageRefinementStudio'));
const EMPTY_AD_DETAILS: AdDetails = { ...DEFAULT_AD_DETAILS, features: [] };
/** يجعل النتيجة البصرية للقطعة هي المسار الافتراضي، ويؤجل الأدوات الثانوية عن المستخدم العادي. */
const WARDROBE_ROOM_MODE = import.meta.env.MODE !== 'test';
export const WARDROBE_SIZE_OPTIONS: Array<{ id: TemplateSize; ratio: string; label: string }> = [
  { id: 'portrait', ratio: '4:5', label: 'عمودي' },
  { id: 'square', ratio: '1:1', label: 'مربع' },
  { id: 'story', ratio: '9:16', label: 'قصة' },
  { id: 'whatsapp', ratio: '3:4', label: 'واتساب' },
  { id: 'landscape', ratio: '1.91:1', label: 'أفقي' },
];

export const WARDROBE_TEMPLATE_OPTIONS: Array<{ id: Exclude<ProductStudioBackdrop, 'auto'>; label: string; category: string; colors: [string, string] }> = [
  { id: 'soft', label: 'نظيف', category: 'أساسي', colors: ['#ffffff', '#efeaf8'] }, { id: 'warm', label: 'دافئ', category: 'أساسي', colors: ['#fffdf7', '#f4dfbd'] }, { id: 'cool', label: 'بارد', category: 'أساسي', colors: ['#fbfdff', '#dceefa'] }, { id: 'spotlight', label: 'إضاءة', category: 'أساسي', colors: ['#ffffff', '#e7ddf5'] },
  { id: 'rose', label: 'وردي', category: 'نسائي', colors: ['#fffafd', '#efd8e4'] }, { id: 'blush', label: 'ناعم', category: 'نسائي', colors: ['#fffafb', '#f2d8de'] }, { id: 'plum', label: 'بنفسجي', category: 'نسائي', colors: ['#fffaff', '#e7d8f0'] }, { id: 'peach', label: 'خوخي', category: 'بناتي', colors: ['#fffaf7', '#f5d7c8'] }, { id: 'lavender', label: 'ليلكي', category: 'بناتي', colors: ['#fbf9ff', '#e1daf5'] }, { id: 'coral', label: 'مرجاني', category: 'بناتي', colors: ['#fff9f7', '#f2d2c8'] },
  { id: 'navy', label: 'كحلي', category: 'رجالي', colors: ['#f8faff', '#d6ddef'] }, { id: 'denim', label: 'أزرق', category: 'رجالي', colors: ['#f7fbff', '#d2e6f3'] }, { id: 'charcoal', label: 'فحمي', category: 'رجالي', colors: ['#fafafa', '#dde0e4'] }, { id: 'sky', label: 'سماوي', category: 'ولادي', colors: ['#f7fdff', '#d3edf6'] }, { id: 'teal', label: 'تركواز', category: 'ولادي', colors: ['#f5fffe', '#d0ece7'] }, { id: 'lemon', label: 'أصفر', category: 'ولادي', colors: ['#fffef6', '#f6eab8'] },
  { id: 'mint', label: 'نعناع', category: 'مواليد', colors: ['#f8fffb', '#d9f0e3'] }, { id: 'ivory', label: 'كريمي', category: 'مواليد', colors: ['#fffdf7', '#eee4cf'] }, { id: 'sage', label: 'أخضر', category: 'شبابي', colors: ['#fbfdf8', '#dfe9cf'] }, { id: 'sand', label: 'رملي', category: 'شبابي', colors: ['#fffdf8', '#e6d8c2'] },
];

function createWardrobeTemplate(template: TemplateSettings): TemplateSettings {
  return {
    ...template,
    wardrobeStudio: true,
    showProductName: false, showHeadline: false, showDiscount: false, showQuantity: false, showColors: false,
    showFeatures: false, showPrice: false, showStoreInfo: false, showFrame: false, showQualityMark: false,
    badgeType: 'none', badgeTypes: [], showHeaderArtwork: false, showStoreLogo: false, showFooterArtwork: false,
  };
}

function createWardrobeDetails(): AdDetails { return { ...DEFAULT_AD_DETAILS, colors: [], features: [] }; }

const WORKFLOW_STEPS: Array<{ id: AdWorkflowStep; label: string }> = [
  { id: 'upload', label: 'رفع الملابس' },
  { id: 'details', label: 'بيانات الإعلان' },
  { id: 'final', label: 'الإعلان جاهز' },
];
const WORKFLOW_STEP_ICONS = { upload: ImagePlus, details: SlidersHorizontal, final: Send } as const;

function isWorkflowStep(value: string | null): value is AdWorkflowStep {
  return value === 'upload' || value === 'details' || value === 'final';
}

type MainApplicationSection = 'create' | 'batch' | 'assistant' | 'settings';
type ActiveView = MainApplicationSection | 'about' | 'developer' | 'messages';
type VisualRepairStatus = 'idle' | 'repairing' | 'verified' | 'blocked' | 'failed' | 'undone';
type WardrobeTool = 'backdrop' | 'templates' | 'shadow' | 'size' | 'format' | 'overlay' | 'marketing' | 'refine' | null;
type VisualRepairSnapshot = {
  templateSettings: TemplateSettings;
  generatedAdBlob: Blob;
  qualityGateReport: DesignQualityReport | null;
  designContractReport: DesignContractReport | null;
  marketingText: string;
};

function isMainApplicationSection(value: ActiveView): value is MainApplicationSection {
  return value === 'create' || value === 'batch' || value === 'assistant' || value === 'settings';
}

export default function Home({ friendTestMode = false }: { friendTestMode?: boolean }) {
  const [currentStep, setCurrentStep] = useState<AdWorkflowStep>('upload');
  const [productImage, setProductImage] = useState('');
  const [adDetails, setAdDetails] = useState<AdDetails>(DEFAULT_AD_DETAILS);
  const [templateSettings, setTemplateSettings] = useState<TemplateSettings>(DEFAULT_TEMPLATE_SETTINGS);
  const [generatedAd, setGeneratedAd] = useState('');
  const [lastVisualSource, setLastVisualSource] = useState('');
  const [marketingText, setMarketingText] = useState('');
  const [tryOnResult, setTryOnResult] = useState<TryOnResult>({
    status: 'idle',
    message: '',
  });
  const [tryOnPreview, setTryOnPreview] = useState<TryOnResult | null>(null);
  const [isTryOnRunning, setIsTryOnRunning] = useState(false);
  const tryOnRequestRef = React.useRef(0);
  const studioRenderRequestRef = React.useRef(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isReviewingImage, setIsReviewingImage] = useState(false);
  const [isRefinementStudioOpen, setIsRefinementStudioOpen] = useState(false);
  const [activeWardrobeTool, setActiveWardrobeTool] = useState<WardrobeTool>(null);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
  const [isStorageReady, setIsStorageReady] = useState(false);
  const [designSuggestion, setDesignSuggestion] = useState<DesignSuggestion | null>(null);
  const [selectedSuggestedSize, setSelectedSuggestedSize] = useState<TemplateSize>('portrait');
  const [preferenceProfile, setPreferenceProfile] = useState(() => loadPreferenceProfile());
  const [merchantProfile, setMerchantProfile] = useState(() => loadMerchantProfile());
  const [merchantAssistantSession, setMerchantAssistantSession] = useState<MerchantAssistantSession>(() => loadMerchantAssistantSession());
  const [templateBeforeSuggestion, setTemplateBeforeSuggestion] = useState<TemplateSettings | null>(null);
  const [comparisonPreviews, setComparisonPreviews] = useState<{ current: string; suggested: string } | null>(null);
  const [isDesignAnalyzing, setIsDesignAnalyzing] = useState(false);
  const [localPreparation, setLocalPreparation] = useState<{ status: 'idle' | 'analyzing' | 'ready' | 'failed'; cache?: 'hit' | 'miss'; elapsedMs?: number }>({ status: 'idle' });
  const [localToolSetup, setLocalToolSetup] = useState<LocalToolSetupState>(() => {
    if (!EMBEDDED_ANDROID_APP) return createLocalToolSetupState('ready');
    try {
      return localStorage.getItem(LOCAL_TOOL_READY_KEY) === 'ready' ? createLocalToolSetupState('ready') : createLocalToolSetupState('checking');
    } catch {
      return createLocalToolSetupState('checking');
    }
  });
  const [designBenchmarks, setDesignBenchmarks] = useState<DesignBenchmark[]>([]);
  const [designRegression, setDesignRegression] = useState<DesignRegression | null>(null);
  const [designPassport, setDesignPassport] = useState<DesignPassport | null>(null);
  const [isCreatingPassport, setIsCreatingPassport] = useState(false);
  const [designContractReport, setDesignContractReport] = useState<DesignContractReport | null>(null);
  const [isCheckingDesignContract, setIsCheckingDesignContract] = useState(false);
  const [qualityGateReport, setQualityGateReport] = useState<DesignQualityReport | null>(null);
  const [isCheckingQualityGate, setIsCheckingQualityGate] = useState(false);
  const [templateBeforeContractRepair, setTemplateBeforeContractRepair] = useState<TemplateSettings | null>(null);
  const [visualRepairSnapshot, setVisualRepairSnapshot] = useState<VisualRepairSnapshot | null>(null);
  const [visualRepairStatus, setVisualRepairStatus] = useState<VisualRepairStatus>('idle');
  const [designHistory, setDesignHistory] = useState<DesignHistoryDocument | null>(null);
  const [designRedoEntries, setDesignRedoEntries] = useState<DesignHistoryEntry[]>([]);
  const [activeView, setActiveView] = useState<ActiveView>(() => {
    if (WARDROBE_ROOM_MODE) return 'create';
    const saved = getFromStorage<MainApplicationSection>(StorageKeys.LAST_APP_SECTION);
    return saved === 'batch' || saved === 'assistant' || saved === 'settings' ? saved : 'create';
  });
  const [isQuickAccessOpen, setIsQuickAccessOpen] = useState(false);
  const marketingTextMutation = trpc.marketingText.generate.useMutation();
  const tryOnMutation = trpc.tryOn.run.useMutation();
  const connectedLeaderMutation = trpc.leader.connected.useMutation();
  const announcementQuery = trpc.personal.announcement.useQuery(undefined, { enabled: !friendTestMode });

  const prepareLocalTools = React.useCallback(async (force = false) => {
    setLocalToolSetup(createLocalToolSetupState('preparing'));
    try {
      if (force) {
        await clearLocalBackgroundRemovalCache();
        try { localStorage.removeItem(LOCAL_TOOL_READY_KEY); } catch { /* storage is optional */ }
      }
      await prewarmLocalBackgroundRemoval(stage => setLocalToolSetup(localToolSetupStateForStage(stage)));
      setLocalToolSetup(createLocalToolSetupState('success'));
      try { localStorage.setItem(LOCAL_TOOL_READY_KEY, 'ready'); } catch { /* storage is optional */ }
      window.setTimeout(() => setLocalToolSetup(createLocalToolSetupState('ready')), 900);
    } catch {
      setLocalToolSetup(createLocalToolSetupState('failed'));
    }
  }, []);

  useEffect(() => {
    if (EMBEDDED_ANDROID_APP && localToolSetup.status === 'checking') void prepareLocalTools();
  }, [localToolSetup.status, prepareLocalTools]);

  useEffect(() => {
    const savedDetails = getFromStorage<AdDetails>(StorageKeys.LAST_AD_DETAILS);
    const savedTemplate = getFromStorage<TemplateSettings>(StorageKeys.TEMPLATE_SETTINGS);
    const savedSuggestion = getFromStorage<DesignSuggestion>(StorageKeys.DESIGN_SUGGESTION);

    if (savedDetails) setAdDetails({ ...DEFAULT_AD_DETAILS, ...savedDetails });
    if (savedTemplate) setTemplateSettings({ ...DEFAULT_TEMPLATE_SETTINGS, ...savedTemplate });
    if (savedSuggestion?.version === 1) {
      setDesignSuggestion(savedSuggestion);
      setSelectedSuggestedSize(savedSuggestion.selectedLayout);
    }
    setHasRestoredDraft(Boolean(savedDetails && hasMeaningfulDraft(savedDetails)));
    setIsStorageReady(true);
  }, []);

  useEffect(() => {
    if (!isStorageReady) return;
    if (hasMeaningfulDraft(adDetails)) saveToStorage(StorageKeys.LAST_AD_DETAILS, adDetails);
    else removeFromStorage(StorageKeys.LAST_AD_DETAILS);
  }, [adDetails, isStorageReady]);

  useEffect(() => {
    if (!isStorageReady) return;
    saveToStorage(StorageKeys.TEMPLATE_SETTINGS, templateSettings);
  }, [templateSettings, isStorageReady]);

  useEffect(() => {
    if (!isStorageReady) return;
    if (designSuggestion) saveToStorage(StorageKeys.DESIGN_SUGGESTION, designSuggestion);
    else removeFromStorage(StorageKeys.DESIGN_SUGGESTION);
  }, [designSuggestion, isStorageReady]);

  useEffect(() => {
    if (!isStorageReady || !isMainApplicationSection(activeView)) return;
    saveToStorage(StorageKeys.LAST_APP_SECTION, activeView);
  }, [activeView, isStorageReady]);

  useEffect(() => {
    return () => {
      if (productImage.startsWith('blob:')) URL.revokeObjectURL(productImage);
    };
  }, [productImage]);

  useEffect(() => {
    return () => {
      if (generatedAd.startsWith('blob:')) URL.revokeObjectURL(generatedAd);
    };
  }, [generatedAd]);

  useEffect(() => {
    const openRefinementStudio = () => setIsRefinementStudioOpen(true);
    window.addEventListener('clothing-ad:open-refinement-studio', openRefinementStudio);
    return () => window.removeEventListener('clothing-ad:open-refinement-studio', openRefinementStudio);
  }, []);

  useEffect(() => {
    if (WARDROBE_ROOM_MODE || !productImage) return;
    let active = true;
    setIsDesignAnalyzing(true);
    setLocalPreparation({ status: 'analyzing' });
    void prepareLocalAnalysis(productImage).then(preparation => {
      if (!active) return;
      const suggestion = createSuggestionFromMetrics(preparation.metrics, adDetails);
      setDesignSuggestion(suggestion);
      setSelectedSuggestedSize(suggestion.selectedLayout);
      setLocalPreparation({ status: 'ready', cache: preparation.cache, elapsedMs: preparation.elapsedMs });
    }).catch(() => {
      if (active) {
        setDesignSuggestion(null);
        setLocalPreparation({ status: 'failed' });
      }
    }).finally(() => {
      if (active) setIsDesignAnalyzing(false);
    });
    return () => { active = false; };
  }, [productImage]);

  useEffect(() => {
    if (WARDROBE_ROOM_MODE || !productImage) return;
    const warm = () => { void prewarmLocalBackgroundRemoval().catch(() => undefined); };
    const idle = typeof window.requestIdleCallback === 'function'
      ? window.requestIdleCallback(warm, { timeout: 1_200 })
      : window.setTimeout(warm, 700);
    return () => {
      if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
    };
  }, [productImage]);

  useEffect(() => {
    if (!designSuggestion) { setDesignBenchmarks([]); setDesignRegression(null); return; }
    const benchmarks = buildDesignBenchmarks(adDetails, templateSettings, designSuggestion);
    setDesignBenchmarks(benchmarks);
    const selected = benchmarks.find(item => item.template === selectedSuggestedSize) || benchmarks[0];
    const baseline = getFromStorage<DesignQualityFingerprint>(StorageKeys.DESIGN_QUALITY_BASELINE);
    setDesignRegression(baseline && selected ? detectDesignRegression(baseline, createQualityFingerprint(adDetails, templateSettings, designSuggestion, selected)) : null);
  }, [designSuggestion, selectedSuggestedSize, templateSettings, adDetails]);

  useEffect(() => {
    if (WARDROBE_ROOM_MODE || !productImage || !designSuggestion) { setComparisonPreviews(null); return; }
    let active = true;
    let previews: { current: string; suggested: string } | null = null;
    const selected = { ...designSuggestion, selectedLayout: selectedSuggestedSize };
    void Promise.all([
      renderAd(adDetails, templateSettings, productImage, { width: 216, height: 270, quality: .72 }),
      renderAd(adDetails, applyDesignSuggestion(templateSettings, selected), productImage, { width: 216, height: 270, quality: .72 }),
    ]).then(([current, suggested]) => {
      previews = { current, suggested };
      if (active) setComparisonPreviews(previews);
      else { URL.revokeObjectURL(current); URL.revokeObjectURL(suggested); }
    }).catch(() => { if (active) setComparisonPreviews(null); });
    return () => {
      active = false;
      if (previews) { URL.revokeObjectURL(previews.current); URL.revokeObjectURL(previews.suggested); }
    };
  }, [productImage, designSuggestion, selectedSuggestedSize, templateSettings, adDetails]);

  const handleImageSelect = (imageUrl: string) => {
    tryOnRequestRef.current += 1;
    setProductImage(imageUrl);
    setGeneratedAd('');
    setDesignPassport(null);
    setDesignContractReport(null);
    setQualityGateReport(null);
    setTemplateBeforeContractRepair(null);
    setVisualRepairSnapshot(null);
    setVisualRepairStatus('idle');
    setDesignHistory(null);
    setDesignRedoEntries([]);
    removeFromStorage(StorageKeys.DESIGN_HISTORY);
    setLastVisualSource('');
    setTryOnResult({ status: 'idle', message: '' });
    setDesignSuggestion(null);
    setTemplateBeforeSuggestion(null);
    setCurrentStep('upload');
    if (WARDROBE_ROOM_MODE) {
      setIsReviewingImage(false);
      toast.success('تم رفع الصورة. نبدأ تفريغ الخلفية محلياً الآن.');
      void generateAd(imageUrl);
      return;
    }
    setIsReviewingImage(true);
    toast.success('تمت إضافة الصورة. راجعها ثم تابع إلى بيانات الإعلان.');
  };

  const handleImageRemove = () => {
    tryOnRequestRef.current += 1;
    setProductImage('');
    setGeneratedAd('');
    setDesignPassport(null);
    setDesignContractReport(null);
    setQualityGateReport(null);
    setTemplateBeforeContractRepair(null);
    setVisualRepairSnapshot(null);
    setVisualRepairStatus('idle');
    setDesignHistory(null);
    setDesignRedoEntries([]);
    removeFromStorage(StorageKeys.DESIGN_HISTORY);
    setLastVisualSource('');
    setTryOnResult({ status: 'idle', message: '' });
    setDesignSuggestion(null);
    setTemplateBeforeSuggestion(null);
    setIsReviewingImage(false);
    setCurrentStep('upload');
  };

  const handleStepNavigation = (target: AdWorkflowStep) => {
    const targetIndex = WORKFLOW_STEPS.findIndex(step => step.id === target);
    const currentIndex = WORKFLOW_STEPS.findIndex(step => step.id === currentStep);
    if (targetIndex > currentIndex) {
      toast.message('أكمل المرحلة الحالية أولاً ثم انتقل تلقائياً للمرحلة التالية.');
      return;
    }
    if (target === 'details' && !productImage) {
      setCurrentStep('upload');
      return;
    }
    if (target === 'details' && isReviewingImage) {
      setCurrentStep('upload');
      toast.message('راجع الصورة أولاً ثم اضغط «متابعة إلى بيانات الإعلان».');
      return;
    }
    setCurrentStep(target);
  };

  const clearAdSession = () => {
    if (!window.confirm('هل تريد مسح صورة الملابس وبيانات الإعلان والتصميم الحالي؟')) return;
    tryOnRequestRef.current += 1;
    if (productImage.startsWith('blob:')) URL.revokeObjectURL(productImage);
    if (generatedAd.startsWith('blob:')) URL.revokeObjectURL(generatedAd);
    setProductImage('');
    setGeneratedAd('');
    setDesignPassport(null);
    setDesignContractReport(null);
    setQualityGateReport(null);
    setTemplateBeforeContractRepair(null);
    setVisualRepairSnapshot(null);
    setVisualRepairStatus('idle');
    setDesignHistory(null);
    setDesignRedoEntries([]);
    removeFromStorage(StorageKeys.DESIGN_HISTORY);
    setLastVisualSource('');
    setMarketingText('');
    setIsReviewingImage(false);
    resetDraftFields();
    setTryOnResult({ status: 'idle', message: '' });
    setDesignSuggestion(null);
    setTemplateBeforeSuggestion(null);
    setCurrentStep('upload');
    setActiveView('create');
    removeFromStorage(StorageKeys.LAST_WORKFLOW_STEP);
    toast.success('تم مسح جلسة الإعلان. يمكنك بدء تصميم جديد الآن.');
  };

  const resetDraftFields = () => {
    setAdDetails(EMPTY_AD_DETAILS);
    setHasRestoredDraft(false);
    removeFromStorage(StorageKeys.LAST_AD_DETAILS);
  };

  const discardRestoredDraft = () => {
    resetDraftFields();
    toast.success('بدأت مسودة بيانات جديدة. إعدادات القالب والشعار والتذييل بقيت محفوظة.');
  };

  const acceptDesignSuggestion = () => {
    if (!designSuggestion) return;
    const selectedSuggestion = { ...designSuggestion, selectedLayout: selectedSuggestedSize };
    const nextTemplate = applyDesignSuggestion(templateSettings, selectedSuggestion);
    const benchmarks = buildDesignBenchmarks(adDetails, nextTemplate, selectedSuggestion);
    const selectedBenchmark = benchmarks.find(item => item.template === selectedSuggestedSize) || benchmarks[0];
    setTemplateBeforeSuggestion(previous => previous || templateSettings);
    setTemplateSettings(nextTemplate);
    setDesignBenchmarks(benchmarks);
    if (selectedBenchmark) saveToStorage(StorageKeys.DESIGN_QUALITY_BASELINE, createQualityFingerprint(adDetails, nextTemplate, selectedSuggestion, selectedBenchmark));
    setPreferenceProfile(current => recordLayoutPreference(current, selectedSuggestedSize, true));
    if (!adDetails.marketingText.trim() && selectedSuggestion.suggestedText) {
      setAdDetails(current => ({ ...current, marketingText: selectedSuggestion.suggestedText }));
    }
    setDesignSuggestion(selectedSuggestion);
    toast.success('تم اعتماد الاقتراح. تستطيع تعديل القالب أو التراجع قبل التصدير.');
  };

  const ignoreDesignSuggestion = () => {
    if (designSuggestion) setPreferenceProfile(current => recordLayoutPreference(current, selectedSuggestedSize, false));
    setDesignSuggestion(null);
    setTemplateBeforeSuggestion(null);
  };

  const undoDesignSuggestion = () => {
    if (!templateBeforeSuggestion) return;
    setTemplateSettings(templateBeforeSuggestion);
    setTemplateBeforeSuggestion(null);
    removeFromStorage(StorageKeys.DESIGN_QUALITY_BASELINE);
    setDesignRegression(null);
    toast.success('تمت إعادة إعدادات القالب السابقة.');
  };

  const generateAd = async (imageSource?: string) => {
    const sourceImage = imageSource || productImage;
    if (!sourceImage) {
      setCurrentStep('upload');
      return;
    }

    setCurrentStep('final');
    setIsGenerating(true);
    setGeneratedAd('');
    setDesignPassport(null);
    setDesignContractReport(null);
    setQualityGateReport(null);
    setTemplateBeforeContractRepair(null);
    setVisualRepairSnapshot(null);
    setVisualRepairStatus('idle');
    setTryOnResult({
      status: 'processing',
      message: 'نجهّز الصورة والقالب للإعلان…',
    });

    const acceptedPersonSource = tryOnResult.status === 'success' && tryOnResult.transparentSubject === 'person' ? lastVisualSource : '';
    if (acceptedPersonSource) {
      try {
        setTryOnResult(current => ({ ...current, message: 'نجهّز إعلانك من نتيجة التلبيس التي اعتمدتها…' }));
        const renderTemplate = WARDROBE_ROOM_MODE ? createWardrobeTemplate(templateSettings) : templateSettings;
        const renderDetails = WARDROBE_ROOM_MODE ? createWardrobeDetails() : adDetails;
        const dimensions = getCanvasDimensions(renderTemplate.size);
        const output = await withTimeout(
          renderAd(renderDetails, renderTemplate, acceptedPersonSource, { ...dimensions, visualMode: 'transparentPerson', garmentTransform: renderTemplate.smartGarmentTransform }),
          15_000,
          'انتهت مهلة إنشاء الإعلان. أعد المحاولة أو استخدم الصورة الأصلية.'
        );
        setGeneratedAd(output);
        setMarketingText(WARDROBE_ROOM_MODE ? '' : buildMarketingText(adDetails));
        if (WARDROBE_ROOM_MODE) {
          setIsGenerating(false);
          return;
        }
        const document = compileDesignDocument(adDetails, templateSettings, designSuggestion);
        const contract = evaluateDesignContract(document);
        const pixelTruth = await inspectRenderedPixelTruth(output, document);
        setDesignContractReport(contract);
        setQualityGateReport(evaluateDesignQuality(document, contract, adDetails, designBenchmarks.find(item => item.template === templateSettings.size), pixelTruth));
        setIsGenerating(false);
        return;
      } catch (error) {
        setTryOnResult({ status: 'fallback', message: error instanceof Error ? `تعذر استخدام نتيجة التلبيس؛ أبقينا صورة القطعة المحلية. ${error.message}` : 'تعذر استخدام نتيجة التلبيس؛ أبقينا صورة القطعة المحلية.' });
        setLastVisualSource('');
      }
    }

    let localImage;
    try {
      localImage = await removeBackgroundLocally(sourceImage, stage => {
        setTryOnResult({ status: 'processing', message: getLocalStageMessage(stage) });
      });
    } catch (error) {
      console.error('Failed to prepare local image:', error);
      setTryOnResult({ status: 'unavailable', message: getLocalRemovalUnavailableMessage(error) });
      setIsGenerating(false);
      return;
    }

    try {
      const fullHeightSubject = shouldPreserveFullHeight(localImage);
      setTryOnResult({
        status: 'success',
        imageUrl: localImage.imageUrl,
        providerId: 'local-u2netp',
        message: `تمت إزالة الخلفية محلياً خلال ${formatLocalDuration(localImage.timing.totalMs)}. لم تُرسل الصورة إلى أي خدمة خارجية.`,
        isTransparent: true,
        transparentSubject: fullHeightSubject ? 'person' : 'garment',
      });
      const renderTemplate = WARDROBE_ROOM_MODE ? createWardrobeTemplate(templateSettings) : templateSettings;
      const renderDetails = WARDROBE_ROOM_MODE ? createWardrobeDetails() : adDetails;
      const dimensions = getCanvasDimensions(renderTemplate.size);
      setLastVisualSource(localImage.imageUrl);
      const output = await withTimeout(
        renderAd(renderDetails, renderTemplate, localImage.imageUrl, { ...dimensions, visualMode: fullHeightSubject ? 'transparentPerson' : 'garment', garmentTransform: renderTemplate.smartGarmentTransform }),
        15_000,
        'انتهت مهلة إنشاء الإعلان. جرّب صورة أصغر أو أعد المحاولة.'
      );

      setGeneratedAd(output);
      setMarketingText(WARDROBE_ROOM_MODE ? '' : buildMarketingText(adDetails));
      if (WARDROBE_ROOM_MODE) return;
      const document = compileDesignDocument(adDetails, templateSettings, designSuggestion);
      const contract = evaluateDesignContract(document);
      const pixelTruth = await inspectRenderedPixelTruth(output, document);
      setDesignContractReport(contract);
      setQualityGateReport(evaluateDesignQuality(document, contract, adDetails, designBenchmarks.find(item => item.template === templateSettings.size), pixelTruth));
    } catch (error) {
      console.error('Failed to render local advertisement:', error);
      setTryOnResult({
        status: 'unavailable',
        message: error instanceof Error ? error.message : 'تعذّر إنشاء الإعلان محلياً. جرّب صورة أصغر ثم أعد المحاولة.',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const tryOnAspectRatio = (): '4:5' | '9:16' => templateSettings.size === 'story' ? '9:16' : '4:5';

  const handleTryOnRequest = async (selection: TryOnSelection) => {
    if (!productImage || isTryOnRunning) return;
    const requestId = tryOnRequestRef.current + 1;
    tryOnRequestRef.current = requestId;
    setIsTryOnRunning(true);
    setTryOnPreview(null);
    try {
      const result = await tryOnMutation.mutateAsync({
        productImageData: productImage,
        aspectRatio: tryOnAspectRatio(),
        presentation: selection.presentation,
        pose: selection.pose,
        consent: true,
        consentVersion: 'tryon-v1',
      });
      if (tryOnRequestRef.current !== requestId) return;
      setTryOnPreview(result);
    } catch (error) {
      if (tryOnRequestRef.current !== requestId) return;
      const detail = error instanceof Error ? error.message : 'تعذر إكمال معاينة التلبيس.';
      setTryOnResult({ status: 'fallback', message: `لم نغير إعلانك: ${detail} استخدمنا مسار تجهيز صورة القطعة المحلي.` });
    } finally {
      if (tryOnRequestRef.current === requestId) setIsTryOnRunning(false);
    }
  };

  const handleTryOnCancel = () => {
    tryOnRequestRef.current += 1;
    setIsTryOnRunning(false);
    setTryOnPreview(null);
    setTryOnResult({ status: 'fallback', message: 'ألغيت معاينة التلبيس. ستبقى صورة القطعة والمسار المحلي من دون تغيير.' });
  };

  const handleTryOnReject = () => {
    setTryOnPreview(null);
    setTryOnResult({ status: 'fallback', message: 'اخترت استخدام صورة القطعة الأصلية. لم نغير القالب أو الإعلان المحلي.' });
  };

  const handleTryOnAccept = () => {
    if (!tryOnPreview?.imageUrl || !tryOnPreview.isTransparent || tryOnPreview.transparentSubject !== 'person') return;
    setLastVisualSource(tryOnPreview.imageUrl);
    setTryOnResult(tryOnPreview);
    setTryOnPreview(null);
    toast.success('اعتمدت نتيجة التلبيس. ستستخدم داخل القالب عند إنشاء الإعلان.');
  };

  const regenerateWithCurrentSettings = async (templateOverride?: TemplateSettings, successMessage = 'تمت إعادة توليد الإعلان بالإعدادات الجديدة من دون طلب الذكاء الاصطناعي مرة أخرى.', detailsOverride?: AdDetails) => {
    const source = lastVisualSource || productImage;
    if (!source) {
      setCurrentStep('upload');
      return;
    }
    const retainStudioPreview = WARDROBE_ROOM_MODE && Boolean(generatedAd);
    if (!retainStudioPreview) {
      setIsGenerating(true);
      setGeneratedAd('');
      setDesignPassport(null);
      setDesignContractReport(null);
      setQualityGateReport(null);
      setTemplateBeforeContractRepair(null);
      setVisualRepairSnapshot(null);
      setVisualRepairStatus('idle');
    }
    const studioRenderRequestId = WARDROBE_ROOM_MODE ? ++studioRenderRequestRef.current : 0;
    try {
      const requestedTemplate = templateOverride || templateSettings;
      const activeTemplate = WARDROBE_ROOM_MODE ? createWardrobeTemplate(requestedTemplate) : requestedTemplate;
      const activeDetails = WARDROBE_ROOM_MODE ? createWardrobeDetails() : (detailsOverride || adDetails);
      const dimensions = getCanvasDimensions(activeTemplate.size);
      const output = await withTimeout(
        renderAd(activeDetails, activeTemplate, source, { ...dimensions, visualMode: tryOnResult.transparentSubject === 'person' ? 'transparentPerson' : 'garment', garmentTransform: activeTemplate.smartGarmentTransform }),
        15_000,
        'انتهت مهلة إعادة بناء الإعلان. أعد المحاولة أو جرّب صورة أصغر.'
      );
      if (WARDROBE_ROOM_MODE && studioRenderRequestId !== studioRenderRequestRef.current) return true;
      setGeneratedAd(output);
      setMarketingText(WARDROBE_ROOM_MODE ? '' : buildMarketingText(activeDetails));
      if (WARDROBE_ROOM_MODE) return true;
      const document = compileDesignDocument(activeDetails, activeTemplate, designSuggestion);
      const contract = evaluateDesignContract(document);
      const pixelTruth = await inspectRenderedPixelTruth(output, document);
      setDesignContractReport(contract);
      setQualityGateReport(evaluateDesignQuality(document, contract, adDetails, designBenchmarks.find(item => item.template === activeTemplate.size), pixelTruth));
      toast.success(successMessage);
      return true;
    } catch (error) {
      console.error('Failed to regenerate advertisement with updated template:', error);
      toast.error('تعذرت إعادة توليد الإعلان بالتغييرات الجديدة. حاول مرة أخرى.');
      return false;
    } finally {
      if (!retainStudioPreview) setIsGenerating(false);
    }
  };

  const handleProductScaleCommit = async (value: number) => {
    const productScale = clampProductScale(value);
    if (productScale === clampProductScale(templateSettings.productScale)) return;
    const updatedTemplate = { ...templateSettings, productScale };
    const updated = await regenerateWithCurrentSettings(updatedTemplate, 'تم تحديث حجم المنتج داخل القالب محلياً.');
    if (!updated) return;
    try {
      const before = compileDesignDocument(adDetails, templateSettings, designSuggestion);
      const after = compileDesignDocument(adDetails, updatedTemplate, designSuggestion);
      let history = designHistory || createDesignHistory(before);
      const replayed = replayDesignHistory(history);
      if (designDocumentFingerprint(replayed) !== designDocumentFingerprint(before)) history = appendDesignHistory(history, replayed, before, 'تحديث إعدادات التصميم');
      history = appendDesignHistory(history, before, after, 'تغيير حجم المنتج');
      if (designDocumentFingerprint(replayDesignHistory(history)) !== designDocumentFingerprint(after)) throw new Error('تعذر حفظ تغيير حجم المنتج في سجل التصميم.');
      saveToStorage(StorageKeys.DESIGN_HISTORY, history);
      setDesignHistory(history);
      setDesignRedoEntries([]);
    } catch (error) {
      toast.message(error instanceof Error ? error.message : 'تم تحديث الحجم، لكن تعذر إضافة العملية إلى سجل التصميم.');
    }
    setTemplateSettings(updatedTemplate);
  };

  const handleStudioAppearanceChange = (patch: StudioAppearancePatch) => {
    const updatedTemplate = { ...templateSettings, ...patch };
    setTemplateSettings(updatedTemplate);
    if (generatedAd) void regenerateWithCurrentSettings(updatedTemplate, 'تم تحديث الاستديو محلياً.');
  };

  const handleMarketingDetailsChange = (patch: Partial<AdDetails>) => {
    setAdDetails(current => ({ ...current, ...patch }));
    if (typeof patch.marketingText === 'string') setMarketingText(patch.marketingText);
    if ((typeof patch.storePhone === 'string' && patch.storePhone.trim()) || patch.marketingPreferences) {
      const stored = saveMerchantProfile({
        ...merchantProfile,
        ...(typeof patch.storePhone === 'string' && patch.storePhone.trim() ? { storePhone: patch.storePhone.trim() } : {}),
        ...(patch.marketingPreferences ? { marketingPreferences: patch.marketingPreferences } : {}),
      });
      setMerchantProfile(stored);
    }
  };

  const generateWardrobeMarketingText = async (details: AdDetails, preferences: MarketingTextPreferences, variant: number) => {
    const caption = templateSettings.studioCaption?.trim() || '';
    const generationDetails: AdDetails = applyMerchantProfileToMarketingDetails({
      ...details,
      headline: [details.headline.trim(), caption].filter((value, index, values) => Boolean(value) && values.indexOf(value) === index).join(' — '),
      currency: details.currency.trim() || 'ريال',
      marketingText: '',
    }, merchantProfile);
    const local = generateLocalMarketingText(generationDetails, preferences, variant);
    handleMarketingDetailsChange({ marketingText: local.text, marketingPreferences: preferences, marketingTextEngine: 'local' });
    if (friendTestMode || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
      return { ...local, source: 'local-fallback' as const, message: friendTestMode ? 'وضع الاختبار يستخدم المولد المحلي فوراً.' : 'لا يوجد اتصال، فاستخدمنا المولد المحلي فوراً.' };
    }
    try {
      const result = await marketingTextMutation.mutateAsync({ details: generationDetails, preferences, variant });
      handleMarketingDetailsChange({ marketingText: result.text, marketingPreferences: preferences, marketingTextEngine: result.source === 'cloud' ? 'cloud' : 'local' });
      return result;
    } catch {
      return { ...local, source: 'local-fallback' as const, message: 'تعذر الاتصال، فاستخدمنا المولد المحلي فوراً.' };
    }
  };

  const handleWardrobeWorkspacePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (!activeWardrobeTool) return;
    if ((event.target as HTMLElement).closest('[data-wardrobe-tool-panel]')) return;
    setActiveWardrobeTool(null);
  };

  /** يعود لاختيار الصورة مع الاحتفاظ بكل إعدادات القالب التي اختارها المستخدم. */
  const returnToImagePicker = () => {
    setGeneratedAd('');
    setIsReviewingImage(false);
    setActiveWardrobeTool(null);
    setCurrentStep('upload');
  };

  const persistMerchantProfile = (profile: MerchantProfile, announce: boolean) => {
    const stored = saveMerchantProfile(profile);
    setMerchantProfile(stored);
    setAdDetails(current => ({
      ...current,
      storeName: stored.storeName || current.storeName,
      storePhone: stored.storePhone || current.storePhone,
      storeLocation: stored.storeLocation || current.storeLocation,
      storeCategory: stored.storeCategory || current.storeCategory,
      discount: stored.defaultDiscount || current.discount,
      colors: stored.defaultColors.length > 0 ? stored.defaultColors : current.colors,
    }));
    if (announce) toast.success('تم حفظ تفضيلات متجرك محلياً على هذا الهاتف.');
  };

  const handleMerchantProfileCommit = (profile: MerchantProfile) => persistMerchantProfile(profile, true);
  const handleMerchantProfileDraftChange = (profile: MerchantProfile) => persistMerchantProfile(profile, false);

  const handleMerchantProfileClear = () => {
    setMerchantProfile(clearMerchantProfile());
    toast.success('تم مسح ذاكرة المساعد المحلية من هذا الهاتف.');
  };

  const handleMerchantAssistantSessionCommit = (session: MerchantAssistantSession) => {
    setMerchantAssistantSession(saveMerchantAssistantSession(session));
  };

  const handleMerchantAssistantSessionClear = () => {
    setMerchantAssistantSession(clearMerchantAssistantSession());
    toast.success('تم مسح سجل مهام المساعد من هذا الهاتف.');
  };

  const restoreNormalMode = () => {
    if (!window.confirm('سيعاد شكل القالب وتفضيلات التحسين إلى الوضع الطبيعي. لن نحذف صورة الملابس أو الإعلان الحالي أو بيانات المركز أو الحساب أو مفاتيح المطور. هل تريد المتابعة؟')) return;
    setTemplateSettings(DEFAULT_TEMPLATE_SETTINGS);
    setPreferenceProfile(clearPreferenceProfile());
    setMerchantAssistantSession(clearMerchantAssistantSession());
    setDesignSuggestion(null);
    setTemplateBeforeSuggestion(null);
    setDesignBenchmarks([]);
    setDesignRegression(null);
    setDesignHistory(null);
    setDesignRedoEntries([]);
    setQualityGateReport(null);
    setDesignContractReport(null);
    setActiveWardrobeTool(null);
    removeFromStorage(StorageKeys.TEMPLATE_SETTINGS);
    removeFromStorage(StorageKeys.DESIGN_HISTORY);
    removeFromStorage(StorageKeys.DESIGN_SUGGESTION);
    removeFromStorage(StorageKeys.DESIGN_QUALITY_BASELINE);
    toast.success('عاد القالب وتفضيلات التحسين إلى الوضع الطبيعي. بقيت صورتك وبيانات مركزك ومفاتيح المطور كما هي.');
  };

  const handleLocalProjectBackupRestore = (backup: LocalProjectBackup) => {
    const restoredProfile = saveMerchantProfile(backup.profile);
    const restoredSession = saveMerchantAssistantSession(backup.session);
    setMerchantProfile(restoredProfile);
    setMerchantAssistantSession(restoredSession);
    setTemplateSettings({ ...DEFAULT_TEMPLATE_SETTINGS, ...backup.template });
    setAdDetails(current => ({ ...current, storeName: restoredProfile.storeName || current.storeName, storePhone: restoredProfile.storePhone || current.storePhone, storeLocation: restoredProfile.storeLocation || current.storeLocation, storeCategory: restoredProfile.storeCategory || current.storeCategory, discount: restoredProfile.defaultDiscount || current.discount, colors: restoredProfile.defaultColors.length ? restoredProfile.defaultColors : current.colors }));
    toast.success('استعدنا إعدادات القالب وذاكرة القائد من النسخة المحلية.');
  };

  const handleMerchantCommands = async (commands: MerchantCommand[]) => {
    const application = applyMerchantCommands(templateSettings, merchantProfile, commands, adDetails);
    const nextDetails: AdDetails = { ...adDetails, ...application.detailsPatch };
    const templateChanged = JSON.stringify(application.template) !== JSON.stringify(templateSettings);
    const detailsChanged = JSON.stringify(nextDetails) !== JSON.stringify(adDetails);
    const appliedProfile = saveMerchantProfile(application.profile);
    setMerchantProfile(appliedProfile);
    if (application.applied.length === 0) {
      toast.message('لم نغير التصميم: الطلب غير مدعوم حالياً وسُجل كتجميعة محلية بلا إرسال.');
      return true;
    }
    if (!templateChanged && !detailsChanged) return true;
    if (!generatedAd || !(lastVisualSource || productImage)) {
      if (templateChanged) setTemplateSettings(application.template);
      if (detailsChanged) setAdDetails(nextDetails);
      toast.success('تم حفظ التغيير المسموح للإعلان التالي محلياً.');
      return true;
    }
    const updated = await regenerateWithCurrentSettings(application.template, 'طبق المساعد التغييرات المسموحة وأعاد فحص الإعلان محلياً.', nextDetails);
    if (!updated) return false;
    try {
      const before = compileDesignDocument(adDetails, templateSettings, designSuggestion);
      const after = compileDesignDocument(nextDetails, application.template, designSuggestion);
      let history = designHistory || createDesignHistory(before);
      const replayed = replayDesignHistory(history);
      if (designDocumentFingerprint(replayed) !== designDocumentFingerprint(before)) history = appendDesignHistory(history, replayed, before, 'تحديث إعدادات التصميم');
      history = appendDesignHistory(history, before, after, 'تطبيق أمر مساعد محلي');
      if (designDocumentFingerprint(replayDesignHistory(history)) !== designDocumentFingerprint(after)) throw new Error('تعذر حفظ أمر المساعد في سجل التصميم.');
      saveToStorage(StorageKeys.DESIGN_HISTORY, history);
      setDesignHistory(history);
      setDesignRedoEntries([]);
    } catch (error) {
      toast.message(error instanceof Error ? error.message : 'طُبق الأمر، لكن تعذر إضافته إلى سجل التصميم.');
    }
    setTemplateSettings(application.template);
    setAdDetails(nextDetails);
    return true;
  };

  const handleMerchantArtwork = async (kind: 'logo' | 'footer', source: string) => {
    const updatedTemplate: TemplateSettings = kind === 'logo'
      ? { ...templateSettings, storeLogoArtwork: source, showStoreLogo: true }
      : { ...templateSettings, footerArtwork: source, showFooterArtwork: true };
    if (!generatedAd || !(lastVisualSource || productImage)) {
      setTemplateSettings(updatedTemplate);
      toast.success(`تم حفظ ${kind === 'logo' ? 'الشعار' : 'التذييل'} محلياً للقالب التالي.`);
      return true;
    }
    const updated = await regenerateWithCurrentSettings(updatedTemplate, `تم وضع ${kind === 'logo' ? 'الشعار' : 'التذييل'} وإعادة بناء الإعلان محلياً.`);
    if (!updated) return false;
    setTemplateSettings(updatedTemplate);
    return true;
  };

  const evaluateCurrentQualityGate = async () => {
    const document = compileDesignDocument(adDetails, templateSettings, designSuggestion);
    const contract = evaluateDesignContract(document);
    const benchmark = designBenchmarks.find(item => item.template === templateSettings.size);
    const pixelTruth = await inspectRenderedPixelTruth(generatedAd, document);
    const report = evaluateDesignQuality(document, contract, adDetails, benchmark, pixelTruth);
    setDesignContractReport(contract);
    setQualityGateReport(report);
    return report;
  };

  const handleCheckQualityGate = async () => {
    if (!generatedAd || isCheckingQualityGate) return;
    setIsCheckingQualityGate(true);
    try {
      const report = await evaluateCurrentQualityGate();
      if (canExportDesign(report)) toast.success('اجتاز الإعلان بوابة جودة التصدير محلياً.');
      else toast.error('أوقفت بوابة الجودة التصدير حتى إصلاح الخطأ الهندسي الحرج.');
    } catch {
      toast.error('تعذر فحص بوابة جودة التصدير محلياً. أعد التوليد ثم حاول مرة أخرى.');
    } finally {
      setIsCheckingQualityGate(false);
    }
  };

  const ensureExportAllowed = async () => {
    if (!generatedAd) return false;
    try {
      const report = await evaluateCurrentQualityGate();
      if (canExportDesign(report)) return true;
      if (WARDROBE_ROOM_MODE) return true;
      toast.error('تم إيقاف الحفظ والمشاركة: أصلح الخطأ الهندسي الحرج أولاً.');
      return false;
    } catch {
      toast.error('تعذر التحقق من جودة التصميم قبل التصدير. أعد التوليد ثم حاول مرة أخرى.');
      return false;
    }
  };

  const handleDownload = async () => {
    if (!generatedAd) return;
    if (!(await ensureExportAllowed())) return;
    try {
      downloadImage(generatedAd, `${adDetails.productName.trim() || 'إعلان-ملابس'}-${Date.now()}.png`);
      toast.success('تم حفظ تصميم PNG. افتح التنزيلات أو المعرض لإرساله في واتساب.');
    } catch {
      toast.error('تعذّر تنزيل الإعلان. حاول مرة أخرى.');
    }
  };

  const handleCreatePassport = async () => {
    if (!generatedAd || isCreatingPassport) return;
    setIsCreatingPassport(true);
    try {
      const passport = await createDesignPassport(generatedAd, templateSettings, designSuggestion);
      setDesignPassport(passport);
      toast.success('اكتمل فحص جودة الإعلان محلياً. يمكنك حفظ الجواز الاختياري الآن.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذر فحص نتيجة الإعلان محلياً. أعد التوليد ثم حاول مرة أخرى.');
    } finally {
      setIsCreatingPassport(false);
    }
  };

  const handleCheckDesignContract = () => {
    if (!generatedAd || isCheckingDesignContract) return;
    setIsCheckingDesignContract(true);
    try {
      const document = compileDesignDocument(adDetails, templateSettings, designSuggestion);
      const persisted = designHistory || getFromStorage<DesignHistoryDocument>(StorageKeys.DESIGN_HISTORY);
      let history = persisted ? parseDesignHistory(serializeDesignHistory(persisted)) : createDesignHistory(document);
      const replayed = replayDesignHistory(history);
      if (designDocumentFingerprint(replayed) !== designDocumentFingerprint(document)) {
        history = appendDesignHistory(history, replayed, document, 'تحديث إعدادات التصميم');
        setDesignRedoEntries([]);
      }
      const confirmed = replayDesignHistory(history);
      if (designDocumentFingerprint(confirmed) !== designDocumentFingerprint(document)) throw new Error('تعذر إثبات إعادة تشغيل التصميم.');
      saveToStorage(StorageKeys.DESIGN_HISTORY, history);
      setDesignHistory(history);
      const report = evaluateDesignContract(confirmed);
      setDesignContractReport(report);
      setQualityGateReport(evaluateDesignQuality(confirmed, report, adDetails, designBenchmarks.find(item => item.template === confirmed.template)));
      if (report.status === 'pass') toast.success('اجتاز التصميم عقد الهندسة المحلي للمقاس الحالي.');
      else toast.message('وجد عقد التصميم موضعاً يحتاج مراجعة أو إصلاحاً اختيارياً.');
    } catch {
      toast.error('تعذر فحص عقد التصميم محلياً. أعد توليد الإعلان ثم حاول مرة أخرى.');
    } finally {
      setIsCheckingDesignContract(false);
    }
  };

  const handleVisualRepair = async () => {
    if (!generatedAd || visualRepairStatus === 'repairing') return;
    setVisualRepairStatus('repairing');
    try {
      const currentReport = qualityGateReport || await evaluateCurrentQualityGate();
      const headerBlocked = currentReport.pixelTruth?.checks.some(check => check.id === 'header' && check.status === 'block');
      if (!headerBlocked) {
        setVisualRepairStatus('blocked');
        toast.message('الإصلاح التلقائي متاح فقط عندما يكون التباين الحرج في عنوان الإعلان.');
        return;
      }
      const source = lastVisualSource || productImage;
      if (!source) throw new Error('لا تتوفر صورة القطعة لإعادة الرسم.');
      const sourceResponse = await fetch(generatedAd);
      const originalBlob = await sourceResponse.blob();
      if (!sourceResponse.ok || !originalBlob.type.startsWith('image/')) throw new Error('تعذر حفظ معاينة الإعلان الأصلية للتراجع.');
      const repairedTemplate = applyDesignRepair(templateSettings, 'restore-readable-background');
      const dimensions = getCanvasDimensions(repairedTemplate.size);
      const output = await withTimeout(
        renderAd(adDetails, repairedTemplate, source, { ...dimensions, visualMode: tryOnResult.transparentSubject === 'person' ? 'transparentPerson' : 'garment', garmentTransform: repairedTemplate.smartGarmentTransform }),
        15_000,
        'انتهت مهلة إعادة رسم إصلاح العنوان.'
      );
      const document = compileDesignDocument(adDetails, repairedTemplate, designSuggestion);
      const contract = evaluateDesignContract(document);
      const pixelTruth = await inspectRenderedPixelTruth(output, document);
      const report = evaluateDesignQuality(document, contract, adDetails, designBenchmarks.find(item => item.template === repairedTemplate.size), pixelTruth);
      if (!canExportDesign(report)) {
        URL.revokeObjectURL(output);
        setVisualRepairStatus('blocked');
        toast.error('أُعيد الرسم والفحص، لكن الإصلاح لم ينجح؛ أبقينا الإعلان الأصلي والتصدير محجوباً.');
        return;
      }
      setVisualRepairSnapshot({ templateSettings, generatedAdBlob: originalBlob, qualityGateReport: currentReport, designContractReport, marketingText });
      setTemplateSettings(repairedTemplate);
      setGeneratedAd(output);
      setDesignContractReport(contract);
      setQualityGateReport(report);
      setVisualRepairStatus('verified');
      toast.success('نجح إصلاح العنوان بعد إعادة الرسم وفحص البكسلات والهندسة محلياً.');
    } catch (error) {
      setVisualRepairStatus('failed');
      toast.error(error instanceof Error ? error.message : 'تعذر إكمال إصلاح العنوان؛ بقي الإعلان الأصلي كما هو.');
    }
  };

  const handleApplyContractRepair = (repairId: DesignRepairId) => {
    if (repairId === 'restore-readable-background') {
      void handleVisualRepair();
      return;
    }
    try {
      const before = compileDesignDocument(adDetails, templateSettings, designSuggestion);
      const repairedTemplate = applyDesignRepair(templateSettings, repairId);
      const after = compileDesignDocument(adDetails, repairedTemplate, designSuggestion);
      const history = appendDesignHistory(designHistory || createDesignHistory(before), before, after, 'إصلاح هندسي آمن');
      const replayed = replayDesignHistory(history);
      if (designDocumentFingerprint(replayed) !== designDocumentFingerprint(after)) throw new Error('تعذر التحقق من إصلاح التصميم.');
      saveToStorage(StorageKeys.DESIGN_HISTORY, history);
      setDesignHistory(history);
      setDesignRedoEntries([]);
      setTemplateBeforeContractRepair(templateSettings);
      setTemplateSettings(repairedTemplate);
      const report = evaluateDesignContract(replayed);
      setDesignContractReport(report);
      setQualityGateReport(null);
      toast.success('تم تطبيق الإصلاح وتحقق سجل التصميم منه. أعد توليد الإعلان لتحديث PNG.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذر تطبيق إصلاح عقد التصميم.');
    }
  };

  const applyReplayedHistory = (history: DesignHistoryDocument, message: string) => {
    const replayed = replayDesignHistory(history);
    setTemplateSettings(current => applyDesignDocument(current, replayed));
    saveToStorage(StorageKeys.DESIGN_HISTORY, history);
    setDesignHistory(history);
    setDesignContractReport(evaluateDesignContract(replayed));
    setQualityGateReport(null);
    toast.success(message);
  };

  const handleUndoHistory = () => {
    if (!designHistory) return;
    try {
      const result = undoDesignHistory(designHistory);
      if (!result.removed) return;
      setDesignRedoEntries(current => [...current, result.removed!]);
      applyReplayedHistory(result.history, 'تم التراجع عن آخر عملية تصميم محلياً. أعد التوليد لتحديث الصورة.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'تعذر التراجع عن سجل التصميم.'); }
  };

  const handleRedoHistory = () => {
    if (!designHistory || !designRedoEntries.length) return;
    try {
      const entry = designRedoEntries[designRedoEntries.length - 1];
      const history = redoDesignHistory(designHistory, entry);
      setDesignRedoEntries(current => current.slice(0, -1));
      applyReplayedHistory(history, 'تمت إعادة عملية التصميم. أعد التوليد لتحديث الصورة.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'تعذرت إعادة العملية من سجل التصميم.'); }
  };

  const handleReplayHistory = () => {
    if (!designHistory) return;
    try { applyReplayedHistory(designHistory, 'أعيد تشغيل التصميم من سجله الدلالي بنجاح. أعد التوليد لتحديث الصورة.'); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'تعذرت إعادة تشغيل سجل التصميم.'); }
  };

  const handleRemoveHistoryEntry = (id: number) => {
    if (!designHistory) return;
    try {
      const history = removeDesignHistoryEntry(designHistory, id);
      setDesignRedoEntries([]);
      applyReplayedHistory(history, 'تم حذف العملية وإعادة بناء حالة التصميم بأمان. أعد التوليد لتحديث الصورة.');
    } catch { toast.error('لا يمكن حذف هذه العملية لأنها تعتمد عليها عملية لاحقة في السجل.'); }
  };

  const handleUndoContractRepair = () => {
    if (!templateBeforeContractRepair) return;
    setTemplateSettings(templateBeforeContractRepair);
    setTemplateBeforeContractRepair(null);
    setDesignContractReport(null);
    setQualityGateReport(null);
    toast.success('تم التراجع عن إصلاح عقد التصميم.');
  };

  const handleUndoVisualRepair = () => {
    if (!visualRepairSnapshot) return;
    const restoredAd = URL.createObjectURL(visualRepairSnapshot.generatedAdBlob);
    setTemplateSettings(visualRepairSnapshot.templateSettings);
    setGeneratedAd(restoredAd);
    setQualityGateReport(visualRepairSnapshot.qualityGateReport);
    setDesignContractReport(visualRepairSnapshot.designContractReport);
    setMarketingText(visualRepairSnapshot.marketingText);
    setVisualRepairSnapshot(null);
    setVisualRepairStatus('undone');
    toast.success('أعيدت إعدادات الإعلان والصورة الأصلية قبل إصلاح العنوان.');
  };

  const handleDownloadPassport = () => {
    if (!designPassport) return;
    const blob = new Blob([passportToJson(designPassport)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    try {
      downloadImage(url, passportFilename(adDetails.productName));
      toast.success('تم حفظ جواز الجودة بصيغة JSON في التنزيلات.');
    } finally {
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    }
  };

  const handleWhatsApp = async () => {
    if (!generatedAd) return;
    if (!(await ensureExportAllowed())) return;
    try {
      const shared = await shareViaWebAPI(generatedAd, adDetails.productName || 'إعلان ملابس', getWardrobeShareText('whatsapp', marketingText));
      if (shared) {
        toast.success('تم فتح نافذة المشاركة. اختر واتساب لإرسال الإعلان.');
        return;
      }
      downloadImage(generatedAd, `${adDetails.productName.trim() || 'إعلان-ملابس'}-${Date.now()}.png`);
      shareToWhatsApp('', getWardrobeShareText('whatsapp', marketingText));
      toast.success('حُفظ التصميم وفتح واتساب بالنص فقط. أرفق ملف PNG من التنزيلات؛ لا نشارك رابط المعاينة المؤقت.');
    } catch {
      toast.error('تعذّرت المشاركة عبر واتساب. جرّب تنزيل الصورة أولاً.');
    }
  };

  const handleShareImageOnly = async () => {
    if (!generatedAd) return;
    if (!(await ensureExportAllowed())) return;
    try {
      const shared = await shareViaWebAPI(generatedAd, adDetails.productName || 'صورة الملابس', getWardrobeShareText('image', marketingText));
      if (shared) {
        toast.success('اختر التطبيق الذي تريد إرسال الصورة إليه. لم نضف نصاً تسويقياً.');
        return;
      }
      downloadImage(generatedAd, `${adDetails.productName.trim() || 'صورة-ملابس'}-${Date.now()}.png`);
      toast.success('حُفظت الصورة من دون نص. أرسلها من المعرض إلى التطبيق الذي تريد.');
    } catch {
      toast.error('تعذر إرسال الصورة الآن. جرّب التنزيل أولاً.');
    }
  };

  const handleShare = async () => {
    if (!generatedAd) return;
    if (!(await ensureExportAllowed())) return;
    try {
      const shared = await shareViaWebAPI(generatedAd, adDetails.productName || 'إعلان ملابس', getWardrobeShareText('whatsapp', marketingText));
      if (shared) {
        toast.success('تم فتح نافذة مشاركة الإعلان.');
        return;
      }
      shareToWhatsApp('', getWardrobeShareText('whatsapp', marketingText));
      toast.success('تم فتح واتساب بالنص التسويقي كخيار مشاركة بديل.');
    } catch {
      toast.error('تعذّرت مشاركة الإعلان حالياً.');
    }
  };

  if (EMBEDDED_ANDROID_APP && localToolSetup.status !== 'ready') {
    return <LocalToolsSetupScreen state={localToolSetup} onRetry={() => void prepareLocalTools(true)} />;
  }

  const currentIndex = WORKFLOW_STEPS.findIndex(step => step.id === currentStep);
  const isWardrobeStudio = WARDROBE_ROOM_MODE && activeView === 'create' && currentStep === 'final';
  const mobileShellStyle = WARDROBE_ROOM_MODE ? { minHeight: '100svh', height: '100svh', overflow: 'hidden', background: 'var(--card)' } : undefined;
  const mobileMainStyle = WARDROBE_ROOM_MODE ? (isWardrobeStudio ? { minHeight: 0, background: 'var(--card)' } : { minHeight: 0, background: 'var(--card)', overscrollBehavior: 'contain', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }) : undefined;

  return (
    <div className="reference-shell flex min-h-screen flex-col text-foreground" data-mobile-app-shell style={mobileShellStyle} dir="rtl">
      <header className="sticky top-0 z-20 border-b bg-white backdrop-blur-xl" style={{ backgroundColor: 'var(--card)' }}>
        <div className="mx-auto grid max-w-2xl grid-cols-[44px_minmax(0,1fr)_48px] items-center gap-3 px-4 py-3">
          {WARDROBE_ROOM_MODE && currentStep === 'final' && activeView === 'create' ? <button type="button" onClick={returnToImagePicker} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/15 bg-white text-primary shadow-sm transition active:scale-95" aria-label="اختيار صورة جديدة"><ArrowRight size={20} /></button> : friendTestMode || WARDROBE_ROOM_MODE ? <span className="h-11 w-11" aria-hidden="true" /> : <button type="button" onClick={() => setActiveView('messages')} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/15 bg-white text-primary shadow-sm transition active:scale-95" aria-label="رسائل المشروع"><MessageCircle size={20} /></button>}
          <div className="flex min-w-0 items-center justify-center gap-2 text-center"><img src={LOGO_URL} alt="" className="h-8 w-8 shrink-0 object-contain" /><div className="min-w-0"><h1 className="text-[15px] font-black leading-5 tracking-tight text-primary sm:text-xl">غرفة الملابس</h1><p className="mt-0.5 truncate text-[10px] font-bold text-muted-foreground">ارفع القطعة ثم اختر شكلها</p></div></div>
          <div className="relative"><button type="button" onClick={() => setIsQuickAccessOpen(open => !open)} aria-expanded={isQuickAccessOpen} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/15 bg-white text-primary shadow-sm transition active:scale-95" aria-label="الإعدادات والوصول للمطور"><Settings size={20} /><span className="sr-only">الإعدادات</span></button>{isQuickAccessOpen && <div style={{ width: '13rem' }} className="absolute left-0 top-full z-50 mt-2 rounded-2xl border border-primary/15 bg-white p-2 text-right shadow-xl"><p className="px-2 py-1 text-[10px] font-black text-muted-foreground">اختر مكاناً واحداً</p><button type="button" onClick={() => { setIsQuickAccessOpen(false); setActiveView('settings'); }} className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-sm font-black text-primary transition hover:bg-primary/5 active:scale-[0.98]"><Settings size={17} />إعدادات الإعلان</button>{!friendTestMode && <button type="button" onClick={() => { setIsQuickAccessOpen(false); setActiveView('developer'); }} className="mt-1 flex min-h-11 w-full items-center gap-2 rounded-xl bg-primary/5 px-3 text-sm font-black text-primary transition active:scale-[0.98]"><Wrench size={17} />لوحة المطور</button>}</div>}</div>
        </div>
      </header>

      <main className={`mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 ${WARDROBE_ROOM_MODE ? (isWardrobeStudio ? 'overflow-hidden py-2' : 'overflow-y-auto py-3') : 'pb-32 pt-5 sm:pt-8'}`} style={mobileMainStyle}>
        {activeView === 'create' && !WARDROBE_ROOM_MODE && <PwaInstallPrompt />}

        {activeView === 'create' && !WARDROBE_ROOM_MODE && <section className={`reference-card mb-6 p-4 ${currentStep === 'upload' ? 'hidden' : ''}`}>
          <div className="mb-3 flex items-center justify-between px-1">
            <span className="text-xs font-black text-primary">خطوة {currentIndex + 1} من {WORKFLOW_STEPS.length}</span>
            <span className="text-[11px] font-medium text-muted-foreground">من صورة القطعة إلى إعلان جاهز</span>
          </div>
          <div className="flex items-start justify-between gap-1">
            {WORKFLOW_STEPS.map((step, index) => {
              const isCurrent = step.id === currentStep;
              const isDone = index < currentIndex;
              const StepIcon = WORKFLOW_STEP_ICONS[step.id];
              return (
                <button key={step.id} type="button" onClick={() => handleStepNavigation(step.id)} disabled={index > currentIndex} aria-current={isCurrent ? 'step' : undefined} className={`flex min-w-0 flex-1 flex-col items-center gap-2 rounded-2xl px-1 py-1 text-center transition ${isCurrent ? 'bg-primary/[.06]' : ''} ${index <= currentIndex ? 'cursor-pointer active:scale-95' : 'cursor-not-allowed'}`}>
                  <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-black transition ${
                    isCurrent
                        ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                        : isDone
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-muted-foreground'
                    }`}
                  >
                    {isDone ? <Check size={17} /> : <StepIcon size={17} />}
                  </div>
                  <span className={`text-[11px] font-bold leading-tight sm:text-xs ${isCurrent ? 'text-primary' : 'text-muted-foreground'}`}>
                    {step.label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>}

        {activeView === 'settings' && (<React.Suspense fallback={<PageLoading label="جارٍ فتح الإعدادات…" />}><UserTemplateSettings
            settings={templateSettings}
            onChange={setTemplateSettings}
            onBack={() => setActiveView('create')}
            onAbout={() => setActiveView('about')}
            onDeveloper={friendTestMode ? undefined : () => setActiveView('developer')}
            profile={merchantProfile}
            onProfileChange={handleMerchantProfileDraftChange}
            onRestoreNormal={restoreNormalMode}
            localToolSetup={EMBEDDED_ANDROID_APP ? localToolSetup : undefined}
            onPrepareLocalTools={() => void prepareLocalTools(true)}
          /></React.Suspense>)}

        {activeView === 'assistant' && <React.Suspense fallback={<PageLoading label="جارٍ فتح القائد المحلي…" />}><MerchantAssistantWorkspace profile={merchantProfile} session={merchantAssistantSession} template={templateSettings} onCommitProfile={handleMerchantProfileCommit} onCommitSession={handleMerchantAssistantSessionCommit} onApplyCommands={handleMerchantCommands} onApplyArtwork={handleMerchantArtwork} onRequestOnlineReply={friendTestMode ? undefined : (message) => connectedLeaderMutation.mutateAsync({ message })} onRestoreBackup={handleLocalProjectBackupRestore} onClearProfile={handleMerchantProfileClear} onClearSession={handleMerchantAssistantSessionClear} onOpenUpdatedResult={() => { setActiveView('create'); setCurrentStep('final'); }} /></React.Suspense>}

        {activeView === 'batch' && <React.Suspense fallback={<PageLoading label="جارٍ فتح مساحة الدفعة…" />}><BatchWorkspace details={adDetails} template={templateSettings} onDetailsChange={setAdDetails} onBack={() => setActiveView('create')} generateCloudText={friendTestMode ? undefined : (details, preferences, variant) => marketingTextMutation.mutateAsync({ details, preferences, variant })} /></React.Suspense>}

        {!friendTestMode && activeView === 'messages' && <React.Suspense fallback={<PageLoading label="جارٍ فتح الرسائل…" />}><PersonalMessageCenter onBack={() => setActiveView('create')} /></React.Suspense>}

        {activeView === 'about' && (
          <div style={WARDROBE_ROOM_MODE ? { display: 'flex', flex: 1, minHeight: 0 } : undefined}>
            <React.Suspense fallback={<PageLoading label="جارٍ فتح حول التطبيق…" />}>
              <AboutApp onBack={() => setActiveView('settings')} />
            </React.Suspense>
          </div>
        )}

        {!friendTestMode && activeView === 'developer' && (
          <React.Suspense fallback={<PageLoading label="جارٍ فتح لوحة المطور…" />}>
            <DeveloperWorkspace onBack={() => setActiveView('create')} />
          </React.Suspense>
        )}

        {!friendTestMode && !WARDROBE_ROOM_MODE && activeView === 'create' && announcementQuery.data && (
          <button type="button" onClick={() => setActiveView('messages')} className="mb-5 w-full rounded-2xl border border-amber-200 bg-amber-50 p-4 text-right text-sm leading-6 text-amber-950"><span className="font-black">رسالة من المطور: </span>{announcementQuery.data.message}</button>
        )}

        {activeView === 'create' && currentStep === 'upload' && (
          <section className={`reference-card p-5 sm:p-7 ${WARDROBE_ROOM_MODE ? 'flex flex-1 flex-col' : ''}`} style={WARDROBE_ROOM_MODE ? { minHeight: 0 } : undefined}>
            <div className="mb-6">
              <span className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary"><ImagePlus size={15} />صورة الاستديو تبدأ هنا</span>
              <h2 className="text-2xl font-black text-primary">ضع قطعة الملابس في غرفة الاستديو</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">ارفع صورة واضحة للقطعة. النتيجة تركز على شكلها وحجمها وخلفيتها، من دون بيانات أو خدمات إضافية.</p>
            </div>
            <div className={WARDROBE_ROOM_MODE ? 'hidden' : 'mb-6'}>
              <h3 className="mb-3 text-sm font-black text-primary">اختر طريقة العمل</h3>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setActiveView('create')} aria-pressed className="rounded-[24px] border-2 border-primary bg-primary/[0.045] p-4 text-right shadow-sm transition active:scale-[0.98]"><span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-primary shadow-sm"><ImagePlus size={25} /></span><span className="block text-base font-black text-primary">إعلان فردي</span><span className="mt-1 block text-xs text-muted-foreground">قطعة واحدة</span><span className="mt-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check size={14} /></span></button>
                <button type="button" onClick={() => setActiveView('batch')} className="rounded-[24px] border border-[#e8e4ed] bg-white p-4 text-right shadow-sm transition hover:border-primary/30 active:scale-[0.98]"><span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Images size={25} /></span><span className="block text-base font-black text-primary">إنشاء دفعة</span><span className="mt-1 block text-xs text-muted-foreground">حتى 10 صور</span></button>
              </div>
            </div>
            {hasRestoredDraft && <div className="mb-5 flex items-start gap-3 rounded-2xl border border-primary/15 bg-primary/5 p-4 text-right">
              <RotateCcw size={19} className="mt-0.5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1"><p className="text-sm font-black text-primary">استعدنا بيانات آخر مسودة</p><p className="mt-1 text-xs leading-5 text-muted-foreground">ارفع صورة القطعة لإكمالها، أو ابدأ حقولاً جديدة من دون مسح إعدادات القالب.</p></div>
              <button type="button" onClick={discardRestoredDraft} className="shrink-0 rounded-xl bg-white px-3 py-2 text-xs font-black text-primary shadow-sm transition active:scale-95">بدء جديد</button>
            </div>}
            {isReviewingImage && productImage ? (
              <div className={WARDROBE_ROOM_MODE ? 'flex flex-1 flex-col justify-center space-y-4' : 'space-y-4'}>
                <SingleImageReview simple={WARDROBE_ROOM_MODE} image={productImage} suggestion={designSuggestion} comparisonPreviews={comparisonPreviews} isDesignAnalyzing={isDesignAnalyzing} localPreparation={localPreparation} benchmarks={designBenchmarks} regression={designRegression} selectedSize={selectedSuggestedSize} currentSize={templateSettings.size} preferenceEnabled={preferenceProfile.enabled} accepted={Boolean(templateBeforeSuggestion)} onSelectSize={setSelectedSuggestedSize} onAcceptSuggestion={acceptDesignSuggestion} onIgnoreSuggestion={ignoreDesignSuggestion} onUndoSuggestion={undoDesignSuggestion} onTogglePreferences={() => setPreferenceProfile(current => setPreferenceEnabled(current, !current.enabled))} onClearPreferences={() => { setPreferenceProfile(clearPreferenceProfile()); toast.success('تم مسح تفضيلات المصمم من هذا الهاتف.'); }} onImageSelect={handleImageSelect} onImageRemove={handleImageRemove} onContinue={() => { setIsReviewingImage(false); if (WARDROBE_ROOM_MODE) void generateAd(); else { setCurrentStep('details'); toast.success('الصورة جاهزة. أضف بيانات الإعلان التي تريدها.'); } }} />
                {!WARDROBE_ROOM_MODE && !friendTestMode && <TryOnOptIn isRunning={isTryOnRunning} preview={tryOnPreview} onRequest={handleTryOnRequest} onCancel={handleTryOnCancel} onAcceptPreview={handleTryOnAccept} onRejectPreview={handleTryOnReject} />}
              </div>
            ) : (
              <div className={WARDROBE_ROOM_MODE ? 'flex flex-1 flex-col justify-center' : undefined}>
                <ImageUploader
                  onImageSelect={handleImageSelect}
                  currentImage={productImage}
                  onImageRemove={handleImageRemove}
                />
              </div>
            )}
          </section>
        )}

        {activeView === 'create' && currentStep === 'details' && (
          <section className="reference-card p-5 sm:p-7">
            <div className="mb-6 flex gap-4 rounded-[22px] border border-[#e9e5ef] bg-white p-3 shadow-sm">
              <img src={productImage} alt="صورة القطعة المختارة" className="h-16 w-16 rounded-xl object-cover" />
              <div className="min-w-0 flex-1">
                <span className="text-xs font-bold text-primary">الصورة جاهزة</span>
                <h2 className="mt-1 text-xl font-black text-foreground">بيانات الإعلان</h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">يكفي اسم المنتج والسعر إن وجدا. أضف تفاصيل أكثر فقط إذا احتجت.</p>
              </div>
              <button
                type="button"
                onClick={() => setCurrentStep('upload')}
                className="self-start rounded-lg px-2 py-1 text-xs font-bold text-primary hover:bg-white"
              >
                تغيير
              </button>
            </div>

            <React.Suspense fallback={<PageLoading label="جارٍ تجهيز حقول الإعلان…" />}><AdDetailsForm details={adDetails} onChange={setAdDetails} generateCloudText={friendTestMode ? undefined : (details, preferences, variant) => marketingTextMutation.mutateAsync({ details, preferences, variant })} /></React.Suspense>

            <div className="reference-local-note mt-5"><BadgeCheck size={18} />سيجهّز التطبيق الخلفية والنص تلقائياً على الهاتف.</div>

            <button
              type="button"
              onClick={() => void generateAd()}
              className="reference-primary mt-5 w-full"
            >
              <Sparkles size={20} /> إنشاء الإعلان
            </button>
          </section>
        )}

        {activeView === 'create' && currentStep === 'final' && (
          <section className={WARDROBE_ROOM_MODE ? '' : 'space-y-5'} style={WARDROBE_ROOM_MODE ? { height: '100%', minHeight: 0 } : undefined}>
            <div className={`reference-card ${WARDROBE_ROOM_MODE ? 'p-2' : 'p-5 sm:p-7'}`} style={WARDROBE_ROOM_MODE ? { height: '100%', minHeight: 0, border: 'none', background: 'transparent', boxShadow: 'none' } : undefined}>
              {!WARDROBE_ROOM_MODE && <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700"><BadgeCheck size={15} /> {WARDROBE_ROOM_MODE ? 'صورة الاستديو جاهزة' : 'الإعلان جاهز'}</span>
                  <h2 className="mt-3 text-2xl font-black text-primary">{WARDROBE_ROOM_MODE ? 'قطعة الملابس جاهزة للعرض' : 'إعلانك أصبح جاهزاً'}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{WARDROBE_ROOM_MODE ? 'غيّر الخلفية أو الظل أو الحجم، ثم نزّل الصورة.' : 'راجع النتيجة ثم نزّلها أو شاركها مباشرة.'}</p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">{!WARDROBE_ROOM_MODE && <button type="button" disabled={isGenerating} onClick={() => { void regenerateWithCurrentSettings(); }} className="inline-flex items-center gap-1 rounded-xl bg-primary px-3 py-2 text-sm font-bold text-primary-foreground transition active:scale-95 disabled:opacity-50"><RotateCcw size={16} />{isGenerating ? 'جارٍ التحديث' : 'إعادة توليد بالتغييرات الجديدة'}</button>}<button
                    type="button"
                    onClick={() => { if (WARDROBE_ROOM_MODE) handleImageRemove(); else setCurrentStep('details'); }}
                    className="inline-flex items-center gap-1 rounded-xl bg-secondary px-3 py-2 text-sm font-bold text-primary transition active:scale-95"
                  >
                    <Pencil size={16} /> تعديل
                  </button></div>
              </div>}

              {isGenerating && (
                <div className="flex flex-1 flex-col items-center justify-center rounded-3xl bg-secondary/70 p-8 text-center" style={{ minHeight: 320 }}>
                  <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-white text-primary shadow-sm">
                    <Sparkles className="animate-pulse" size={28} />
                  </div>
                  <h3 className="text-lg font-black text-foreground">جارٍ توليد الإعلان</h3>
                  <p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground" aria-live="polite">{tryOnResult.message || 'نرتب القالب ونجهز الصورة. لا تغلق الصفحة الآن.'}</p>
                </div>
              )}

              {!isGenerating && generatedAd && WARDROBE_ROOM_MODE && (
                <div className="flex flex-col" style={{ height: '100%', minHeight: 0 }} aria-label="مساحة عمل غرفة الملابس">
                  <div className="relative flex flex-1 flex-col" style={{ minHeight: 0 }} aria-label="القالب ثابت وأدوات عائمة" onPointerDown={handleWardrobeWorkspacePointerDown}>
                    <div className="flex items-center justify-between gap-2 px-1 pb-2"><button type="button" onClick={returnToImagePicker} className="inline-flex min-h-9 items-center gap-1 rounded-xl border border-primary/15 bg-white px-2 text-[11px] font-black text-primary active:scale-95"><ArrowRight size={15} />صورة جديدة</button><span className="text-[11px] font-bold text-muted-foreground">اضغط أداة واحدة</span></div>
                    <div className="flex flex-1 items-center justify-center" style={{ minHeight: 0 }} aria-label="معاينة الإعلان داخل مساحة الهاتف"><img src={generatedAd} alt="معاينة قالب غرفة الملابس" className="mx-auto rounded-2xl border border-stone-100 bg-stone-50 object-contain shadow-sm" style={{ maxHeight: '100%', maxWidth: '100%', width: 'auto', height: 'auto' }} /></div>
                    {activeWardrobeTool && <WardrobeToolPanel tool={activeWardrobeTool} settings={templateSettings} details={adDetails} savedMarketingPreferences={merchantProfile.marketingPreferences} disabled={isGenerating} isMarketingGenerating={marketingTextMutation.isPending} onClose={() => setActiveWardrobeTool(null)} onChange={handleStudioAppearanceChange} onMarketingChange={handleMarketingDetailsChange} onGenerateMarketing={generateWardrobeMarketingText} onScaleCommit={handleProductScaleCommit} onRefine={() => { setActiveWardrobeTool(null); setIsRefinementStudioOpen(true); }} />}
                    <WardrobeToolBar activeTool={activeWardrobeTool} onTool={tool => setActiveWardrobeTool(current => current === tool ? null : tool)} onDownload={handleDownload} onShareImage={() => void handleShareImageOnly()} onShareWhatsApp={() => void handleWhatsApp()} />
                  </div>
                </div>
              )}

              {!isGenerating && generatedAd && !WARDROBE_ROOM_MODE && (
                <>
                  <img
                    src={generatedAd}
                    alt="معاينة الإعلان النهائي"
                    className="mx-auto max-h-[560px] w-full rounded-3xl border border-stone-100 bg-stone-50 object-contain shadow-sm"
                  />
                  <ProductScaleControl scale={clampProductScale(templateSettings.productScale)} disabled={isGenerating} onCommit={handleProductScaleCommit} />
                  {!WARDROBE_ROOM_MODE && <React.Suspense fallback={null}><TryOnStatusNotice result={tryOnResult} /></React.Suspense>}
                </>
              )}

              {!isGenerating && tryOnResult.status === 'unavailable' && WARDROBE_ROOM_MODE && (
                <div className="flex flex-1 items-center justify-center" style={{ minHeight: 0 }}>
                  <div className="w-full rounded-2xl border border-red-200 bg-red-50 p-5 text-center" role="alert">
                    <p className="font-bold text-red-900">{tryOnResult.message}</p>
                    <div className="mt-3 flex justify-center gap-2"><button type="button" onClick={() => void generateAd()} className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-white">إعادة المحاولة</button><button type="button" onClick={returnToImagePicker} className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-900">صورة أخرى</button></div>
                  </div>
                </div>
              )}
              {!isGenerating && tryOnResult.status === 'unavailable' && !WARDROBE_ROOM_MODE && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-center" role="alert">
                  <p className="font-bold text-red-900">{tryOnResult.message}</p>
                  <button type="button" onClick={() => void generateAd()} className="mt-3 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-white">إعادة المحاولة</button>
                </div>
              )}
            </div>

            {!isGenerating && generatedAd && !WARDROBE_ROOM_MODE && (
              <>
                <section className="rounded-3xl bg-white p-5 shadow-[0_12px_30px_rgba(37,35,95,0.06)]">
                  <div className="mb-3 flex items-center justify-between gap-2 text-primary"><span className="flex items-center gap-2"><MessageCircle size={19} /><h3 className="font-black">نص الإعلان</h3></span><span className="text-[11px] font-bold text-muted-foreground">قابل للتحرير قبل المشاركة</span></div>
                  <textarea value={marketingText} onChange={event => { setMarketingText(event.target.value); setAdDetails(current => ({ ...current, marketingText: event.target.value })); }} className="min-h-28 w-full rounded-2xl border border-primary/15 bg-secondary/25 p-4 text-right text-sm leading-7 text-foreground outline-none transition focus:border-primary focus:bg-white" aria-label="تعديل نص الإعلان" />
                </section>
                {designPassport && <DesignPassportCard passport={designPassport} onDownload={handleDownloadPassport} />}
                {designContractReport && <DesignContractCard report={designContractReport} onApplyRepair={handleApplyContractRepair} historyEntries={(designHistory?.entries || []).map(entry => ({ id: entry.id, label: entry.label }))} historyFingerprint={designHistory ? designDocumentFingerprint(replayDesignHistory(designHistory)) : undefined} canUndoHistory={Boolean(designHistory?.entries.length)} canRedoHistory={Boolean(designRedoEntries.length)} onReplayHistory={handleReplayHistory} onUndoHistory={handleUndoHistory} onRedoHistory={handleRedoHistory} onRemoveHistoryEntry={handleRemoveHistoryEntry} />}
                {qualityGateReport && <React.Suspense fallback={null}><DesignQualityGateCard report={qualityGateReport} onApplyRepair={handleApplyContractRepair} visualRepairStatus={visualRepairStatus} onUndoVisualRepair={visualRepairSnapshot ? handleUndoVisualRepair : undefined} /></React.Suspense>}
                <React.Suspense fallback={<PageLoading label="جارٍ تجهيز خيارات المشاركة…" />}><SharePanel onDownload={handleDownload} onShare={handleShare} onWhatsApp={handleWhatsApp} onQualityCheck={handleCreatePassport} onContractCheck={handleCheckDesignContract} onExportGateCheck={handleCheckQualityGate} isQualityChecking={isCreatingPassport} isContractChecking={isCheckingDesignContract} isExportGateChecking={isCheckingQualityGate} exportBlocked={qualityGateReport?.exportAllowed === false} onEdit={() => setCurrentStep('details')} onClear={clearAdSession} /></React.Suspense>
              </>
            )}
          </section>
        )}
      </main>

      {isRefinementStudioOpen && productImage && <React.Suspense fallback={<PageLoading label="جارٍ فتح استوديو التنقيح المحلي…" />}><ImageRefinementStudio source={productImage} onClose={() => setIsRefinementStudioOpen(false)} onApply={image => { setIsRefinementStudioOpen(false); handleImageSelect(image); toast.success('استبدلنا صورة القطعة بالنسخة المنقحة محلياً.'); }} /></React.Suspense>}

      {!WARDROBE_ROOM_MODE && <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[#ece8f0] bg-[#fdfbf8]/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl" aria-label="التنقل الرئيسي">
        <div className={`mx-auto grid max-w-md gap-2 ${WARDROBE_ROOM_MODE ? 'grid-cols-2' : 'grid-cols-4'}`}>
          <button type="button" onClick={() => setActiveView('settings')} aria-current={activeView === 'settings' ? 'page' : undefined} className={`flex flex-col items-center gap-1 rounded-2xl py-2 text-xs transition active:scale-95 ${activeView === 'settings' ? 'bg-primary/10 text-primary' : 'font-medium text-muted-foreground hover:bg-primary/5'}`}><Settings size={20} />الإعدادات</button>
          {!WARDROBE_ROOM_MODE && <button type="button" onClick={() => setActiveView('batch')} aria-current={activeView === 'batch' ? 'page' : undefined} className={`flex flex-col items-center gap-1 rounded-2xl py-2 text-xs transition active:scale-95 ${activeView === 'batch' ? 'bg-primary/10 text-primary' : 'font-medium text-muted-foreground hover:bg-primary/5'}`}><Images size={20} />دفعات</button>}
          {!WARDROBE_ROOM_MODE && <button type="button" onClick={() => setActiveView('assistant')} aria-current={activeView === 'assistant' ? 'page' : undefined} className={`flex flex-col items-center gap-1 rounded-2xl py-2 text-xs transition active:scale-95 ${activeView === 'assistant' ? 'bg-primary/10 text-primary' : 'font-medium text-muted-foreground hover:bg-primary/5'}`}><Bot size={20} />القائد</button>}
          <button type="button" onClick={() => setActiveView('create')} aria-current={activeView === 'create' ? 'page' : undefined} className={`flex flex-col items-center gap-1 rounded-2xl py-2 text-xs transition active:scale-95 ${activeView === 'create' ? 'bg-primary/10 text-primary shadow-sm' : 'font-medium text-muted-foreground hover:bg-primary/5'}`}><span className={`flex h-9 w-9 items-center justify-center rounded-full ${activeView === 'create' ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-white text-muted-foreground'}`}><Sparkles size={19} /></span>إنشاء</button>
        </div>
      </nav>
      }
    </div>
  );
}

function PageLoading({ label }: { label: string }) {
  return <div className="rounded-[28px] border border-primary/10 bg-white p-8 text-center shadow-[0_16px_40px_rgba(37,35,95,0.08)]"><div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><LoaderCircle className="animate-spin" size={22} /></div><p className="text-sm font-black text-primary">{label}</p><p className="mt-1 text-xs text-muted-foreground">لا تغلق الصفحة، ستظهر أدواتك خلال لحظات.</p></div>;
}

function LocalToolsSetupScreen({ state, onRetry }: { state: LocalToolSetupState; onRetry: () => void }) {
  const isFailed = state.status === 'failed';
  const isDone = state.status === 'success';
  return <main className="flex min-h-screen items-center justify-center bg-[#fffdf6] p-5 text-center" dir="rtl"><section className="w-full max-w-sm rounded-[30px] border border-primary/10 bg-white p-7 shadow-[0_16px_40px_rgba(37,35,95,0.08)]"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 text-primary">{isDone ? <Check size={30} /> : <LoaderCircle className={isFailed ? '' : 'animate-spin'} size={30} />}</div><h1 className="mt-5 text-xl font-black text-primary">{isDone ? 'تم تجهيز الأدوات' : isFailed ? 'تعذر تجهيز الأدوات' : 'نجهّز التطبيق لأول استخدام'}</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">{state.label}</p><div className="mt-6 h-3 overflow-hidden rounded-full bg-secondary" aria-label={`التجهيز ${state.progress}%`}><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${state.progress}%` }} /></div><p className="mt-2 text-sm font-black text-primary">{state.progress}%</p>{isFailed && <button type="button" onClick={onRetry} className="reference-primary mt-6 w-full"><RotateCcw size={18} />إعادة التحميل</button>}<p className="mt-5 text-[11px] leading-5 text-muted-foreground">تُحفظ الأدوات على هذا الهاتف، لذلك لا تحتاج إعادة تنزيلها عند كل استخدام.</p></section></main>;
}

function ProductScaleControl({ scale, disabled, onCommit }: { scale: number; disabled: boolean; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(scale);
  useEffect(() => setDraft(scale), [scale]);
  const commit = (value: number) => {
    const next = clampProductScale(value);
    setDraft(next);
    onCommit(next);
  };
  return <section className="mt-4 rounded-2xl border border-primary/10 bg-secondary/[0.18] p-4" dir="rtl" aria-label="حجم المنتج داخل الإعلان">
    <div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-black text-primary">حجم المنتج</h3><p className="mt-1 text-xs text-muted-foreground">اسحب للتحكم؛ يعاد رسم الإعلان محلياً فقط بعد الإفلات.</p></div><span className="rounded-xl bg-white px-3 py-2 text-sm font-black text-primary">{Math.round(draft * 100)}%</span></div>
    <div className="mt-4 flex items-center gap-3"><button type="button" disabled={disabled || draft <= PRODUCT_SCALE_MIN} onClick={() => commit(draft - PRODUCT_SCALE_STEP)} className="rounded-xl bg-white px-3 py-2 text-sm font-black text-primary shadow-sm disabled:opacity-50">أصغر</button><Slider value={[draft]} min={PRODUCT_SCALE_MIN} max={PRODUCT_SCALE_MAX} step={PRODUCT_SCALE_STEP} disabled={disabled} onValueChange={values => setDraft(clampProductScale(values[0] || DEFAULT_PRODUCT_SCALE))} onValueCommit={values => commit(values[0] || DEFAULT_PRODUCT_SCALE)} aria-label="تكبير أو تصغير المنتج" /><button type="button" disabled={disabled || draft >= PRODUCT_SCALE_MAX} onClick={() => commit(draft + PRODUCT_SCALE_STEP)} className="rounded-xl bg-primary px-3 py-2 text-sm font-black text-primary-foreground disabled:opacity-50">أكبر</button></div>
    {draft !== DEFAULT_PRODUCT_SCALE && <button type="button" disabled={disabled} onClick={() => commit(DEFAULT_PRODUCT_SCALE)} className="mt-3 text-xs font-black text-primary disabled:opacity-50">إعادة الحجم المحسّن</button>}
  </section>;
}

function WardrobeToolBar({ activeTool, onTool, onDownload, onShareImage, onShareWhatsApp }: { activeTool: WardrobeTool; onTool: (tool: Exclude<WardrobeTool, null>) => void; onDownload: () => void; onShareImage: () => void; onShareWhatsApp: () => void }) {
  const tools: Array<{ id: Exclude<WardrobeTool, null>; label: string; icon: React.ReactNode }> = [
    { id: 'refine', label: 'تعديل', icon: <Wand2 size={17} /> },
    { id: 'templates', label: 'قوالب', icon: <LayoutTemplate size={17} /> },
    { id: 'backdrop', label: 'خلفية', icon: <Palette size={17} /> },
    { id: 'shadow', label: 'عرض', icon: <Sparkles size={17} /> },
    { id: 'size', label: 'حجم', icon: <SlidersHorizontal size={17} /> },
    { id: 'format', label: 'مقاس', icon: <Maximize2 size={17} /> },
    { id: 'overlay', label: 'عنوان', icon: <Pencil size={17} /> },
    { id: 'marketing', label: 'نص', icon: <MessageSquareText size={17} /> },
  ];
  return <div className="shrink-0 border-t border-primary/10 bg-white pt-2"><div className="flex gap-2 pb-1" dir="rtl" style={{ overflowX: 'auto', scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}>{tools.map(tool => <button key={tool.id} type="button" aria-pressed={activeTool === tool.id} onClick={() => onTool(tool.id)} className={`flex h-14 flex-col items-center justify-center gap-1 rounded-xl border text-xs font-black transition active:scale-95 ${activeTool === tool.id ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'border-primary/15 bg-white text-primary'}`} style={{ width: 62, flexShrink: 0, scrollSnapAlign: 'start', fontSize: 10 }}>{tool.icon}<span>{tool.label}</span></button>)}</div><div className="mt-2 grid grid-cols-3 gap-2"><button type="button" onClick={onDownload} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-primary/20 bg-white px-2 text-[11px] font-black text-primary transition active:scale-95"><Send size={15} />تنزيل</button><button type="button" onClick={onShareImage} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-primary/20 bg-white px-2 text-[11px] font-black text-primary transition active:scale-95"><Check size={15} />الصورة</button><button type="button" onClick={onShareWhatsApp} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl bg-primary px-2 text-[11px] font-black text-primary-foreground shadow-sm transition active:scale-95"><MessageCircle size={15} />واتساب</button></div></div>;
}

function WardrobeToolPanel({ tool, settings, details, savedMarketingPreferences, disabled, isMarketingGenerating, onClose, onChange, onMarketingChange, onGenerateMarketing, onScaleCommit, onRefine }: { tool: Exclude<WardrobeTool, null>; settings: TemplateSettings; details: AdDetails; savedMarketingPreferences?: Partial<MarketingTextPreferences>; disabled: boolean; isMarketingGenerating: boolean; onClose: () => void; onChange: (patch: StudioAppearancePatch) => void; onMarketingChange: (patch: Partial<AdDetails>) => void; onGenerateMarketing: (details: AdDetails, preferences: MarketingTextPreferences, variant: number) => Promise<{ text: string; source: string; message?: string }>; onScaleCommit: (value: number) => void; onRefine: () => void }) {
  const backdrops: Array<{ id: NonNullable<TemplateSettings['productBackdrop']>; label: string }> = [{ id: 'soft', label: 'نظيف' }, { id: 'warm', label: 'دافئ' }, { id: 'cool', label: 'بارد' }, { id: 'spotlight', label: 'إضاءة' }, { id: 'rose', label: 'وردي' }, { id: 'sand', label: 'رملي' }];
  const shadows: Array<{ id: NonNullable<TemplateSettings['productShadow']>; label: string }> = [{ id: 'none', label: 'بلا ظل' }, { id: 'soft', label: 'ناعم' }, { id: 'grounded', label: 'أرضي' }];
  const [overlayLayer, setOverlayLayer] = useState<'caption' | 'price'>('caption');
  const currentScale = clampProductScale(settings.productScale);
  const title = tool === 'backdrop' ? 'خلفية القالب' : tool === 'templates' ? 'قوالب ملونة' : tool === 'shadow' ? 'عرض المنتج' : tool === 'size' ? 'حجم المنتج' : tool === 'format' ? 'مقاسات القالب' : tool === 'overlay' ? 'العنوان' : tool === 'marketing' ? 'نص تسويقي' : 'تعديل الصورة';
  const panelPosition = tool === 'overlay' && overlayLayer === 'price' ? { top: 44, left: 12, right: 12 } : { bottom: 96, left: 12, right: 12 };
  return <section data-wardrobe-tool-panel className="absolute z-20 rounded-2xl border border-primary/15 bg-white p-2 shadow-xl" style={panelPosition} aria-label={title}><h3 className="mb-1 text-sm font-black text-primary">{title}</h3>{tool === 'backdrop' && <div className="grid grid-cols-3 gap-2">{backdrops.map(item => <button key={item.id} type="button" disabled={disabled} onClick={() => onChange({ productBackdrop: item.id })} className={`rounded-xl border px-2 py-2 text-xs font-black ${(settings.productBackdrop || 'soft') === item.id ? 'border-primary bg-primary text-primary-foreground' : 'border-primary/10 bg-secondary text-primary'}`}>{item.label}</button>)}</div>}{tool === 'templates' && <div><p className="mb-2 text-[11px] font-bold text-muted-foreground">اسحب واختر لوناً. لا يغيّر هذا القماش أو الصورة.</p><div className="flex gap-2 pb-1" dir="rtl" style={{ overflowX: 'auto', scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}>{WARDROBE_TEMPLATE_OPTIONS.map(item => <button key={item.id} type="button" disabled={disabled} aria-pressed={settings.productBackdrop === item.id} onClick={() => onChange({ productBackdrop: item.id })} className={`rounded-xl border p-1 text-center text-xs font-black ${settings.productBackdrop === item.id ? 'border-primary ring-1 ring-primary' : 'border-primary/15'}`} style={{ width: 74, flexShrink: 0, scrollSnapAlign: 'start', background: `linear-gradient(145deg, ${item.colors[0]}, ${item.colors[1]})`, fontSize: 10 }}><span className="mx-auto block h-6 w-9 rounded-lg border" style={{ borderColor: 'rgba(255,255,255,.7)', backgroundColor: 'rgba(255,255,255,.35)' }} /><span className="mt-1 block text-primary">{item.label}</span><span className="block text-xs" style={{ color: 'rgba(57,34,124,.7)', fontSize: 9 }}>{item.category}</span></button>)}</div></div>}{tool === 'shadow' && <div><div className="grid grid-cols-3 gap-2">{shadows.map(item => <button key={item.id} type="button" disabled={disabled} onClick={() => onChange({ productShadow: item.id })} className={`rounded-xl border px-2 py-2 text-xs font-black ${(settings.productShadow || 'grounded') === item.id ? 'border-primary bg-primary text-primary-foreground' : 'border-primary/10 bg-secondary text-primary'}`}>{item.label}</button>)}</div><div className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-secondary p-2"><span className="text-[11px] font-black text-primary">العرض</span><div className="grid grid-cols-3 gap-1"><button type="button" disabled={disabled} onClick={() => onChange({ productPresentation: 'flat' })} className={`rounded-lg px-2 py-1 text-xs font-black ${(settings.productPresentation || 'flat') === 'flat' ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground'}`} style={{ fontSize: 10 }}>2D أصلي</button><button type="button" disabled={disabled} onClick={() => onChange({ productPresentation: 'lifted' })} className={`rounded-lg px-2 py-1 text-xs font-black ${(settings.productPresentation || 'flat') === 'lifted' ? 'bg-primary text-primary-foreground' : 'text-primary'}`} style={{ fontSize: 10 }}>2.5D مرتفع</button><button type="button" disabled={disabled} onClick={() => onChange({ productPresentation: 'platform' })} className={`rounded-lg px-2 py-1 text-xs font-black ${(settings.productPresentation || 'flat') === 'platform' ? 'bg-primary text-primary-foreground' : 'text-primary'}`} style={{ fontSize: 10 }}>منصة</button></div></div></div>}{tool === 'size' && <div className="flex items-center gap-3"><button type="button" disabled={disabled || currentScale <= PRODUCT_SCALE_MIN} onClick={() => onScaleCommit(clampProductScale(currentScale - PRODUCT_SCALE_STEP))} className="rounded-xl bg-secondary px-3 py-2 text-xs font-black text-primary">أصغر</button><Slider value={[currentScale]} min={PRODUCT_SCALE_MIN} max={PRODUCT_SCALE_MAX} step={PRODUCT_SCALE_STEP} disabled={disabled} onValueCommit={values => onScaleCommit(clampProductScale(values[0]))} aria-label="حجم المنتج" /><button type="button" disabled={disabled || currentScale >= PRODUCT_SCALE_MAX} onClick={() => onScaleCommit(clampProductScale(currentScale + PRODUCT_SCALE_STEP))} className="rounded-xl bg-primary px-3 py-2 text-xs font-black text-primary-foreground">أكبر</button></div>}{tool === 'format' && <WardrobeSizePicker selected={settings.size} disabled={disabled} onSelect={size => onChange({ size })} />}{tool === 'overlay' && <FloatingOverlayEditor settings={settings} disabled={disabled} onChange={onChange} onLayerChange={setOverlayLayer} />}{tool === 'marketing' && <WardrobeMarketingTextTool details={details} savedPreferences={savedMarketingPreferences} disabled={disabled} isGenerating={isMarketingGenerating} onChange={onMarketingChange} onGenerate={onGenerateMarketing} />}{tool === 'refine' && <div><p className="text-sm text-muted-foreground">عدّل الحواف فقط عند الحاجة، ثم عد إلى القالب.</p><button type="button" disabled={disabled} onClick={onRefine} className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-1 rounded-xl bg-primary px-2 text-[11px] font-black text-primary-foreground shadow-sm transition active:scale-95"><Wand2 size={17} />فتح التعديل</button></div>}</section>;
}

function WardrobeSizePicker({ selected, disabled, onSelect }: { selected: TemplateSize; disabled: boolean; onSelect: (size: TemplateSize) => void }) {
  return <div><p className="mb-2 text-[11px] font-bold text-muted-foreground">اسحب الشريط يميناً أو شمالاً، ثم اختر نسبة واحدة للقالب.</p><div className="flex gap-2 pb-1" dir="rtl" aria-label="نسب مقاسات القالب" style={{ overflowX: 'auto', scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}>{WARDROBE_SIZE_OPTIONS.map(option => <button key={option.id} type="button" disabled={disabled} aria-pressed={selected === option.id} onClick={() => onSelect(option.id)} className={`rounded-xl px-4 py-3 text-center text-xs font-black ${selected === option.id ? 'bg-primary text-primary-foreground' : 'bg-secondary text-primary'}`} style={{ minWidth: 88, flexShrink: 0, scrollSnapAlign: 'start' }}><span className="block text-base leading-none">{option.ratio}</span><span className="mt-1 block text-[10px]">{option.label}</span></button>)}</div></div>;
}

function WardrobeMarketingTextTool({ details, savedPreferences, disabled, isGenerating, onChange, onGenerate }: { details: AdDetails; savedPreferences?: Partial<MarketingTextPreferences>; disabled: boolean; isGenerating: boolean; onChange: (patch: Partial<AdDetails>) => void; onGenerate: (details: AdDetails, preferences: MarketingTextPreferences, variant: number) => Promise<{ text: string; source: string; message?: string }> }) {
  const [variant, setVariant] = useState(0);
  const [notice, setNotice] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const preferences = resolveMarketingTextPreferences({ ...DEFAULT_MARKETING_TEXT_PREFERENCES, ...details.marketingPreferences, ...savedPreferences });
  const updatePreferences = (patch: Partial<MarketingTextPreferences>) => onChange({ marketingPreferences: { ...preferences, ...patch } });
  const updateDetails = (patch: Partial<AdDetails>) => onChange(patch);
  const generate = async () => {
    const nextVariant = variant + 1;
    setVariant(nextVariant);
    const result = await onGenerate({ ...details, marketingPreferences: preferences }, preferences, nextVariant);
    setNotice(`${result.message || 'الرسالة جاهزة.'} اضغط «واتساب + نص» أسفل القالب للإرسال.`);
  };
  const campaignOptions = Object.entries(MARKETING_TEXT_CAMPAIGN_LABELS) as Array<[MarketingTextCampaign, string]>;
  const lengthOptions: Array<[MarketingTextLength, string]> = [['short', 'أساسي'], ['medium', 'متوسط'], ['long', 'كبير']];
  const emphasisOptions = Object.entries(MARKETING_TEXT_EMPHASIS_LABELS) as Array<[MarketingTextEmphasis, string]>;

  return <div>
    <p className="mb-2 text-[11px] font-bold text-muted-foreground">اكتب اسم القطعة والكمية فقط. بيانات المركز المحفوظة تدخل تلقائياً ولا تظهر داخل الصورة.</p>
    <div className="grid grid-cols-2 gap-2">
      <input value={details.productName} disabled={disabled} onChange={event => updateDetails({ productName: event.target.value })} placeholder="اسم القطعة" className="min-h-10 rounded-xl border border-primary/10 px-3 text-xs text-foreground outline-none focus:border-primary" aria-label="اسم القطعة للنص التسويقي" />
      <input value={details.quantity} disabled={disabled} onChange={event => updateDetails({ quantity: event.target.value })} placeholder="الكمية (اختياري)" className="min-h-10 rounded-xl border border-primary/10 px-3 text-xs text-foreground outline-none focus:border-primary" aria-label="الكمية المتاحة" />
    </div>
    <div className="mt-2 grid grid-cols-2 gap-2">
      <button type="button" disabled={disabled || isGenerating} onClick={() => void generate()} className="reference-primary w-full">{isGenerating ? <><LoaderCircle className="animate-spin" size={16} />جارٍ التجهيز…</> : <><MessageSquareText size={16} />جهّز النص</>}</button>
      <button type="button" disabled={disabled} onClick={() => setShowOptions(value => !value)} className="reference-outline w-full"><SlidersHorizontal size={16} />خيارات</button>
    </div>
    {showOptions && <div className="mt-2 rounded-xl bg-secondary/70 p-2"><div className="grid grid-cols-2 gap-2">
      <select value={preferences.campaign} disabled={disabled} onChange={event => updatePreferences({ campaign: event.target.value as MarketingTextCampaign })} className="min-h-9 rounded-lg border border-primary/10 bg-white px-2 text-[11px] font-black text-primary outline-none focus:border-primary" aria-label="أسلوب النص التسويقي">{campaignOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
      <select value={preferences.length} disabled={disabled} onChange={event => updatePreferences({ length: event.target.value as MarketingTextLength })} className="min-h-9 rounded-lg border border-primary/10 bg-white px-2 text-[11px] font-black text-primary outline-none focus:border-primary" aria-label="حجم النص التسويقي">{lengthOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
      <select value={preferences.emphasis} disabled={disabled} onChange={event => updatePreferences({ emphasis: event.target.value as MarketingTextEmphasis, format: 'whatsapp' })} className="min-h-9 rounded-lg border border-primary/10 bg-white px-2 text-[11px] font-black text-primary outline-none focus:border-primary" aria-label="تنسيق نص واتساب">{emphasisOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
      <input value={details.price} disabled={disabled} inputMode="numeric" onChange={event => updateDetails({ price: event.target.value, currency: details.currency || 'ريال' })} placeholder="السعر (اختياري)" className="min-h-9 min-w-0 rounded-lg border border-primary/10 px-2 text-[11px] text-foreground outline-none focus:border-primary" aria-label="السعر للنص التسويقي" />
      <input value={details.storePhone} disabled={disabled} inputMode="tel" onChange={event => updateDetails({ storePhone: event.target.value })} placeholder="رقم التوصيل (اختياري)" className="min-h-9 min-w-0 rounded-lg border border-primary/10 px-2 text-[11px] text-foreground outline-none focus:border-primary" aria-label="رقم التوصيل وواتساب" />
      <input value={details.discount} disabled={disabled} inputMode="decimal" onChange={event => updateDetails({ discount: event.target.value })} placeholder="الخصم (اختياري)" className="min-h-9 min-w-0 rounded-lg border border-primary/10 px-2 text-[11px] text-foreground outline-none focus:border-primary" aria-label="الخصم" />
    </div></div>}
    {notice && <p className="mt-2 text-[10px] leading-4 text-muted-foreground" aria-live="polite">{notice}</p>}
  </div>;
}

function FloatingOverlayEditor({ settings, disabled, onChange, onLayerChange }: { settings: TemplateSettings; disabled: boolean; onChange: (patch: StudioAppearancePatch) => void; onLayerChange: (layer: 'caption' | 'price') => void }) {
  const [layer, setLayer] = useState<'caption' | 'price'>('caption');
  const [showAppearance, setShowAppearance] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const isCaption = layer === 'caption';
  const value = isCaption ? settings.studioCaption || '' : settings.studioPrice || '';
  const help = getWardrobeOverlayHelp(layer);
  const textColor = isCaption ? settings.studioCaptionTextColor || '#111827' : settings.studioPriceTextColor || '#111827';
  const backgroundColor = isCaption ? settings.studioCaptionBackgroundColor || '' : settings.studioPriceBackgroundColor || '';
  const position = isCaption ? settings.studioCaptionPosition || { x: .73, y: .055 } : settings.studioPricePosition || { x: .78, y: .89 };
  useEffect(() => {
    if (value.trim()) { setShowHint(false); return; }
    const timeout = window.setTimeout(() => setShowHint(true), 2400);
    return () => window.clearTimeout(timeout);
  }, [layer, value]);
  const updatePosition = (dx: number, dy: number) => { const next: StudioOverlayPosition = { x: Number(Math.min(.86, Math.max(.14, position.x + dx)).toFixed(2)), y: Number(Math.min(.9, Math.max(.04, position.y + dy)).toFixed(2)) }; onChange(isCaption ? { studioCaptionPosition: next } : { studioPricePosition: next }); };
  const selectLayer = (next: 'caption' | 'price') => { setLayer(next); setShowHint(false); onLayerChange(next); };
  return <div><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => selectLayer('caption')} className={`rounded-xl px-3 py-2 text-xs font-black ${isCaption ? 'bg-primary text-primary-foreground' : 'bg-secondary text-primary'}`}>العنوان</button><button type="button" onClick={() => selectLayer('price')} className={`rounded-xl px-3 py-2 text-xs font-black ${!isCaption ? 'bg-primary text-primary-foreground' : 'bg-secondary text-primary'}`}>السعر</button></div><div className="relative"><input value={value} disabled={disabled} maxLength={isCaption ? 80 : 32} onFocus={() => setShowHint(false)} onChange={event => { setShowHint(false); onChange(isCaption ? { studioCaption: event.target.value } : { studioPrice: event.target.value }); }} placeholder={help.placeholder} className="mt-2 min-h-11 w-full rounded-xl border border-primary/10 px-3 text-sm text-foreground outline-none focus:border-primary" aria-label={isCaption ? 'عنوان الصورة' : 'سعر الصورة'} />{showHint && <span className="rounded-lg bg-primary/5 px-2 py-1 text-[10px] font-bold text-primary" style={{ pointerEvents: 'none', position: 'absolute', left: 8, right: 8, top: 12 }}>{help.hint}</span>}</div><div className="mt-2 flex items-center justify-between gap-2"><button type="button" disabled={disabled} onClick={() => setShowAppearance(current => !current)} className="rounded-xl bg-secondary px-3 py-2 text-xs font-black text-primary">ألوان</button><span className="text-[10px] font-bold text-muted-foreground">الأسهم تحركه مباشرة</span></div>{showAppearance && <div className="mt-2 grid grid-cols-2 gap-2"><ColorControl label="لون الخط" value={textColor} disabled={disabled} onChange={color => onChange(isCaption ? { studioCaptionTextColor: color } : { studioPriceTextColor: color })} /><BackgroundToggle active={Boolean(backgroundColor)} label="خلفية" disabled={disabled} onToggle={() => onChange(isCaption ? { studioCaptionBackgroundColor: backgroundColor ? '' : '#ff5757' } : { studioPriceBackgroundColor: backgroundColor ? '' : '#ffe600' })} /></div>}{showAppearance && backgroundColor && <ColorControl label="لون الخلفية" value={backgroundColor} disabled={disabled} onChange={color => onChange(isCaption ? { studioCaptionBackgroundColor: color } : { studioPriceBackgroundColor: color })} />}<div className="mx-auto mt-2 grid grid-cols-3 gap-2" style={{ width: 144 }}><span /><MoveButton label="أعلى" disabled={disabled} onClick={() => updatePosition(0, -.04)}><ArrowUp size={16} /></MoveButton><span /><MoveButton label="يمين" disabled={disabled} onClick={() => updatePosition(.04, 0)}><ArrowRight size={16} /></MoveButton><span /><MoveButton label="يسار" disabled={disabled} onClick={() => updatePosition(-.04, 0)}><ArrowLeft size={16} /></MoveButton><span /><MoveButton label="أسفل" disabled={disabled} onClick={() => updatePosition(0, .04)}><ArrowDown size={16} /></MoveButton><span /></div></div>;
}

type StudioAppearancePatch = Partial<Pick<TemplateSettings, 'size' | 'productBackdrop' | 'productShadow' | 'productPresentation' | 'studioCaption' | 'studioCaptionTextColor' | 'studioCaptionBackgroundColor' | 'studioCaptionPosition' | 'studioPrice' | 'studioPriceTextColor' | 'studioPriceBackgroundColor' | 'studioPricePosition'>>;

function StudioAppearanceControls({ settings, disabled, onChange }: { settings: TemplateSettings; disabled: boolean; onChange: (patch: StudioAppearancePatch) => void }) {
  const backdrops: Array<{ id: NonNullable<TemplateSettings['productBackdrop']>; label: string }> = [
    { id: 'soft', label: 'نظيف' }, { id: 'warm', label: 'دافئ' }, { id: 'cool', label: 'بارد' }, { id: 'spotlight', label: 'إضاءة' }, { id: 'rose', label: 'وردي' }, { id: 'sand', label: 'رملي' },
  ];
  const shadows: Array<{ id: NonNullable<TemplateSettings['productShadow']>; label: string }> = [
    { id: 'none', label: 'بلا ظل' }, { id: 'soft', label: 'ناعم' }, { id: 'grounded', label: 'أرضي' },
  ];
  const update = (patch: StudioAppearancePatch) => onChange(patch);
  return <section className="mt-4 rounded-2xl border border-primary/10 bg-secondary/[0.18] p-4" aria-label="ضبط غرفة الملابس">
    <div className="flex items-center gap-2 text-primary"><Palette size={18} /><h3 className="text-sm font-black">غرفة الملابس</h3></div>
    <p className="mt-1 text-xs leading-5 text-muted-foreground">الخلفية تغيّر القالب كاملاً، والظل يوضع أسفل القطعة المفرغة محلياً.</p>
    <div className="mt-3"><span className="text-xs font-black text-primary">خلفية القالب كاملة</span><div className="mt-2 grid grid-cols-3 gap-2">{backdrops.map(backdrop => <button key={backdrop.id} type="button" disabled={disabled} aria-pressed={(settings.productBackdrop || 'auto') === backdrop.id} onClick={() => update({ productBackdrop: backdrop.id })} className={`rounded-xl px-2 py-2 text-xs font-black transition active:scale-95 disabled:opacity-50 ${(settings.productBackdrop || 'auto') === backdrop.id ? 'bg-primary text-primary-foreground' : 'bg-white text-primary shadow-sm'}`}>{backdrop.label}</button>)}</div></div>
    <div className="mt-3"><span className="text-xs font-black text-primary">الظل تحت المنتج</span><div className="mt-2 grid grid-cols-3 gap-2">{shadows.map(shadow => <button key={shadow.id} type="button" disabled={disabled} aria-pressed={(settings.productShadow || 'soft') === shadow.id} onClick={() => update({ productShadow: shadow.id })} className={`rounded-xl px-2 py-2 text-xs font-black transition active:scale-95 disabled:opacity-50 ${(settings.productShadow || 'soft') === shadow.id ? 'bg-primary text-primary-foreground' : 'bg-white text-primary shadow-sm'}`}>{shadow.label}</button>)}</div></div>
    <StudioOverlayEditor settings={settings} disabled={disabled} onChange={update} />
  </section>;
}

function StudioOverlayEditor({ settings, disabled, onChange }: { settings: TemplateSettings; disabled: boolean; onChange: (patch: StudioAppearancePatch) => void }) {
  const [open, setOpen] = useState(false);
  const [layer, setLayer] = useState<'caption' | 'price'>('caption');
  const isCaption = layer === 'caption';
  const value = isCaption ? settings.studioCaption || '' : settings.studioPrice || '';
  const textColor = isCaption ? settings.studioCaptionTextColor || '#111827' : settings.studioPriceTextColor || '#111827';
  const backgroundColor = isCaption ? settings.studioCaptionBackgroundColor || '' : settings.studioPriceBackgroundColor || '';
  const position = isCaption ? settings.studioCaptionPosition || { x: .73, y: .055 } : settings.studioPricePosition || { x: .78, y: .89 };
  const updatePosition = (dx: number, dy: number) => {
    const next: StudioOverlayPosition = { x: Number(Math.min(.86, Math.max(.14, position.x + dx)).toFixed(2)), y: Number(Math.min(.9, Math.max(.04, position.y + dy)).toFixed(2)) };
    onChange(isCaption ? { studioCaptionPosition: next } : { studioPricePosition: next });
  };
  const updateValue = (next: string) => onChange(isCaption ? { studioCaption: next } : { studioPrice: next });
  const updateTextColor = (next: string) => onChange(isCaption ? { studioCaptionTextColor: next } : { studioPriceTextColor: next });
  const updateBackgroundColor = (next: string) => onChange(isCaption ? { studioCaptionBackgroundColor: next } : { studioPriceBackgroundColor: next });
  const toggleBackground = () => updateBackgroundColor(backgroundColor ? '' : isCaption ? '#ff5757' : '#ffe600');
  return <div className="mt-4 border-t border-primary/10 pt-4"><button type="button" disabled={disabled} aria-expanded={open} onClick={() => setOpen(current => !current)} className="flex min-h-11 w-full items-center justify-between rounded-xl bg-white px-3 text-sm font-black text-primary shadow-sm disabled:opacity-50"><span className="flex items-center gap-2"><Pencil size={17} />نص وسعر</span><span className="text-xs">{open ? 'إغلاق' : 'إضافة أو تحريك'}</span></button>{open && <div className="mt-3 rounded-xl bg-white p-3 shadow-sm"><div className="flex items-center justify-between gap-2"><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setLayer('caption')} className={`rounded-lg px-3 py-2 text-xs font-black ${isCaption ? 'bg-primary text-primary-foreground' : 'bg-secondary text-primary'}`}>النص</button><button type="button" onClick={() => setLayer('price')} className={`rounded-lg px-3 py-2 text-xs font-black ${!isCaption ? 'bg-primary text-primary-foreground' : 'bg-secondary text-primary'}`}>السعر</button></div><button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-xs font-black text-primary">تم</button></div><label className="mt-3 block text-xs font-bold text-primary">{isCaption ? 'اكتب النص' : 'اكتب السعر'}<input value={value} disabled={disabled} maxLength={isCaption ? 80 : 32} onChange={event => updateValue(event.target.value)} placeholder={isCaption ? 'متوفر لدى مركز السعر المناسب' : 'السعر 500'} className="mt-2 min-h-11 w-full rounded-xl border border-primary/10 px-3 text-sm text-foreground outline-none focus:border-primary disabled:opacity-50" /></label><div className="mt-2 grid grid-cols-2 gap-2"><ColorControl label="لون الخط" value={textColor} disabled={disabled} onChange={updateTextColor} /><BackgroundToggle active={Boolean(backgroundColor)} label="خلفية" disabled={disabled} onToggle={toggleBackground} /></div>{backgroundColor && <ColorControl label="لون الخلفية" value={backgroundColor} disabled={disabled} onChange={updateBackgroundColor} />}<div className="mt-3 border-t border-primary/10 pt-3"><p className="text-xs font-black text-primary">حرّك داخل الصورة</p><div className="mx-auto mt-2 grid grid-cols-3 gap-2" style={{ width: 144 }}><span /><MoveButton label="أعلى" disabled={disabled} onClick={() => updatePosition(0, -.04)}><ArrowUp size={16} /></MoveButton><span /><MoveButton label="يمين" disabled={disabled} onClick={() => updatePosition(.04, 0)}><ArrowRight size={16} /></MoveButton><span className="flex items-center justify-center text-xs font-bold text-muted-foreground">حرّك</span><MoveButton label="يسار" disabled={disabled} onClick={() => updatePosition(-.04, 0)}><ArrowLeft size={16} /></MoveButton><span /><MoveButton label="أسفل" disabled={disabled} onClick={() => updatePosition(0, .04)}><ArrowDown size={16} /></MoveButton><span /></div></div></div>}</div>;
}

function MoveButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" aria-label={label} disabled={disabled} onClick={onClick} className="flex h-9 items-center justify-center rounded-lg bg-secondary text-primary disabled:opacity-50">{children}</button>; }

function ColorControl({ label, value, disabled, onChange }: { label: string; value: string; disabled: boolean; onChange: (value: string) => void }) { return <label className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-primary">{label}<input type="color" value={value} disabled={disabled} onChange={event => onChange(event.target.value)} className="h-7 w-9 cursor-pointer border-0 bg-transparent p-0 disabled:cursor-not-allowed" /></label>; }
function BackgroundToggle({ active, label, disabled, onToggle }: { active: boolean; label: string; disabled: boolean; onToggle: () => void }) { return <button type="button" disabled={disabled} onClick={onToggle} className={`rounded-xl px-3 py-2 text-xs font-bold disabled:opacity-50 ${active ? 'bg-primary text-primary-foreground' : 'bg-white text-primary shadow-sm'}`}>{label}: {active ? 'مفعّلة' : 'بدون'}</button>; }

function clampProductScale(value?: number) {
  const safe = Number.isFinite(value) ? Number(value) : DEFAULT_PRODUCT_SCALE;
  const stepped = Math.round(safe / PRODUCT_SCALE_STEP) * PRODUCT_SCALE_STEP;
  return Math.min(PRODUCT_SCALE_MAX, Math.max(PRODUCT_SCALE_MIN, Number(stepped.toFixed(2))));
}

function SingleImageReview({ simple = false, image, suggestion, comparisonPreviews, isDesignAnalyzing, localPreparation, benchmarks, regression, selectedSize, currentSize, preferenceEnabled, accepted, onSelectSize, onAcceptSuggestion, onIgnoreSuggestion, onUndoSuggestion, onTogglePreferences, onClearPreferences, onImageSelect, onImageRemove, onContinue }: { simple?: boolean; image: string; suggestion: DesignSuggestion | null; comparisonPreviews: { current: string; suggested: string } | null; isDesignAnalyzing: boolean; localPreparation: { status: 'idle' | 'analyzing' | 'ready' | 'failed'; cache?: 'hit' | 'miss'; elapsedMs?: number }; benchmarks: DesignBenchmark[]; regression: DesignRegression | null; selectedSize: TemplateSize; currentSize: TemplateSize; preferenceEnabled: boolean; accepted: boolean; onSelectSize: (size: TemplateSize) => void; onAcceptSuggestion: () => void; onIgnoreSuggestion: () => void; onUndoSuggestion: () => void; onTogglePreferences: () => void; onClearPreferences: () => void; onImageSelect: (imageUrl: string) => void; onImageRemove: () => void; onContinue: () => void }) {
  return <div className="space-y-5">
    <div className="rounded-2xl border border-primary/10 bg-primary/[0.045] p-4">
      <div className="flex items-start gap-3"><BadgeCheck size={20} className="mt-0.5 shrink-0 text-primary" /><div><h3 className="text-sm font-black text-primary">{simple ? 'القطعة جاهزة للاستديو' : 'راجع الصورة قبل المتابعة'}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{simple ? 'يمكنك تنقيح الحواف محلياً عند الحاجة، ثم أنشئ صورة الاستديو مباشرة.' : 'تأكد أن قطعة الملابس واضحة. يمكنك تغيير الصورة أو حذفها والعودة للرفع.'}</p></div></div>
    </div>
    <ImageUploader onImageSelect={onImageSelect} currentImage={image} onImageRemove={onImageRemove} />
    <button type="button" onClick={() => window.dispatchEvent(new Event('clothing-ad:open-refinement-studio'))} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-white px-4 text-sm font-black text-primary transition active:scale-[.98]"><Wand2 size={18} />تنقيح صورة القطعة محلياً</button>
    {!simple && isDesignAnalyzing && <div className="rounded-2xl bg-primary/[.05] p-4 text-center text-sm font-bold text-primary"><LoaderCircle className="ml-2 inline animate-spin" size={17} />يحلل المصمم المحلي الصورة على هذا الهاتف…</div>}
    {!simple && localPreparation.status === 'ready' && <div className="rounded-xl bg-primary/[.05] px-3 py-2 text-center text-xs font-bold text-primary">{localPreparation.cache === 'hit' ? 'تمت استعادة تحليل محلي محفوظ للصورة نفسها' : 'اكتمل تحليل الجودة والألوان والتخطيط محلياً'}{typeof localPreparation.elapsedMs === 'number' && ` خلال ${localPreparation.elapsedMs}ms`}</div>}
    {!simple && localPreparation.status === 'failed' && <div className="rounded-xl bg-primary/[.05] px-3 py-2 text-center text-xs font-bold text-primary">تعذر التحليل المسبق؛ يمكنك متابعة إنشاء الإعلان محلياً كالمعتاد.</div>}
    {!simple && suggestion && <LocalDesignSuggestionCard suggestion={suggestion} selectedSize={selectedSize} currentSize={currentSize} onSelectSize={onSelectSize} onAccept={onAcceptSuggestion} onIgnore={onIgnoreSuggestion} onUndo={onUndoSuggestion} accepted={accepted} preferencesEnabled={preferenceEnabled} onTogglePreferences={onTogglePreferences} onClearPreferences={onClearPreferences} comparisonPreviews={comparisonPreviews} benchmarks={benchmarks} regression={regression} />}
    <button type="button" onClick={onContinue} className="reference-primary w-full"><Sparkles size={20} />{simple ? 'إنشاء صورة الاستديو' : 'متابعة إلى بيانات الإعلان'}</button>
  </div>;
}

function hasMeaningfulDraft(details: AdDetails) {
  const textFields = [details.productName, details.headline, details.discount, details.quantity, details.price, details.storeName, details.storePhone, details.marketingText];
  return textFields.some(value => value.trim().length > 0) || details.colors.length > 0;
}

function getLocalStageMessage(stage: LocalRemovalStage) {
  const messages: Record<LocalRemovalStage, string> = {
    downloading: `نجهّز أداة الإزالة المحلية للمرة الأولى (نحو ${formatLocalModelSize()})…`,
    loading: 'نشغّل أداة الإزالة على الهاتف…',
    processing: 'نفصل الملابس عن الخلفية…',
    finishing: 'نجهّز الصورة للإعلان…',
  };
  return messages[stage];
}

function formatLocalDuration(milliseconds: number) {
  if (milliseconds < 1_000) return 'أقل من ثانية';
  const seconds = milliseconds / 1_000;
  return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)} ثانية`;
}

/** الصور الرأسية غالباً صور شخص؛ نعرضها بكامل ارتفاعها بدلاً من تكبير قد يقص الرأس أو الأطراف. */
function shouldPreserveFullHeight(image: { width?: number; height?: number }): boolean {
  if (!image.width || !image.height) return false;
  const ratio = image.width / Math.max(1, image.height);
  return ratio >= .42 && ratio <= .9 && image.height > image.width;
}

function withTimeout<T>(promise: Promise<T>, milliseconds: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(message)), milliseconds);
    promise.then(
      result => {
        window.clearTimeout(timeout);
        resolve(result);
      },
      error => {
        window.clearTimeout(timeout);
        reject(error);
      }
    );
  });
}
