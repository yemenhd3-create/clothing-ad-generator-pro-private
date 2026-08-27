import { afterEach, describe, expect, it } from 'vitest';
import { hasNativeAndroidShare, shareImageThroughNativeAndroid } from '../client/src/lib/nativeAndroidShare';

const originalCapacitor = (globalThis as typeof globalThis & { Capacitor?: unknown }).Capacitor;

afterEach(() => {
  (globalThis as typeof globalThis & { Capacitor?: unknown }).Capacitor = originalCapacitor;
});

describe('جسر مشاركة Android الأصلي', () => {
  it('لا يفعّل مشاركة Android عندما لا يكون التطبيق في منصة Android أصلية', async () => {
    (globalThis as typeof globalThis & { Capacitor?: unknown }).Capacitor = undefined;
    expect(hasNativeAndroidShare()).toBe(false);
    await expect(shareImageThroughNativeAndroid('data:image/png;base64,AAAA', 'إعلان', 'نص')).resolves.toBe(false);
  });

  it('يكتب PNG محلياً ويفتح لوحة مشاركة Android بدلاً من نافذة المتصفح', async () => {
    const writeFile = async () => ({ uri: 'content://local/ad.png' });
    const share = async () => undefined;
    (globalThis as typeof globalThis & { Capacitor?: unknown }).Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => 'android',
      Plugins: { Filesystem: { writeFile }, Share: { share } },
    };
    await expect(shareImageThroughNativeAndroid('data:image/png;base64,AAAA', 'إعلان', 'نص')).resolves.toBe(true);
    expect(hasNativeAndroidShare()).toBe(true);
  });
});
