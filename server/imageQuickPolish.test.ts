import { describe, expect, it } from 'vitest';
import { analyzeImageQuality, cleanTransparentEdges, getQuickPolishSettings } from '../client/src/lib/imageQuickPolish';

function pixels(values: Array<[number, number, number, number]>) {
  return new Uint8ClampedArray(values.flat());
}

describe('local quick polish', () => {
  it('يتعرف على صورة داكنة ويقترح فتحاً محدوداً للظلال', () => {
    const report = analyzeImageQuality(pixels([[30, 30, 30, 255], [48, 48, 48, 255], [42, 42, 42, 255], [36, 36, 36, 255]]), 2, 2);
    expect(report.summary).toContain('داكنة');
    expect(getQuickPolishSettings(report).brightness).toBeGreaterThan(100);
  });

  it('لا يحسب البكسلات الشفافة كإضاءة للمنتج', () => {
    const report = analyzeImageQuality(pixels([[0, 0, 0, 0], [0, 0, 0, 0], [180, 180, 180, 255], [180, 180, 180, 255]]), 2, 2);
    expect(report.brightness).toBe(180);
  });

  it('يهدئ الصورة البيضاء الساطعة بدلاً من زيادة سطوعها', () => {
    const report = analyzeImageQuality(pixels([[245, 245, 245, 255], [238, 238, 238, 255], [250, 250, 250, 255], [242, 242, 242, 255]]), 2, 2);
    expect(report.summary).toContain('ساطعة');
    expect(getQuickPolishSettings(report).brightness).toBeLessThan(100);
  });

  it('لا يفرض معالجة قوية على القماش المنقوش عالي التباين', () => {
    const report = analyzeImageQuality(pixels([[70, 30, 130, 255], [220, 180, 30, 255], [40, 120, 180, 255], [210, 80, 90, 255]]), 2, 2);
    const settings = getQuickPolishSettings(report);
    expect(settings.contrast).toBeLessThanOrEqual(102);
    expect(settings.saturation).toBeLessThanOrEqual(101);
  });

  it('يترك وصفة الصورة المتوازنة خفيفة وقابلة للتراجع', () => {
    const report = analyzeImageQuality(pixels([[80, 80, 80, 255], [180, 180, 180, 255], [100, 100, 100, 255], [200, 200, 200, 255]]), 2, 2);
    const settings = getQuickPolishSettings(report);
    expect(settings.brightness).toBeLessThanOrEqual(101);
    expect(settings.contrast).toBeLessThanOrEqual(102);
  });

  it('يعرض تنبيهاً غير معيق عندما تكون أبعاد الصورة صغيرة', () => {
    const tiny = new Uint8ClampedArray(320 * 320 * 4).fill(160);
    expect(analyzeImageQuality(tiny, 320, 320).detailNotice).toContain('دقة الصورة صغيرة');
  });

  it('يخفف شفافية هالة محاطة بخلفية شفافة من دون تغيير لونها', () => {
    const source = pixels([
      [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0],
      [0, 0, 0, 0], [200, 40, 20, 80], [0, 0, 0, 0],
      [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0],
    ]);
    const cleaned = cleanTransparentEdges(source, 3, 3);
    expect(cleaned.slice(16, 19)).toEqual(source.slice(16, 19));
    expect(cleaned[19]).toBeLessThan(80);
  });

  it('لا يلمس البكسلات المعتمة في نسيج القطعة', () => {
    const source = pixels([
      [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0],
      [0, 0, 0, 0], [30, 90, 180, 255], [0, 0, 0, 0],
      [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0],
    ]);
    expect(cleanTransparentEdges(source, 3, 3)).toEqual(source);
  });
});
