/**
 * إدارة بيانات الجهاز: تقدير المساحة المستخدمة ومسح فئات البيانات المحلية.
 * كل فئة لها شرح واضح لما سيُحذف، والمسح يتم بعد تأكيد المستخدم فقط.
 */

import { deleteBatchDraft, getBatchStorageEstimate, loadBatchDrafts } from './batchStorage';

const REMEMBERED_INPUTS_KEY = 'clothing_ad_remembered_inputs_v1';
const SMART_MARKETING_KEY = 'clogen_smart_marketing_instructions';
const DYNAMIC_TEMPLATE_PREFIX = 'clogen_dyn_tpl_';

export type DeviceDataCategory = 'rememberedInputs' | 'smartMemory' | 'dynamicTemplates' | 'batchDrafts';

export const DEVICE_DATA_CATEGORIES: Record<DeviceDataCategory, { title: string; description: string }> = {
  rememberedInputs: {
    title: 'اقتراحات الحقول',
    description: 'آخر القيم التي كتبتها في اسم المنتج والسعر والخصم وتظهر كاقتراحات سريعة.',
  },
  smartMemory: {
    title: 'ذاكرة النصوص التسويقية',
    description: 'التعليمات التي تعلّمها المساعد التسويقي من تعديلاتك السابقة على النصوص.',
  },
  dynamicTemplates: {
    title: 'القوالب المخصصة المحفوظة',
    description: 'نسخ القوالب التي عدّلتها أو أضفتها وتُحفظ محلياً على هذا الجهاز.',
  },
  batchDrafts: {
    title: 'مسودات الدفعات',
    description: 'الدفعات غير المكتملة وصورها المحفوظة لاستئناف العمل لاحقاً.',
  },
};

type StorageLike = Pick<Storage, 'getItem' | 'removeItem' | 'key' | 'length'>;

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return 'غير متاح';
  if (bytes < 1024) return `${Math.round(bytes)} بايت`;
  const units = ['كيلوبايت', 'ميجابايت', 'جيجابايت'];
  let value = bytes;
  let unit = 'بايت';
  for (const next of units) {
    if (value < 1024) break;
    value /= 1024;
    unit = next;
  }
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${unit}`;
}

/** يمسح اقتراحات الحقول المحفوظة. يعيد true إن كان هناك شيء محفوظ قبل المسح. */
export function clearRememberedInputs(storage: StorageLike | null = defaultStorage()): boolean {
  if (!storage) return false;
  const had = storage.getItem(REMEMBERED_INPUTS_KEY) !== null;
  storage.removeItem(REMEMBERED_INPUTS_KEY);
  return had;
}

/** يمسح ذاكرة النصوص التسويقية. يعيد true إن كان هناك شيء محفوظ قبل المسح. */
export function clearSmartMarketingMemory(storage: StorageLike | null = defaultStorage()): boolean {
  if (!storage) return false;
  const had = storage.getItem(SMART_MARKETING_KEY) !== null;
  storage.removeItem(SMART_MARKETING_KEY);
  return had;
}

/** يمسح القوالب المخصصة المحفوظة محلياً ويعيد عدد المفاتيح التي أزيلت. */
export function clearDynamicTemplateCache(storage: StorageLike | null = defaultStorage()): number {
  if (!storage) return 0;
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key && key.startsWith(DYNAMIC_TEMPLATE_PREFIX)) keys.push(key);
  }
  for (const key of keys) storage.removeItem(key);
  return keys.length;
}

/** يمسح كل مسودات الدفعات وصورها من قاعدة الجهاز ويعيد عدد المسودات التي أزيلت. */
export async function clearAllBatchDrafts(): Promise<number> {
  const drafts = await loadBatchDrafts();
  await Promise.all(drafts.map(draft => deleteBatchDraft(draft.id)));
  return drafts.length;
}

export type DeviceStorageEstimate = { usageBytes: number | null; quotaBytes: number | null } | null;

/** تقدير مساحة التطبيق على الجهاز عندما يدعمه المتصفح. */
export async function getDeviceStorageEstimate(): Promise<DeviceStorageEstimate> {
  const estimate = await getBatchStorageEstimate();
  if (!estimate) return null;
  return { usageBytes: estimate.usage ?? null, quotaBytes: estimate.quota ?? null };
}
