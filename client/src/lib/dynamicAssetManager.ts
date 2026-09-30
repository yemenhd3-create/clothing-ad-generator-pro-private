import type { TemplateSize, TemplateVisualTheme, TemplateSettings } from '@shared/types';
import type { DesignElementId } from '@shared/designDocument';
import type { NormalizedBox } from '@shared/designGeometry';
import {
  saveDynamicTemplate,
  getDynamicTemplate,
  listDynamicTemplates,
  deleteDynamicTemplate,
} from './dynamicAssetStorage';

export type DynamicAssetType = 'sticker' | 'badge' | 'font' | 'background';

export interface DynamicAsset {
  id: string;
  type: DynamicAssetType;
  name: string;
  data: string; // Base64 data URI or SVG string
  mimeType?: string;
  createdAt: number;
}

export interface DynamicElementLayout {
  id: DesignElementId;
  visible: boolean;
  required: boolean;
  box: NormalizedBox;
}

export interface DynamicTemplate {
  schemaVersion: 1;
  id: string;
  name: string;
  size: TemplateSize;
  visualTheme?: TemplateVisualTheme;
  productScale?: number;
  elements: DynamicElementLayout[];
  category?: string;
  createdAt: number;
  author?: string;
}

export interface ValidationResult<T> {
  valid: boolean;
  data?: T;
  errors: string[];
}

const ALLOWED_SIZES: TemplateSize[] = ['portrait', 'square', 'story', 'whatsapp', 'landscape'];
const ALLOWED_ELEMENT_IDS: DesignElementId[] = [
  'header',
  'logo',
  'product',
  'badge',
  'info',
  'price',
  'features',
  'footer',
];

const clamp = (val: number, min = 0, max = 1): number => Math.min(Math.max(val, min), max);

function isValidBox(box: unknown): box is NormalizedBox {
  if (!box || typeof box !== 'object') return false;
  const b = box as Record<string, unknown>;
  return (
    typeof b.x === 'number' && Number.isFinite(b.x) &&
    typeof b.y === 'number' && Number.isFinite(b.y) &&
    typeof b.width === 'number' && Number.isFinite(b.width) && b.width > 0 &&
    typeof b.height === 'number' && Number.isFinite(b.height) && b.height > 0
  );
}

/**
 * فحص وتدقيق هيكل القالب الديناميكي لمنع أي تعطل (Crash Proofing)
 */
export function validateDynamicTemplate(raw: unknown): ValidationResult<DynamicTemplate> {
  const errors: string[] = [];

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, errors: ['بيانات القالب غير صالحة: يجب أن تكون كائناً (JSON Object)'] };
  }

  const obj = raw as Record<string, unknown>;

  // 1. التحقق من المعرف
  const id = typeof obj.id === 'string' ? obj.id.trim() : '';
  if (!id || id.length < 2 || id.length > 80 || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    errors.push('معرّف القالب (id) غير صالح: يجب أن يتكون من 2 إلى 80 حرفاً ورقماً وشرطات فقط');
  }

  // 2. التحقق من الاسم
  const name = typeof obj.name === 'string' ? obj.name.trim() : '';
  if (!name || name.length > 100) {
    errors.push('اسم القالب (name) مطلوب ويجب ألا يتجاوز 100 حرف');
  }

  // 3. التحقق من المقاس
  const size = obj.size as TemplateSize;
  if (!ALLOWED_SIZES.includes(size)) {
    errors.push(`المقاس (size) غير مدعوم: المقاسات المتاحة هي (${ALLOWED_SIZES.join(', ')})`);
  }

  // 4. التحقق من العناصر
  if (!Array.isArray(obj.elements) || obj.elements.length === 0) {
    errors.push('قائمة العناصر (elements) فارغة أو غير صالحة');
  }

  const sanitizedElements: DynamicElementLayout[] = [];

  if (Array.isArray(obj.elements)) {
    for (let i = 0; i < obj.elements.length; i++) {
      const el = obj.elements[i];
      if (!el || typeof el !== 'object') {
        errors.push(`العنصر في الموضع [${i}] غير صالح`);
        continue;
      }

      const elObj = el as Record<string, unknown>;
      const elId = elObj.id as DesignElementId;

      if (!ALLOWED_ELEMENT_IDS.includes(elId)) {
        errors.push(`معرف العنصر [${elId || i}] غير معروف أو غير مدعوم`);
        continue;
      }

      if (!isValidBox(elObj.box)) {
        errors.push(`صندوق الموضع (box) للعنصر [${elId}] غير صالح أو أبعاده غير صحيحة`);
        continue;
      }

      // ضبط الإحداثيات لتبقى داخل القماش (Clamping) بأمان
      const rawBox = elObj.box as NormalizedBox;
      const x = clamp(rawBox.x, 0, 0.95);
      const y = clamp(rawBox.y, 0, 0.95);
      const width = clamp(rawBox.width, 0.05, 1 - x);
      const height = clamp(rawBox.height, 0.05, 1 - y);

      sanitizedElements.push({
        id: elId,
        visible: Boolean(elObj.visible !== false),
        required: Boolean(elObj.required === true),
        box: { x, y, width, height },
      });
    }
  }

  // التأكد من وجود عنصر المنتج (product) على الأقل
  const hasProduct = sanitizedElements.some(e => e.id === 'product');
  if (!hasProduct) {
    errors.push('القالب يجب أن يحتوي على موضع لعنصر المنتج (product) على الأقل');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // معالجة مقياس المنتج الاختياري
  let productScale: number | undefined = undefined;
  if (typeof obj.productScale === 'number' && Number.isFinite(obj.productScale)) {
    productScale = clamp(obj.productScale, 0.35, 1.5);
  }

  const sanitized: DynamicTemplate = {
    schemaVersion: 1,
    id,
    name,
    size,
    visualTheme: typeof obj.visualTheme === 'string' ? (obj.visualTheme as TemplateVisualTheme) : undefined,
    productScale,
    elements: sanitizedElements,
    category: typeof obj.category === 'string' ? obj.category.slice(0, 50) : undefined,
    createdAt: typeof obj.createdAt === 'number' ? obj.createdAt : Date.now(),
    author: typeof obj.author === 'string' ? obj.author.slice(0, 50) : 'device-user',
  };

  return { valid: true, data: sanitized, errors: [] };
}

/**
 * تحليل واستيراد ملف قالب بصيغة JSON بأمان مع تقرير الأخطاء
 */
export function parseAndValidateTemplateJson(jsonString: string): ValidationResult<DynamicTemplate> {
  try {
    const parsed = JSON.parse(jsonString);
    return validateDynamicTemplate(parsed);
  } catch (err) {
    return {
      valid: false,
      errors: [`فشل فك ترميز JSON: ${(err as Error).message}`],
    };
  }
}

/**
 * استيراد قالب وحفظه في التخزين المحلي بعد التحقق
 */
export async function importDynamicTemplate(jsonString: string): Promise<{ success: boolean; template?: DynamicTemplate; message: string }> {
  const result = parseAndValidateTemplateJson(jsonString);
  if (!result.valid || !result.data) {
    return {
      success: false,
      message: `فشل التحقق من القالب: ${result.errors.join(' | ')}`,
    };
  }

  try {
    await saveDynamicTemplate(result.data);
    return {
      success: true,
      template: result.data,
      message: `تم استيراد وحفظ القالب "${result.data.name}" بنجاح`,
    };
  } catch (e) {
    return {
      success: false,
      message: `خطأ أثناء الحفظ في الذاكرة المحلية: ${(e as Error).message}`,
    };
  }
}

/**
 * دمج القوالب الديناميكية واسترجاع القالب الفعال مع حماية Fallback لمنع أي توقف
 */
export async function resolveTemplateOrFallback(
  templateId: string,
  fallback: TemplateSettings
): Promise<{ settings: TemplateSettings; dynamicTemplate?: DynamicTemplate }> {
  try {
    const dyn = await getDynamicTemplate(templateId);
    if (!dyn) {
      return { settings: fallback };
    }

    return {
      settings: {
        ...fallback,
        size: dyn.size,
        visualTheme: dyn.visualTheme || fallback.visualTheme,
      },
      dynamicTemplate: dyn,
    };
  } catch (err) {
    console.warn(`[DynamicAssetManager] Fallback triggered for template "${templateId}":`, err);
    return { settings: fallback };
  }
}

export {
  saveDynamicTemplate,
  getDynamicTemplate,
  listDynamicTemplates,
  deleteDynamicTemplate,
};
