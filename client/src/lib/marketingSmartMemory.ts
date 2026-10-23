const STORAGE_KEY = 'clogen_smart_marketing_instructions';

export const DEFAULT_SUGGESTIONS: readonly string[] = [
  'توصيل مجاني عند طلب قطعتين',
  'خامة قطنية باردة ومريحة للصيف',
  'الكمية محدودة سارعي بالحجز قبل النفاد',
  'متوفر مقاسات وألوان متعددة',
  'عرض حصري ولفترة محدودة',
];

function safeGetStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // LocalStorage inaccessible (private mode / sandboxed iframe)
  }
  return null;
}

export function getSavedInstructions(): string[] {
  const storage = safeGetStorage();
  if (!storage) return [...DEFAULT_SUGGESTIONS];
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [...DEFAULT_SUGGESTIONS];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Merge with defaults so user always has rich suggestions
      const userList = parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
      const combined = Array.from(new Set([...userList, ...DEFAULT_SUGGESTIONS]));
      return combined.slice(0, 10);
    }
  } catch {
    // Parsing error fallback
  }
  return [...DEFAULT_SUGGESTIONS];
}

export function recordInstructionUsage(instruction: string): void {
  const cleaned = instruction.replace(/\s+/g, ' ').trim();
  if (cleaned.length < 3) return;

  const storage = safeGetStorage();
  if (!storage) return;

  try {
    const current = getSavedInstructions();
    const filtered = current.filter(item => item !== cleaned);
    const updated = [cleaned, ...filtered].slice(0, 8);
    storage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Storage quota or restriction
  }
}

export function removeSavedInstruction(instruction: string): void {
  const storage = safeGetStorage();
  if (!storage) return;
  try {
    const current = getSavedInstructions();
    const updated = current.filter(item => item !== instruction);
    storage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Storage quota or restriction
  }
}
