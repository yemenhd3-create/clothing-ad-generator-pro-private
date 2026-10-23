import { describe, expect, it, beforeEach } from 'vitest';
import {
  DEFAULT_SUGGESTIONS,
  getSavedInstructions,
  recordInstructionUsage,
  removeSavedInstruction,
} from '../client/src/lib/marketingSmartMemory';

const mockStore: Record<string, string> = {};
const fakeLocalStorage = {
  getItem: (key: string) => mockStore[key] ?? null,
  setItem: (key: string, value: string) => { mockStore[key] = value; },
  removeItem: (key: string) => { delete mockStore[key]; },
  clear: () => { Object.keys(mockStore).forEach(k => delete mockStore[k]); },
};

describe('وحدة التعلم والذاكرة الذكية للنصوص التسويقية', () => {
  beforeEach(() => {
    fakeLocalStorage.clear();
    (globalThis as any).window = { localStorage: fakeLocalStorage };
  });

  it('يعيد الاقتراحات الافتراضية عند عدم وجود ذاكرة سابقة', () => {
    const suggestions = getSavedInstructions();
    expect(suggestions).toEqual(expect.arrayContaining([...DEFAULT_SUGGESTIONS]));
  });

  it('يتعلم عبارة جديدة ويضعها في أول الاقتراحات مع عدم التكرار', () => {
    recordInstructionUsage('توصيل سريع خلال 24 ساعة');
    const suggestions = getSavedInstructions();

    expect(suggestions[0]).toBe('توصيل سريع خلال 24 ساعة');

    // تسجيل نفس العبارة مرة أخرى لا يكررها
    recordInstructionUsage('توصيل سريع خلال 24 ساعة');
    const count = getSavedInstructions().filter(item => item === 'توصيل سريع خلال 24 ساعة').length;
    expect(count).toBe(1);
  });

  it('يتجاهل العبارات القصيرة جداً الأقل من 3 أحرف', () => {
    recordInstructionUsage('  لا ');
    const suggestions = getSavedInstructions();
    expect(suggestions).not.toContain('لا');
  });

  it('يحذف عبارة محفوظة بنجاح عند طلب المستخدم', () => {
    recordInstructionUsage('عرض خاص ليوم الجمعة');
    expect(getSavedInstructions()).toContain('عرض خاص ليوم الجمعة');

    removeSavedInstruction('عرض خاص ليوم الجمعة');
    expect(getSavedInstructions()).not.toContain('عرض خاص ليوم الجمعة');
  });
});
