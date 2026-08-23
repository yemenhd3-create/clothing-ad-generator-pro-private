export interface ImageQualityReport {
  brightness: number;
  contrast: number;
  sharpness: number;
  detailNotice: string;
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
  let edgeCount = 0;
  let edgeEnergy = 0;

  for (let y = 0; y < height; y += step) for (let x = 0; x < width; x += step) {
    const offset = (y * width + x) * 4;
    if ((pixels[offset + 3] || 0) < 24) continue;
    const light = pixels[offset] * .2126 + pixels[offset + 1] * .7152 + pixels[offset + 2] * .0722;
    sum += light;
    sumSquared += light * light;
    count += 1;
    const nextX = x + step;
    if (nextX < width) {
      const nextOffset = (y * width + nextX) * 4;
      if ((pixels[nextOffset + 3] || 0) >= 24) {
        const nextLight = pixels[nextOffset] * .2126 + pixels[nextOffset + 1] * .7152 + pixels[nextOffset + 2] * .0722;
        edgeEnergy += Math.abs(light - nextLight);
        edgeCount += 1;
      }
    }
  }

  const brightness = count ? Math.round(sum / count) : 128;
  const contrast = count ? Math.round(Math.sqrt(Math.max(0, sumSquared / count - (sum / count) ** 2))) : 0;
  const sharpness = edgeCount ? Math.round(edgeEnergy / edgeCount) : 0;
  const detailNotice = Math.min(width, height) < 480
    ? 'دقة الصورة صغيرة؛ النتيجة تبقى صالحة، لكن صورة أكبر تحفظ تفاصيل القماش أفضل.'
    : sharpness < 4 && contrast < 16
      ? 'تفاصيل الصورة هادئة؛ استخدم التنقيح اليدوي فقط إذا لاحظت ضبابية في القماش.'
      : '';
  if (brightness < 88) return { brightness, contrast, sharpness, detailNotice, summary: 'الصورة داكنة قليلاً.', suggestion: 'التحسين السريع يفتح الظلال بلطف ويحافظ على اللون.' };
  if (brightness > 218) return { brightness, contrast, sharpness, detailNotice, summary: 'الصورة ساطعة قليلاً.', suggestion: 'التحسين السريع يهدئ الإضاءة من دون إعادة رسم القطعة.' };
  if (contrast < 26) return { brightness, contrast, sharpness, detailNotice, summary: 'التباين منخفض قليلاً.', suggestion: 'التحسين السريع يوضح حدود القماش بلطف.' };
  return { brightness, contrast, sharpness, detailNotice, summary: 'الصورة متوازنة مبدئياً.', suggestion: 'يمكنك استخدام التحسين السريع أو ترك الصورة كما هي.' };
}

/** وصفة خفيفة ومحدودة؛ لا تطمس النقشة ولا تولد أو تستبدل أي جزء من المنتج. */
export function getQuickPolishSettings(report: ImageQualityReport): QuickPolishSettings {
  if (report.brightness < 88) return { brightness: 109, contrast: 103, saturation: 101 };
  if (report.brightness > 218) return { brightness: 96, contrast: 100, saturation: 100 };
  if (report.contrast < 26) return { brightness: 101, contrast: 106, saturation: 101 };
  return { brightness: 101, contrast: 102, saturation: 100 };
}

/** يخفف هالة الخلفية حول الحافة فقط؛ لا يبدل أي لون ولا يلمس البكسلات المعتمة. */
export function cleanTransparentEdges(pixels: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const next = new Uint8ClampedArray(pixels);
  const alphaAt = (x: number, y: number) => pixels[(y * width + x) * 4 + 3] || 0;
  for (let y = 1; y < height - 1; y += 1) for (let x = 1; x < width - 1; x += 1) {
    const offset = (y * width + x) * 4;
    const alpha = pixels[offset + 3] || 0;
    if (alpha < 12 || alpha > 96) continue;
    const transparentNeighbours = [[-1, 0], [1, 0], [0, -1], [0, 1]].filter(([dx, dy]) => alphaAt(x + dx, y + dy) < 12).length;
    if (transparentNeighbours >= 2) next[offset + 3] = Math.max(0, alpha - Math.max(8, Math.round(alpha * .22)));
  }
  return next;
}
