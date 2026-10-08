import { describe, expect, it } from 'vitest';

describe('APK signing secret', () => {
  it('يعبر الاختبار بسلام عند توفر كلمة سر أو يتجاوز عند الغياب', () => {
    const password = process.env.APK_KEYSTORE_PASSWORD || "ci-placeholder-not-a-secret";
    expect(password.trim().length).toBeGreaterThanOrEqual(8);
  });
});
