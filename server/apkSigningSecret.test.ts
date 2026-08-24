import { describe, expect, it } from 'vitest';

describe('APK signing secret', () => {
  it('يستقبل كلمة توقيع غير فارغة داخل بيئة الخادم فقط قبل بناء APK', () => {
    const password = process.env.APK_KEYSTORE_PASSWORD;
    expect(password?.trim().length).toBeGreaterThanOrEqual(8);
  });
});
