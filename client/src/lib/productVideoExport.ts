import type { AdDetails, TemplateSettings } from '@shared/types';
import { DEFAULT_PRODUCT_VIDEO_SETTINGS, PRODUCT_VIDEO_DIMENSIONS, type ProductVideoScene, type ProductVideoSettings } from '@shared/productVideoTypes';

export type ProductVideoProgress = { frame: number; total: number; percent: number; scene: string };
export type ProductVideoExportOptions = { signal?: AbortSignal; onProgress?: (progress: ProductVideoProgress) => void };

const FONT = 'Cairo, Tahoma, Arial, sans-serif';
const MIME_CANDIDATES = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('تم إلغاء تصدير الفيديو', 'AbortError');
}

function lerp(from: number, to: number, amount: number) { return from + (to - from) * amount; }
function ease(amount: number) { return amount * amount * (3 - 2 * amount); }

export function buildProductVideoScenes(durationSeconds: number): ProductVideoScene[] {
  const d = Math.max(4, durationSeconds);
  const intro = Math.min(1.2, d * .15);
  const reveal = Math.min(1.4, d * .16);
  const details = Math.min(2.1, d * .24);
  const offer = Math.min(1.7, d * .19);
  return [
    { id: 'intro', start: 0, end: intro },
    { id: 'reveal', start: intro, end: intro + reveal },
    { id: 'details', start: intro + reveal, end: intro + reveal + details },
    { id: 'offer', start: intro + reveal + details, end: Math.min(d - .8, intro + reveal + details + offer) },
    { id: 'outro', start: Math.min(d - .8, intro + reveal + details + offer), end: d },
  ];
}

function sceneAt(time: number, scenes: ProductVideoScene[]) {
  return scenes.find(scene => time >= scene.start && time < scene.end) || scenes[scenes.length - 1];
}

async function loadImage(src: string) {
  const image = new Image();
  image.src = src;
  await image.decode();
  return image;
}

function drawCover(ctx: CanvasRenderingContext2D, image: CanvasImageSource, canvasWidth: number, canvasHeight: number, zoom = 1, offsetY = 0, alpha = 1) {
  const sourceWidth = image instanceof HTMLImageElement ? image.naturalWidth : canvasWidth;
  const sourceHeight = image instanceof HTMLImageElement ? image.naturalHeight : canvasHeight;
  const scale = Math.max(canvasWidth / sourceWidth, canvasHeight / sourceHeight) * zoom;
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(image, (canvasWidth - width) / 2, (canvasHeight - height) / 2 + offsetY, width, height);
  ctx.restore();
}

function drawContain(ctx: CanvasRenderingContext2D, image: CanvasImageSource, box: { x: number; y: number; width: number; height: number }, zoom = 1, alpha = 1) {
  const sourceWidth = image instanceof HTMLImageElement ? image.naturalWidth : box.width;
  const sourceHeight = image instanceof HTMLImageElement ? image.naturalHeight : box.height;
  const scale = Math.min(box.width / sourceWidth, box.height / sourceHeight) * zoom;
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(image, box.x + (box.width - width) / 2, box.y + (box.height - height) / 2, width, height);
  ctx.restore();
}

function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, weight = 800, align: CanvasTextAlign = 'center') {
  if (!text.trim()) return;
  ctx.save();
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.shadowColor = 'rgba(0,0,0,.16)';
  ctx.shadowBlur = Math.max(2, size * .08);
  ctx.fillText(text.trim(), x, y);
  ctx.restore();
}

function drawRoundedPanel(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, fill: string) {
  ctx.save();
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fill();
  ctx.restore();
}

export function drawProductVideoFrame(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, settings: ProductVideoSettings, details: AdDetails, template: TemplateSettings, productImage: CanvasImageSource, finalAd: CanvasImageSource, scenes = buildProductVideoScenes(settings.durationSeconds)) {
  const scene = sceneAt(time, scenes);
  const palette = template.smartBackgroundColor || (template.visualTheme === 'midnight' ? '#161329' : '#faf8ff');
  const accent = template.studioPriceBackgroundColor || template.smartTextColor || '#48208f';
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = palette;
  ctx.fillRect(0, 0, width, height);

  const localProgress = Math.max(0, Math.min(1, (time - scene.start) / Math.max(.01, scene.end - scene.start)));
  const smooth = ease(localProgress);
  const safe = Math.min(width, height) * .06;
  const label = details.storeName.trim() || 'عرض المنتج';

  if (scene.id === 'intro') {
    drawContain(ctx, productImage, { x: safe, y: safe * 1.2, width: width - safe * 2, height: height * .72 }, lerp(1.02, 1.09, smooth));
    drawRoundedPanel(ctx, safe, height - safe * 3.2, width - safe * 2, safe * 1.35, safe * .28, 'rgba(255,255,255,.86)');
    drawText(ctx, label, width / 2, height - safe * 2.55, Math.max(20, width * .045), template.smartTextColor || '#24154f');
    drawText(ctx, 'اكتشف القطعة', width / 2, height - safe * 1.95, Math.max(14, width * .028), '#6b6280', 600);
  } else if (scene.id === 'reveal') {
    const fade = Math.min(1, localProgress * 1.5);
    drawContain(ctx, productImage, { x: safe, y: safe * 1.1, width: width - safe * 2, height: height * .72 }, 1.03, 1 - fade);
    drawContain(ctx, finalAd, { x: safe, y: safe * 1.1, width: width - safe * 2, height: height * .72 }, 1.02, fade);
    drawText(ctx, 'نتيجة أنظف', width / 2, height - safe * 2.45, Math.max(20, width * .05), template.smartTextColor || '#24154f');
  } else if (scene.id === 'details') {
    const zoom = lerp(1.02, 1.16, smooth);
    drawContain(ctx, finalAd, { x: 0, y: 0, width, height }, zoom);
    drawRoundedPanel(ctx, safe, safe, width - safe * 2, safe * .8, safe * .2, 'rgba(255,255,255,.78)');
    drawText(ctx, 'تفاصيل القطعة', width / 2, safe * 1.4, Math.max(16, width * .035), template.smartTextColor || '#24154f');
  } else if (scene.id === 'offer') {
    drawContain(ctx, finalAd, { x: safe, y: safe * .7, width: width - safe * 2, height: height * .67 }, lerp(1.02, 1, smooth));
    const cardY = height * .73;
    drawRoundedPanel(ctx, safe, cardY, width - safe * 2, height - cardY - safe, safe * .25, 'rgba(255,255,255,.93)');
    drawText(ctx, details.productName.trim() || label, width / 2, cardY + safe * .75, Math.max(18, width * .042), template.smartTextColor || '#24154f');
    const price = details.price.trim();
    if (price) drawText(ctx, `${price} ${details.currency.trim()}`, width / 2, cardY + safe * 1.55, Math.max(24, width * .06), accent, 900);
    if (details.discount.trim()) drawText(ctx, `خصم ${details.discount.trim()}%`, width / 2, cardY + safe * 2.2, Math.max(14, width * .03), '#b23858', 800);
    if (details.quantity.trim()) drawText(ctx, `الكمية: ${details.quantity.trim()}`, width / 2, cardY + safe * 2.75, Math.max(13, width * .027), '#6b6280', 600);
  } else {
    drawContain(ctx, finalAd, { x: safe, y: safe, width: width - safe * 2, height: height - safe * 2 }, 1);
    if (details.storeName.trim()) drawText(ctx, details.storeName, width / 2, height - safe * 1.45, Math.max(14, width * .03), template.smartTextColor || '#24154f');
  }
}

export function selectVideoMimeType() {
  if (typeof MediaRecorder === 'undefined') return '';
  return MIME_CANDIDATES.find(candidate => MediaRecorder.isTypeSupported(candidate)) || '';
}

export async function exportProductPromoVideo(details: AdDetails, template: TemplateSettings, productImageSrc: string, finalAdSrc: string, settings: Partial<ProductVideoSettings> = {}, options: ProductVideoExportOptions = {}) {
  const resolved = { ...DEFAULT_PRODUCT_VIDEO_SETTINGS, ...settings };
  if (resolved.includeMusic) throw new Error('الموسيقى ستتوفر بعد إضافة مسارات محلية مرخصة. اختر بدون موسيقى حاليًا.');
  const mimeType = selectVideoMimeType();
  if (!mimeType) throw new Error('هذا المتصفح لا يدعم تصدير الفيديو المحلي. جرّب Chrome أو Edge.');
  const dimensions = PRODUCT_VIDEO_DIMENSIONS[resolved.preset];
  const scale = resolved.quality === 'light' ? .67 : resolved.quality === 'high' ? 1 : .85;
  const width = Math.round(dimensions.width * scale);
  const height = Math.round(dimensions.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('تعذر إنشاء مساحة الفيديو');
  const [productImage, finalAd] = await Promise.all([loadImage(productImageSrc), loadImage(finalAdSrc)]);
  const stream = canvas.captureStream(resolved.fps);
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: resolved.quality === 'high' ? 8_000_000 : resolved.quality === 'light' ? 2_500_000 : 5_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
  const stopped = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    recorder.onerror = () => reject(new Error('تعذر إنهاء ملف الفيديو'));
  });
  const scenes = buildProductVideoScenes(resolved.durationSeconds);
  const total = Math.ceil(resolved.durationSeconds * resolved.fps);
  recorder.start();
  for (let frame = 0; frame < total; frame += 1) {
    throwIfAborted(options.signal);
    const time = frame / resolved.fps;
    const scene = sceneAt(time, scenes);
    drawProductVideoFrame(ctx, width, height, time, resolved, details, template, productImage, finalAd, scenes);
    options.onProgress?.({ frame: frame + 1, total, percent: Math.round(((frame + 1) / total) * 100), scene: scene.id });
    await new Promise<void>(resolve => window.setTimeout(resolve, 1000 / resolved.fps));
  }
  recorder.stop();
  return stopped;
}
