/**
 * تذكّر آخر القيم المستخدمة في حقول بيانات الإعلان (اسم المنتج، السعر، الخصم).
 * التخزين محلي بالكامل على الجهاز، والاقتراح يظهر كرقائق اختيارية دون ملء إجباري.
 */

export type RememberedField = 'productName' | 'price' | 'discount';

const STORAGE_KEY = 'clothing_ad_remembered_inputs_v1';
export const REMEMBERED_INPUTS_LIMIT = 5;

type RememberedStore = Partial<Record<RememberedField, string[]>>;

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function readStore(storage: StorageLike | null): RememberedStore {
  if (!storage) return {};
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as RememberedStore;
    const store: RememberedStore = {};
    for (const field of ['productName', 'price', 'discount'] as const) {
      const values = parsed?.[field];
      if (Array.isArray(values)) store[field] = values.filter((value): value is string => typeof value === 'string').slice(0, REMEMBERED_INPUTS_LIMIT);
    }
    return store;
  } catch {
    return {};
  }
}

export function getRememberedInputs(field: RememberedField, storage: StorageLike | null = defaultStorage()): string[] {
  return readStore(storage)[field] ?? [];
}

export function rememberInputValue(field: RememberedField, value: string, storage: StorageLike | null = defaultStorage()): void {
  const trimmed = value.trim();
  if (!trimmed || !storage) return;
  const store = readStore(storage);
  const next = [trimmed, ...(store[field] ?? []).filter(existing => existing !== trimmed)].slice(0, REMEMBERED_INPUTS_LIMIT);
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ ...store, [field]: next }));
  } catch {
    // مساحة التخزين ممتلئة أو محجوبة: نتجاهل بصمت لأن الميزة مساعدة فقط.
  }
}
