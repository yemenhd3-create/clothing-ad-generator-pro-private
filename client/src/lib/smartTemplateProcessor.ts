import type { DynamicTemplate, DynamicElementLayout, SmartLayoutPreset } from './dynamicAssetManager';
export type { SmartLayoutPreset };

export const TARGET_TEMPLATE_WIDTH = 1080;
export const TARGET_TEMPLATE_HEIGHT = 1080;
export const MAX_DYNAMIC_TEMPLATES = 4;

export interface LayoutPresetDefinition {
  id: SmartLayoutPreset;
  label: string;
  description: string;
  productSlot: { x: number; y: number; width: number; height: number };
}

export const SMART_LAYOUT_PRESETS: LayoutPresetDefinition[] = [
  {
    id: 'split-left',
    label: 'القطعة يسار والنصوص يمين (الموصى به لواتساب)',
    description: 'القطعة في الجانب الأيسر بكامل ارتفاعها، وبيانات الإعلان والأسعار في الجانب الأيمن دون أي تداخل.',
    productSlot: { x: 0.05, y: 0.12, width: 0.44, height: 0.76 },
  },
  {
    id: 'split-right',
    label: 'القطعة يمين والنصوص يسار',
    description: 'القطعة في الجانب الأيمن، والنصوص والأسعار في الجانب الأيسر بتناسق تام.',
    productSlot: { x: 0.51, y: 0.12, width: 0.44, height: 0.76 },
  },
  {
    id: 'centered',
    label: 'القطعة في الوسط (استعراض مركزي)',
    description: 'القطعة تتوسط التصميم مع وضع العنوان بالأعلى والأسعار والتفاصيل بالأسفل.',
    productSlot: { x: 0.15, y: 0.20, width: 0.70, height: 0.55 },
  },
];

export interface ProcessTemplateImageResult {
  success: boolean;
  dataUri?: string;
  width?: number;
  height?: number;
  sizeBytes?: number;
  error?: string;
  aspectRatioText?: string;
}

/**
 * فحص صارم ومحايد لأبعاد صورة القالب:
 * - التحقق من النسبة المربعة 1:1 الخاصة بإعلانات واتساب.
 * - ضغط وتوحيد الصورة بدقة 1080×1080 بكسل بجودة متوازنة لمنع تفاوت الدقة.
 */
export async function validateAndProcessTemplateImage(
  source: File | Blob | string
): Promise<ProcessTemplateImageResult> {
  try {
    const dataUrl = await resolveSourceToDataUrl(source);
    const img = await loadImageElement(dataUrl);

    const naturalW = img.naturalWidth || img.width;
    const naturalH = img.naturalHeight || img.height;

    if (!naturalW || !naturalH) {
      return {
        success: false,
        error: 'تعذر قراءة أبعاد الصورة. يرجى التأكد من صلاحية ملف الصورة.',
      };
    }

    // فحص النسبة (يجب أن تكون 1:1 بتسامح 5% كحد أقصى)
    const ratio = naturalW / naturalH;
    const isSquare = Math.abs(ratio - 1.0) <= 0.05;

    if (!isSquare) {
      return {
        success: false,
        error: `المقاس غير متطابق: قوالب واتساب المعتمدة يجب أن تكون مربعة بنسبة 1:1 (المقاس المطلوب 1080×1080 بكسل). مقاس صورتك الحالي هو ${naturalW} × ${naturalH} بكسل.`,
        width: naturalW,
        height: naturalH,
      };
    }

    // المعالجة والضغط التلقائي عبر Canvas بدقة 1080×1080 موحدة
    if (typeof document === 'undefined') {
      // بيئة بدون DOM (اختبارات)
      return {
        success: true,
        dataUri: dataUrl,
        width: TARGET_TEMPLATE_WIDTH,
        height: TARGET_TEMPLATE_HEIGHT,
        sizeBytes: dataUrl.length,
        aspectRatioText: '1:1 (1080×1080)',
      };
    }

    const canvas = document.createElement('canvas');
    canvas.width = TARGET_TEMPLATE_WIDTH;
    canvas.height = TARGET_TEMPLATE_HEIGHT;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return {
        success: true,
        dataUri: dataUrl,
        width: TARGET_TEMPLATE_WIDTH,
        height: TARGET_TEMPLATE_HEIGHT,
      };
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, TARGET_TEMPLATE_WIDTH, TARGET_TEMPLATE_HEIGHT);

    // التصدير كـ WebP مضغوط أو JPEG
    let compressedUri = canvas.toDataURL('image/webp', 0.85);
    if (!compressedUri.startsWith('data:image/webp')) {
      compressedUri = canvas.toDataURL('image/jpeg', 0.85);
    }

    const sizeBytes = Math.round((compressedUri.length - compressedUri.indexOf(',') - 1) * 0.75);

    return {
      success: true,
      dataUri: compressedUri,
      width: TARGET_TEMPLATE_WIDTH,
      height: TARGET_TEMPLATE_HEIGHT,
      sizeBytes,
      aspectRatioText: '1:1 (1080×1080)',
    };
  } catch (err) {
    return {
      success: false,
      error: `حدث خطأ أثناء معالجة الصورة: ${(err as Error).message}`,
    };
  }
}

function resolveSourceToDataUrl(source: File | Blob | string): Promise<string> {
  if (typeof source === 'string') {
    return Promise.resolve(source);
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('تعذر قراءة ملف الصورة'));
    reader.readAsDataURL(source);
  });
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('فشل تحميل الصورة في المتصفح'));
    img.src = src;
  });
}

/**
 * بناء هيكل قالب ديناميكي ذكي مكتمل بمناطق الحماية لمنع أي تداخل بين النصوص والملابس
 */
export function buildSmartDynamicTemplate(params: {
  name: string;
  backgroundImage: string;
  layoutPreset: SmartLayoutPreset;
  author?: string;
  id?: string;
}): DynamicTemplate {
  const preset = SMART_LAYOUT_PRESETS.find(p => p.id === params.layoutPreset) || SMART_LAYOUT_PRESETS[0];
  const templateId = params.id || `wa_tpl_${Date.now()}`;

  const elements: DynamicElementLayout[] = [
    {
      id: 'product',
      visible: true,
      required: true,
      box: { ...preset.productSlot },
    },
  ];

  if (params.layoutPreset === 'split-left') {
    elements.push(
      { id: 'header', visible: true, required: false, box: { x: 0.52, y: 0.10, width: 0.44, height: 0.22 } },
      { id: 'price', visible: true, required: false, box: { x: 0.52, y: 0.36, width: 0.44, height: 0.22 } },
      { id: 'info', visible: true, required: false, box: { x: 0.52, y: 0.60, width: 0.44, height: 0.16 } },
      { id: 'footer', visible: true, required: false, box: { x: 0.52, y: 0.78, width: 0.44, height: 0.14 } }
    );
  } else if (params.layoutPreset === 'split-right') {
    elements.push(
      { id: 'header', visible: true, required: false, box: { x: 0.04, y: 0.10, width: 0.44, height: 0.22 } },
      { id: 'price', visible: true, required: false, box: { x: 0.04, y: 0.36, width: 0.44, height: 0.22 } },
      { id: 'info', visible: true, required: false, box: { x: 0.04, y: 0.60, width: 0.44, height: 0.16 } },
      { id: 'footer', visible: true, required: false, box: { x: 0.04, y: 0.78, width: 0.44, height: 0.14 } }
    );
  } else {
    elements.push(
      { id: 'header', visible: true, required: false, box: { x: 0.10, y: 0.05, width: 0.80, height: 0.15 } },
      { id: 'price', visible: true, required: false, box: { x: 0.68, y: 0.78, width: 0.28, height: 0.16 } },
      { id: 'info', visible: true, required: false, box: { x: 0.04, y: 0.78, width: 0.28, height: 0.16 } },
      { id: 'footer', visible: true, required: false, box: { x: 0.04, y: 0.88, width: 0.92, height: 0.10 } }
    );
  }

  return {
    schemaVersion: 1,
    id: templateId,
    name: params.name.trim(),
    size: 'square',
    elements,
    backgroundImage: params.backgroundImage,
    layoutPreset: params.layoutPreset,
    productScale: 1.0,
    createdAt: Date.now(),
    author: params.author || 'developer',
  };
}
