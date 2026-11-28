/**
 * وضع التباين المرتفع: يقوّي وضوح النصوص الخافتة والحدود على الشاشات الضعيفة أو تحت الشمس.
 * يُحفظ محلياً على الجهاز ويُطبق على متغيرات الألوان الجذرية.
 */

const STORAGE_KEY = 'clothing-high-contrast';

const CONTRAST_KEYS = ['--color-muted-foreground', '--color-border', '--color-input', '--muted-foreground', '--border', '--input'] as const;
type ContrastKey = (typeof CONTRAST_KEYS)[number];

const LIGHT_VALUES = { muted: 'oklch(0.34 0.03 285)', border: 'oklch(0.6 0.02 90)' };
const DARK_VALUES = { muted: 'oklch(0.93 0.01 285)', border: 'oklch(0.6 0.03 285)' };

function varsFor(dark: boolean): Record<ContrastKey, string> {
  const values = dark ? DARK_VALUES : LIGHT_VALUES;
  return {
    '--color-muted-foreground': values.muted,
    '--color-border': values.border,
    '--color-input': values.border,
    '--muted-foreground': values.muted,
    '--border': values.border,
    '--input': values.border,
  };
}

let savedInlineValues: Partial<Record<ContrastKey, string>> = {};

export function loadHighContrast(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function applyHighContrast(enabled: boolean): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (enabled) {
    const vars = varsFor(root.classList.contains('dark'));
    CONTRAST_KEYS.forEach(key => {
      savedInlineValues[key] = root.style.getPropertyValue(key);
      root.style.setProperty(key, vars[key]);
    });
    root.classList.add('high-contrast');
  } else {
    CONTRAST_KEYS.forEach(key => {
      const previous = savedInlineValues[key];
      if (previous) root.style.setProperty(key, previous);
      else root.style.removeProperty(key);
    });
    root.classList.remove('high-contrast');
  }
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    // التخزين غير متاح؛ يعمل الوضع للجلسة الحالية فقط
  }
}

export function toggleHighContrast(): boolean {
  const next = !loadHighContrast();
  applyHighContrast(next);
  return next;
}
