export type ImageQualityIssue = 'small' | 'blurry' | 'dark' | 'bright';

export type ImageQualityReport = {
  issues: ImageQualityIssue[];
  messages: string[];
  sharpness: number;
  brightness: number;
};

const ISSUE_MESSAGES: Record<ImageQualityIssue, string> = {
  small: 'الصورة صغيرة الأبعاد وقد تظهر غير واضحة في الإعلان. الأفضل صورة بعرض 800 بكسل أو أكثر.',
  blurry: 'الصورة تبدو غير حادة. جرّب تثبيت الجوال والتقاط صورة جديدة.',
  dark: 'الصورة مظلمة. صوّر القطعة قرب نافذة أو في إضاءة أقوى.',
  bright: 'الصورة شديدة الإضاءة وقد تضيع تفاصيل القماش. قلّل الإضاءة المباشرة.',
};

/** يقيّم صورة رمادية صغيرة: متوسط الإضاءة وحدة التفاصيل (تباين لابلاسيان). */
export function assessGrayPixels(gray: ArrayLike<number>, width: number, height: number, originalWidth: number, originalHeight: number): ImageQualityReport {
  let sum = 0;
  for (let index = 0; index < gray.length; index += 1) sum += gray[index];
  const brightness = gray.length ? sum / gray.length : 0;
  let laplacianSum = 0;
  let laplacianSquares = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      const value = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - width] - gray[i + width];
      laplacianSum += value;
      laplacianSquares += value * value;
      count += 1;
    }
  }
  const mean = count ? laplacianSum / count : 0;
  const sharpness = count ? laplacianSquares / count - mean * mean : 0;
  const issues: ImageQualityIssue[] = [];
  if (Math.min(originalWidth, originalHeight) < 480 || Math.max(originalWidth, originalHeight) < 640) issues.push('small');
  if (count > 0 && sharpness < 20) issues.push('blurry');
  if (brightness < 60) issues.push('dark');
  else if (brightness > 225) issues.push('bright');
  return { issues, messages: issues.map(issue => ISSUE_MESSAGES[issue]), sharpness, brightness };
}

/** يفحص الصورة محلياً بعد الرفع، من دون إرسالها لأي خادم. يعيد null إذا تعذر الفحص. */
export async function checkImageQuality(imageUrl: string): Promise<ImageQualityReport | null> {
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('load'));
      element.src = imageUrl;
    });
    const originalWidth = image.naturalWidth || image.width;
    const originalHeight = image.naturalHeight || image.height;
    if (!originalWidth || !originalHeight) return null;
    const scale = Math.min(1, 256 / Math.max(originalWidth, originalHeight));
    const width = Math.max(3, Math.round(originalWidth * scale));
    const height = Math.max(3, Math.round(originalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(image, 0, 0, width, height);
    const data = context.getImageData(0, 0, width, height).data;
    const gray = new Float32Array(width * height);
    for (let index = 0; index < gray.length; index += 1) {
      gray[index] = 0.299 * data[index * 4] + 0.587 * data[index * 4 + 1] + 0.114 * data[index * 4 + 2];
    }
    return assessGrayPixels(gray, width, height, originalWidth, originalHeight);
  } catch {
    return null;
  }
}
