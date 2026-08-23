export interface ImageQualityReport {
  brightness: number;
  contrast: number;
  summary: string;
  suggestion: string;
}

export interface QuickPolishSettings {
  brightness: number;
  contrast: number;
  saturation: number;
}

/** يقيس أرقاماً تقريبية محلياً فقط؛ لا يغير البكسلات ولا يرسل الصورة. */
export function analyzeImageQuality(pixels: Uint8ClampedArray, width: number, height: number): ImageQualityReport {
  const targetSamples = 4096;
  const step = Math.max(1, Math.floor(Math.sqrt(Math.max(1, width * height) / targetSamples)));
  let count = 0;
  let sum = 0;
  let sumSquared = 0;

  for (let y = 0; y < height; y += step) for (let x = 0; x < width; x += step) {
    const offset = (y * width + x) * 4;
    if ((pixels[offset + 3] || 0) < 24) continue;
    const light = pixels[offset] * .2126 + pixels[offset + 1] * .7152 + pixels[offset + 2] * .0722;
    sum += light;
    sumSquared += light * light;
    count += 1;
  }

  const brightness = count ? Math.round(sum / count) : 128;
  const contrast = count ? Math.round(Math.sqrt(Math.max(0, sumSquared / count - (sum / count) ** 2))) : 0;
  if (brightness < 88) return { brightness, contrast, summary: 'الصورة داكنة قليلاً.', suggestion: 'التحسين السريع يفتح الظلال بلطف ويحافظ على اللون.' };
  if (brightness > 218) return { brightness, contrast, summary: 'الصورة ساطعة قليلاً.', suggestion: 'التحسين السريع يهدئ الإضاءة من دون إعادة رسم القطعة.' };
  if (contrast < 26) return { brightness, contrast, summary: 'التباين منخفض قليلاً.', suggestion: 'التحسين السريع يوضح حدود القماش بلطف.' };
  return { brightness, contrast, summary: 'الصورة متوازنة مبدئياً.', suggestion: 'يمكنك استخدام التحسين السريع أو ترك الصورة كما هي.' };
}

/** وصفة خفيفة ومحدودة؛ لا تطمس النقشة ولا تولد أو تستبدل أي جزء من المنتج. */
export function getQuickPolishSettings(report: ImageQualityReport): QuickPolishSettings {
  if (report.brightness < 88) return { brightness: 109, contrast: 103, saturation: 101 };
  if (report.brightness > 218) return { brightness: 96, contrast: 100, saturation: 100 };
  if (report.contrast < 26) return { brightness: 101, contrast: 106, saturation: 101 };
  return { brightness: 101, contrast: 102, saturation: 100 };
}
