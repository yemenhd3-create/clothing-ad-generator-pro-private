import { GIFEncoder, applyPalette, quantize } from 'gifenc';
import type { AdDetails, TemplateSettings } from '@shared/types';
import type { ProductAnimationSettings } from '@shared/animationTypes';
import { DEFAULT_PRODUCT_ANIMATION_SETTINGS } from '@shared/animationTypes';
import { renderAd } from './canvasRenderer';

export type AnimatedExportProgress = {
  frame: number;
  total: number;
  percent: number;
};

export type AnimatedExportOptions = {
  signal?: AbortSignal;
  onProgress?: (progress: AnimatedExportProgress) => void;
};

const MAX_OUTPUT_WIDTH = 720;
const MAX_FRAME_COUNT = 16;
const MIN_FRAME_COUNT = 8;
const MAX_GIF_BYTES = 12 * 1024 * 1024;

function clampInteger(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function resolveSettings(settings?: Partial<ProductAnimationSettings>): ProductAnimationSettings {
  const merged = { ...DEFAULT_PRODUCT_ANIMATION_SETTINGS, ...settings };
  return {
    ...merged,
    frameCount: clampInteger(merged.frameCount, MIN_FRAME_COUNT, MAX_FRAME_COUNT),
    frameDurationMs: clampInteger(merged.frameDurationMs, 60, 160),
    outputWidth: clampInteger(merged.outputWidth, 360, MAX_OUTPUT_WIDTH),
  };
}

export function getAnimationAngle(type: ProductAnimationSettings['type'], frame: number, total: number, intensity: ProductAnimationSettings['intensity']) {
  const maxAngle = intensity === 'strong' ? 12 : intensity === 'medium' ? 10 : 8;
  const progress = total <= 1 ? 0 : frame / (total - 1);
  if (type === 'rotate') return (frame / Math.max(1, total)) * 360;
  if (type === 'float') return Math.sin(progress * Math.PI * 2) * (maxAngle * .32);
  return Math.sin(progress * Math.PI * 2) * maxAngle;
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('تم إلغاء تصدير الإعلان المتحرك', 'AbortError');
}

async function blobFromUrl(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('تعذر قراءة إطار الإعلان');
  return response.blob();
}

async function imageFromBlob(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) return createImageBitmap(blob);
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function closeImage(image: ImageBitmap | HTMLImageElement) {
  if ('close' in image && typeof image.close === 'function') image.close();
}

/**
 * يولد GIF محليًا من نفس محرك الإعلان. القالب والنص والسعر يعاد رسمها من التصميم،
 * وتتحرك طبقة المنتج وحدها. لا يرسل صورًا أو بيانات إلى الخادم.
 */
export async function generateAnimatedAdGif(
  details: AdDetails,
  template: TemplateSettings,
  productImageSrc: string,
  settings?: Partial<ProductAnimationSettings>,
  options: AnimatedExportOptions = {},
): Promise<Blob> {
  const resolved = resolveSettings(settings);
  const sourceWidth = template.size === 'landscape' ? 1200 : 1080;
  const sourceHeight = template.size === 'portrait' ? 1350 : template.size === 'square' ? 1080 : template.size === 'story' ? 1920 : template.size === 'whatsapp' ? 1440 : 628;
  const scale = Math.min(1, resolved.outputWidth / sourceWidth);
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const encoder = GIFEncoder();

  for (let index = 0; index < resolved.frameCount; index += 1) {
    throwIfAborted(options.signal);
    const angle = getAnimationAngle(resolved.type, index, resolved.frameCount, resolved.intensity);
    const frameUrl = await renderAd(details, template, productImageSrc, {
      width,
      height,
      quality: .86,
      visualMode: 'garment',
      garmentTransform: template.smartGarmentTransform,
      productRotationDegrees: angle,
      productPivot: resolved.pivot,
    });
    try {
      const frameBlob = await blobFromUrl(frameUrl);
      const image = await imageFromBlob(frameBlob);
      try {
        throwIfAborted(options.signal);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) throw new Error('تعذر تهيئة إطار الإعلان المتحرك');
        context.drawImage(image, 0, 0, width, height);
        const pixels = context.getImageData(0, 0, width, height).data;
        const palette = quantize(pixels, 256, { format: 'rgba4444' });
        const indexPixels = applyPalette(pixels, palette, 'rgba4444');
        encoder.writeFrame(indexPixels, width, height, {
          palette,
          delay: resolved.frameDurationMs,
          repeat: resolved.loop ? 0 : -1,
          disposal: 1,
        });
      } finally {
        closeImage(image);
      }
    } finally {
      URL.revokeObjectURL(frameUrl);
    }
    options.onProgress?.({ frame: index + 1, total: resolved.frameCount, percent: Math.round(((index + 1) / resolved.frameCount) * 100) });
    await new Promise<void>(resolve => window.setTimeout(resolve, 0));
  }

  encoder.finish();
  const bytes = encoder.bytes();
  if (bytes.byteLength > MAX_GIF_BYTES) throw new Error('حجم الإعلان المتحرك كبير جدًا؛ قلل المقاس أو عدد الإطارات.');
  const safeBytes = new Uint8Array(bytes);
  return new Blob([safeBytes.buffer], { type: 'image/gif' });
}
