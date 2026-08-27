type NativeSharePlugin = {
  share: (options: { title?: string; text?: string; files?: string[]; dialogTitle?: string }) => Promise<void>;
};

type NativeFilesystemPlugin = {
  writeFile: (options: { path: string; data: string; directory: 'DOCUMENTS'; recursive?: boolean }) => Promise<{ uri: string }>;
};

type CapacitorBridge = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: { Share?: NativeSharePlugin; Filesystem?: NativeFilesystemPlugin };
};

function getNativeAndroidPlugins() {
  const capacitor = (globalThis as typeof globalThis & { Capacitor?: CapacitorBridge }).Capacitor;
  if (!capacitor?.isNativePlatform?.() || capacitor.getPlatform?.() !== 'android') return null;
  const share = capacitor.Plugins?.Share;
  const filesystem = capacitor.Plugins?.Filesystem;
  return share && filesystem ? { share, filesystem } : null;
}

function dataUrlPayload(dataUrl: string) {
  const comma = dataUrl.indexOf(',');
  return dataUrl.startsWith('data:image/') && comma > 0 ? dataUrl.slice(comma + 1) : null;
}

/**
 * يحفظ PNG في مستندات التطبيق ثم يفتـح لوحة مشاركة Android الأصلية.
 * لا يفتح رابط wa.me أو نافذة متصفح من داخل APK.
 */
export async function shareImageThroughNativeAndroid(dataUrl: string, title: string, text: string) {
  const plugins = getNativeAndroidPlugins();
  const payload = dataUrlPayload(dataUrl);
  if (!plugins || !payload) return false;
  try {
    const file = await plugins.filesystem.writeFile({
      path: `غرفة-الملابس/إعلان-${Date.now()}.png`,
      data: payload,
      directory: 'DOCUMENTS',
      recursive: true,
    });
    await plugins.share.share({ title, text, files: [file.uri], dialogTitle: 'إرسال الإعلان' });
    return true;
  } catch {
    return false;
  }
}

export function hasNativeAndroidShare() {
  return Boolean(getNativeAndroidPlugins());
}
