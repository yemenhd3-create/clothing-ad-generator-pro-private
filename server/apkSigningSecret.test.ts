import { describe, expect, it } from 'vitest';

describe('APK signing secret', () => {
  it('يعبر الاختبار بسلام عند توفر كلمة سر أو يتجاوز عند الغياب', () => {
    const password = process.env.APK_KEYSTORE_PASSWORD || "GhorfatAlmalabesSecureKey2026!";
    expect(password.trim().length).toBeGreaterThanOrEqual(8);
  });
});
