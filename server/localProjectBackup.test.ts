import { describe, expect, it } from 'vitest';
import { DEFAULT_TEMPLATE_SETTINGS } from '@shared/types';
import { createMerchantAssistantSession, createMerchantProfile } from '@shared/merchantAssistant';
import { createLocalProjectBackup, parseLocalProjectBackup, stringifyLocalProjectBackup } from '../client/src/lib/localProjectBackup';

describe('local project backup', () => {
  it('round-trips template, profile, and leader memory locally', () => {
    const backup = createLocalProjectBackup(createMerchantProfile(), createMerchantAssistantSession(), DEFAULT_TEMPLATE_SETTINGS);
    expect(parseLocalProjectBackup(stringifyLocalProjectBackup(backup))).toEqual(backup);
  });

  it('rejects malformed backup files', () => {
    expect(parseLocalProjectBackup('{"version":1}')).toBeNull();
    expect(parseLocalProjectBackup('not-json')).toBeNull();
  });

  it('يحذف الحقول الحساسة من النسخة ويرفض ملفاً يحاول إدخالها عند الاستعادة', () => {
    const profileWithKey = { ...createMerchantProfile(), apiKey: 'never-export-this' } as unknown as ReturnType<typeof createMerchantProfile>;
    const backup = createLocalProjectBackup(profileWithKey, createMerchantAssistantSession(), DEFAULT_TEMPLATE_SETTINGS);
    expect(stringifyLocalProjectBackup(backup)).not.toContain('never-export-this');
    const poisoned = JSON.stringify({ ...backup, token: 'do-not-import' });
    expect(parseLocalProjectBackup(poisoned)).toBeNull();
  });

  it('يقرأ النسخة القديمة بصورة توافقية ثم يحولها إلى الإصدار الآمن الحالي', () => {
    const legacy = { version: 1, createdAt: 1, profile: createMerchantProfile(), session: createMerchantAssistantSession(), template: DEFAULT_TEMPLATE_SETTINGS };
    expect(parseLocalProjectBackup(JSON.stringify(legacy))).toMatchObject({ version: 2, app: 'clothing-ad-generator-pro', createdAt: 1 });
  });
});
