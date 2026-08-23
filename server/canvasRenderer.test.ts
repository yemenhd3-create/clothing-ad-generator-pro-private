// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_AD_DETAILS, DEFAULT_TEMPLATE_SETTINGS } from '../shared/types';
import { renderAd } from '../client/src/lib/canvasRenderer';
import { TEMPLATE_THEME_LIST } from '../shared/templateThemes';

class LoadedImage {
  width = 600;
  height = 900;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  decoding = 'async';
  crossOrigin = '';
  set src(_value: string) { queueMicrotask(() => this.onload?.()); }
  decode() { return Promise.resolve(); }
}

function createContext() {
  const noop = () => undefined;
  const fillText = vi.fn();
  const drawImage = vi.fn();
  const stroke = vi.fn();
  const createRadialGradient = vi.fn(() => ({ addColorStop: noop }));
  const fonts: string[] = [];
  const fillStyles: string[] = [];
  const context = {
    fillRect: noop, stroke, save: noop, restore: noop, beginPath: noop, clip: noop, rect: noop, ellipse: noop,
    arc: noop, fill: noop, fillText, drawImage, arcTo: noop,
    moveTo: noop, lineTo: noop, closePath: noop,
    createRadialGradient,
    measureText: (text: string) => ({ width: text.length * 12 }),
    __fillText: fillText,
    __drawImage: drawImage,
    __stroke: stroke,
    __fonts: fonts,
    __fillStyles: fillStyles,
    __createRadialGradient: createRadialGradient,
  } as unknown as CanvasRenderingContext2D & { __fillText: ReturnType<typeof vi.fn>; __drawImage: ReturnType<typeof vi.fn>; __stroke: ReturnType<typeof vi.fn>; __fonts: string[]; __fillStyles: string[]; __createRadialGradient: ReturnType<typeof vi.fn> };
  Object.defineProperty(context, 'font', { get: () => fonts.at(-1), set: (value: string) => fonts.push(value) });
  Object.defineProperty(context, 'fillStyle', { get: () => fillStyles.at(-1), set: (value: string) => fillStyles.push(value) });
  return context;
}

describe('Canvas advertisement renderer', () => {
  const context = createContext();
  let createdCanvas: HTMLCanvasElement | null = null;

  beforeEach(() => {
    context.__fillText.mockClear();
    context.__drawImage.mockClear();
    context.__stroke.mockClear();
    context.__fonts.splice(0);
    context.__fillStyles.splice(0);
    context.__createRadialGradient.mockClear();
    vi.stubGlobal('Image', LoadedImage);
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:rendered-advertisement') });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
    Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
      configurable: true,
      value(callback: BlobCallback) { callback(new Blob(['advertisement'], { type: 'image/png' })); },
    });
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
      const element = originalCreateElement(tagName);
      if (tagName === 'canvas') createdCanvas = element as HTMLCanvasElement;
      return element;
    }) as typeof document.createElement);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders a PNG Blob URL at the requested export dimensions without mocking renderAd', async () => {
    const result = await renderAd(
      { ...DEFAULT_AD_DETAILS, productName: 'عباية عملية', price: '5000', discount: '20', storeName: 'متجر مروان', storePhone: '770976559' },
      { ...DEFAULT_TEMPLATE_SETTINGS, size: 'story' },
      'blob:garment-image',
      { width: 540, height: 960 }
    );

    expect(result).toBe('blob:rendered-advertisement');
    expect(createdCanvas?.width).toBe(540);
    expect(createdCanvas?.height).toBe(960);
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(context.__fillText).toHaveBeenCalledWith('متجر مروان', expect.any(Number), expect.any(Number));
    expect(context.__fillText).toHaveBeenCalledWith('770976559', expect.any(Number), expect.any(Number));
  });

  it('anchors a transparent on-model result near the bottom of the white product card', async () => {
    context.__drawImage.mockClear();
    await renderAd(DEFAULT_AD_DETAILS, DEFAULT_TEMPLATE_SETTINGS, 'blob:garment-image', { width: 1080, height: 1350, visualMode: 'garment' });
    const garmentY = context.__drawImage.mock.calls.at(-1)?.[6] as number;

    context.__drawImage.mockClear();
    await renderAd(DEFAULT_AD_DETAILS, DEFAULT_TEMPLATE_SETTINGS, 'blob:transparent-person', { width: 1080, height: 1350, visualMode: 'transparentPerson' });
    const personY = context.__drawImage.mock.calls.at(-1)?.[6] as number;

    expect(personY).toBeLessThan(garmentY);
  });

  it('يكبر المنتج داخل منطقة البطل عند اختيار حجم أكبر من الافتراضي من دون تغيير عناصر القالب الأخرى', async () => {
    context.__drawImage.mockClear();
    await renderAd(DEFAULT_AD_DETAILS, { ...DEFAULT_TEMPLATE_SETTINGS, productScale: .76 }, 'blob:garment-image', { width: 1080, height: 1350 });
    const normalWidth = context.__drawImage.mock.calls.at(-1)?.[7] as number;

    context.__drawImage.mockClear();
    await renderAd(DEFAULT_AD_DETAILS, { ...DEFAULT_TEMPLATE_SETTINGS, productScale: 1.16 }, 'blob:garment-image', { width: 1080, height: 1350 });
    const enlargedWidth = context.__drawImage.mock.calls.at(-1)?.[7] as number;

    expect(enlargedWidth).toBeGreaterThan(normalWidth);
  });

  it('لا يرسم إطاراً محيطاً بالإعلان حتى عند وجود إعداد قديم له ويحافظ على خط العنوان', async () => {
    const titledDetails = { ...DEFAULT_AD_DETAILS, productName: 'فستان بلوشي أنيق' };
    await renderAd(titledDetails, { ...DEFAULT_TEMPLATE_SETTINGS, showFrame: false, showQualityMark: false }, 'blob:garment-image', { width: 1080, height: 1350 });
    const strokesWithoutFrame = context.__stroke.mock.calls.length;
    expect(context.__fillText).not.toHaveBeenCalledWith('✓', expect.any(Number), expect.any(Number));

    context.__fillText.mockClear();
    context.__stroke.mockClear();
    context.__fonts.splice(0);
    await renderAd(titledDetails, { ...DEFAULT_TEMPLATE_SETTINGS, showFrame: true, showQualityMark: false }, 'blob:garment-image', { width: 1080, height: 1350 });

    expect(context.__stroke.mock.calls.length).toBe(strokesWithoutFrame);
    expect(context.__fonts).toContain('900 53px Cairo, Tahoma, Arial, sans-serif');
  });

  it('يرسم شعار المتجر الدائري وتذييله العريض كطبقات مستقلة عند تفعيلهما', async () => {
    context.__drawImage.mockClear();
    await renderAd(
      { ...DEFAULT_AD_DETAILS, productName: 'قميص قطني' },
      { ...DEFAULT_TEMPLATE_SETTINGS, showFooterArtwork: true, footerArtwork: 'data:image/png;base64,footer', showStoreLogo: true, storeLogoArtwork: 'data:image/png;base64,logo' },
      'blob:garment-image',
      { width: 1080, height: 1350 }
    );
    expect(context.__drawImage).toHaveBeenCalledTimes(3);
  });

  it('يطبق مواضع وتحجيم الطبقات المحفوظة داخل Canvas بدلاً من المواضع الافتراضية', async () => {
    const base = { ...DEFAULT_TEMPLATE_SETTINGS, showFooterArtwork: true, footerArtwork: 'data:image/png;base64,footer', showStoreLogo: true, storeLogoArtwork: 'data:image/png;base64,logo' };
    context.__drawImage.mockClear();
    await renderAd(DEFAULT_AD_DETAILS, base, 'blob:garment-image', { width: 1080, height: 1350 });
    const defaultLogoX = context.__drawImage.mock.calls[0][1];
    const defaultFooterX = context.__drawImage.mock.calls[2][1];

    context.__drawImage.mockClear();
    await renderAd(DEFAULT_AD_DETAILS, { ...base, artworkLayouts: { portrait: { footer: { x: .12, y: .82, width: .7, height: .14, fit: 'stretch' }, logo: { x: .12, y: .10, width: .12, height: .12, fit: 'cover' } } } }, 'blob:garment-image', { width: 1080, height: 1350 });
    expect(context.__drawImage.mock.calls[0][1]).not.toBe(defaultLogoX);
    expect(context.__drawImage.mock.calls[2][1]).not.toBe(defaultFooterX);
  });

  it('يرسم الأنماط البصرية الخمسة من Theme Registry داخل المحرك نفسه من دون تغيير المقاس أو إنشاء Renderer جديد', async () => {
    const details = { ...DEFAULT_AD_DETAILS, productName: 'عباية أنيقة', price: '5000', storeName: 'متجر مروان', storePhone: '770976559' };
    for (const theme of TEMPLATE_THEME_LIST) {
      context.__fillStyles.splice(0);
      await renderAd(details, { ...DEFAULT_TEMPLATE_SETTINGS, visualTheme: theme.id }, 'blob:garment-image', { width: 1080, height: 1350 });
      expect(context.__fillStyles).toContain(theme.palette.background);
      expect(context.__fillStyles).toContain(theme.palette.primary);
      expect(context.__fillStyles).toContain(theme.palette.accent);
    }
  });

  it('يرسم خلفية استديو وظل منتج محليين عند اختيارهما من الإعدادات', async () => {
    await renderAd(DEFAULT_AD_DETAILS, { ...DEFAULT_TEMPLATE_SETTINGS, productBackdrop: 'spotlight', productShadow: 'grounded' }, 'blob:garment-image', { width: 1080, height: 1350 });
    expect(context.__createRadialGradient).toHaveBeenCalledTimes(2);
  });

  it('يرسم الخلفيتين الوردي والرملي محلياً مع استمرار وضع الظل والقطعة نفسه', async () => {
    for (const productBackdrop of ['rose', 'sand'] as const) {
      context.__createRadialGradient.mockClear();
      context.__drawImage.mockClear();
      await renderAd(DEFAULT_AD_DETAILS, { ...DEFAULT_TEMPLATE_SETTINGS, productBackdrop, productShadow: 'grounded' }, 'blob:garment-image', { width: 1080, height: 1350 });
      expect(context.__createRadialGradient).toHaveBeenCalledTimes(2);
      expect(context.__drawImage.mock.calls.at(-1)?.[7]).toBeGreaterThan(160);
    }
  });

  it('يضيف البروز البصري الاختياري خلف قطعة الملابس فقط ولا يبدل موضع المنتج الأمامي', async () => {
    await renderAd(DEFAULT_AD_DETAILS, { ...DEFAULT_TEMPLATE_SETTINGS, productPresentation: 'flat' }, 'blob:garment-image', { width: 1080, height: 1350 });
    const flatCall = context.__drawImage.mock.calls.at(-1);
    context.__drawImage.mockClear();
    await renderAd(DEFAULT_AD_DETAILS, { ...DEFAULT_TEMPLATE_SETTINGS, productPresentation: 'lifted' }, 'blob:garment-image', { width: 1080, height: 1350 });
    const liftedFrontCall = context.__drawImage.mock.calls.at(-1);
    expect(context.__drawImage).toHaveBeenCalledTimes(2);
    expect(liftedFrontCall?.slice(1)).toEqual(flatCall?.slice(1));
  });

  it('يرسم خيار المنصة خلف القطعة من دون تغيير رسم القطعة الأمامي', async () => {
    await renderAd(DEFAULT_AD_DETAILS, { ...DEFAULT_TEMPLATE_SETTINGS, productPresentation: 'flat' }, 'blob:garment-image', { width: 1080, height: 1350 });
    const flatCall = context.__drawImage.mock.calls.at(-1);
    const flatStrokes = context.__stroke.mock.calls.length;
    context.__drawImage.mockClear();
    context.__stroke.mockClear();
    await renderAd(DEFAULT_AD_DETAILS, { ...DEFAULT_TEMPLATE_SETTINGS, productPresentation: 'platform' }, 'blob:garment-image', { width: 1080, height: 1350 });
    expect(context.__stroke.mock.calls.length).toBeGreaterThan(flatStrokes);
    expect(context.__drawImage.mock.calls.at(-1)?.slice(1)).toEqual(flatCall?.slice(1));
  });

  it('يعطي قالب غرفة الملابس الافتراضي مساحة استديو كبيرة للقطعة من دون نص أو شارات افتراضية', async () => {
    await renderAd(DEFAULT_AD_DETAILS, DEFAULT_TEMPLATE_SETTINGS, 'blob:garment-image', { width: 1080, height: 1350 });
    const garmentCall = context.__drawImage.mock.calls.at(-1);
    expect(garmentCall?.[5]).toBeGreaterThan(160);
    expect(garmentCall?.[7]).toBeGreaterThan(550);
    expect(context.__fillText).not.toHaveBeenCalledWith('✓', expect.any(Number), expect.any(Number));
  });

  it('يرسم النص والسعر الاختياريين في قالب غرفة الملابس من دون إظهار أي طبقة عند غيابهما', async () => {
    await renderAd(DEFAULT_AD_DETAILS, DEFAULT_TEMPLATE_SETTINGS, 'blob:garment-image', { width: 1080, height: 1350 });
    expect(context.__fillText).not.toHaveBeenCalledWith('متوفر لدى مركز السعر المناسب', expect.any(Number), expect.any(Number));
    context.__fillText.mockClear();
    await renderAd(DEFAULT_AD_DETAILS, { ...DEFAULT_TEMPLATE_SETTINGS, studioCaption: 'متوفر لدى مركز السعر المناسب', studioCaptionTextColor: '#111827', studioCaptionBackgroundColor: '#ff5757', studioPrice: 'السعر 500', studioPriceTextColor: '#111827', studioPriceBackgroundColor: '#ffe600' }, 'blob:garment-image', { width: 1080, height: 1350 });
    expect(context.__fillText).toHaveBeenCalledWith('متوفر لدى مركز السعر المناسب', expect.any(Number), expect.any(Number));
    expect(context.__fillText).toHaveBeenCalledWith('السعر 500', expect.any(Number), expect.any(Number));
    expect(context.__fillStyles).toContain('#ff5757');
    expect(context.__fillStyles).toContain('#ffe600');
  });

  it('يعيد وضع السعر في القالب عند تغيير إحداثياته من أزرار الحركة', async () => {
    const base = { ...DEFAULT_TEMPLATE_SETTINGS, studioPrice: '5000' };
    await renderAd(DEFAULT_AD_DETAILS, { ...base, studioPricePosition: { x: .78, y: .89 } }, 'blob:garment-image', { width: 1080, height: 1350 });
    const initial = context.__fillText.mock.calls.find(call => call[0] === '5000');
    context.__fillText.mockClear();

    await renderAd(DEFAULT_AD_DETAILS, { ...base, studioPricePosition: { x: .70, y: .81 } }, 'blob:garment-image', { width: 1080, height: 1350 });
    const moved = context.__fillText.mock.calls.find(call => call[0] === '5000');

    expect(moved?.[1]).toBeLessThan(initial?.[1] ?? Number.POSITIVE_INFINITY);
    expect(moved?.[2]).toBeLessThan(initial?.[2] ?? Number.POSITIVE_INFINITY);
  });
});
