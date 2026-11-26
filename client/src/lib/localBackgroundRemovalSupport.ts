export const LOCAL_BACKGROUND_MODEL_SIZE_BYTES = 4_574_861;
export const LOCAL_RUNTIME_ENGINE_SIZE_BYTES = 13_479_978;

export function withLocalRemovalTimeout<T>(promise: Promise<T>, milliseconds: number, errorCode: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(errorCode)), milliseconds);
    promise.then(
      value => {
        clearTimeout(timeout);
        resolve(value);
      },
      error => {
        clearTimeout(timeout);
        reject(error);
      }
    );
  });
}

export function getLocalRemovalUnavailableMessage(error: unknown) {
  const detail = error instanceof Error ? error.message : '';
  if (detail.includes('WebAssembly')) return 'هذا المتصفح لا يدعم WebAssembly اللازم للإزالة المحلية.';
  if (detail.includes('MODEL_DOWNLOAD_TIMEOUT')) return 'استغرق تنزيل نموذج الإزالة المحلية وقتاً طويلاً. تحقق من الإنترنت ثم أعد المحاولة، أو ألغِ الخيار لاستخدام المسار السحابي.';
  if (detail.includes('MODEL_DOWNLOAD')) return 'تعذّر تنزيل نموذج الإزالة المحلية. تحقق من الإنترنت في المرة الأولى ثم أعد المحاولة.';
  if (detail.includes('SESSION_INIT_TIMEOUT')) return 'تعذر تجهيز محرك الإزالة المحلية في الوقت المتوقع. جرّب تحديث Chrome أو استخدم Perfect Corp كبديل.';
  if (detail.includes('INFERENCE_TIMEOUT')) return 'استغرق تحليل الملابس محلياً وقتاً طويلاً. جرّب صورة أصغر أو استخدم المسار السحابي.';
  if (detail.includes('SOURCE_IMAGE_TIMEOUT')) return 'تعذّر تجهيز صورة الملابس محلياً في الوقت المتوقع. جرّب التقاط صورة جديدة أو صورة أصغر.';
  if (detail.includes('Unable to load product image locally')) return 'تعذّر فتح صورة الملابس داخل محرك الإزالة المحلية. جرّب صورة أخرى أو التقطها بالكاميرا مباشرة.';
  if (detail.includes('Canvas')) return 'لا يستطيع هذا المتصفح معالجة الصورة محلياً الآن. ألغِ الخيار ليستخدم التطبيق المسار البديل.';
  if (detail.includes('Unable to export transparent image')) return 'تعذّر حفظ القصاصة الشفافة محلياً. سنستخدم المسار البديل أو صورة الملابس الأصلية.';
  return 'تعذّرت إزالة الخلفية محلياً. سنحاول البديل المتاح أو نستخدم صورة الملابس الأصلية.';
}

export function formatLocalModelSize() {
  return `${(LOCAL_BACKGROUND_MODEL_SIZE_BYTES / 1024 / 1024).toFixed(1)}MB`;
}

export function formatLocalFirstDownloadSize() {
  return `${((LOCAL_BACKGROUND_MODEL_SIZE_BYTES + LOCAL_RUNTIME_ENGINE_SIZE_BYTES) / 1024 / 1024).toFixed(1)}MB`;
}

/** يقلب قناع U2NetP العائم إلى قناة alpha، مع حماية القناع المسطّح من القسمة على صفر. */
export function normalizeU2NetMask(mask: ArrayLike<number>) {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < mask.length; index += 1) {
    min = Math.min(min, mask[index]);
    max = Math.max(max, mask[index]);
  }
  const range = max - min;
  return Uint8ClampedArray.from(mask, value => range <= 1e-8 ? 0 : Math.round(((value - min) / range) * 255));
}

/**
 * يحسّن قناع U2NetP: يحذف البقع المنفصلة الصغيرة (قطع قريبة أو ظلال) ويُبقي الجسم
 * الرئيسي، ثم يشدّ حافة الشفافية بمنحنى smoothstep ليقل الهالة حول القطعة.
 * البقع التي تقل عن keepRatio من أكبر قطعة تُحذف؛ ما قارب حجم الأكبر يبقى (مثل كمّين منفصلين).
 */
export function refineU2NetMask(alpha: Uint8ClampedArray, size: number, keepRatio = 0.12): Uint8ClampedArray {
  const total = size * size;
  if (alpha.length !== total) return alpha;
  const threshold = 128;
  const label = new Int32Array(total);
  const sizes: number[] = [0];
  const stack = new Int32Array(total);
  for (let start = 0; start < total; start += 1) {
    if (alpha[start] < threshold || label[start] !== 0) continue;
    const id = sizes.length;
    let count = 0;
    let top = 0;
    stack[top++] = start;
    label[start] = id;
    while (top > 0) {
      const current = stack[--top];
      count += 1;
      const x = current % size;
      const y = (current - x) / size;
      if (x > 0 && alpha[current - 1] >= threshold && label[current - 1] === 0) { label[current - 1] = id; stack[top++] = current - 1; }
      if (x < size - 1 && alpha[current + 1] >= threshold && label[current + 1] === 0) { label[current + 1] = id; stack[top++] = current + 1; }
      if (y > 0 && alpha[current - size] >= threshold && label[current - size] === 0) { label[current - size] = id; stack[top++] = current - size; }
      if (y < size - 1 && alpha[current + size] >= threshold && label[current + size] === 0) { label[current + size] = id; stack[top++] = current + size; }
    }
    sizes.push(count);
  }
  const largest = Math.max(0, ...sizes);
  if (largest === 0) return alpha;
  const keep = sizes.map(count => count >= largest * keepRatio);
  const refined = new Uint8ClampedArray(total);
  for (let index = 0; index < total; index += 1) {
    const value = alpha[index];
    // البكسلات الضعيفة (أقل من 128) تبقى فقط إذا جاورت جسماً محفوظاً، لتبقى الحافة ناعمة.
    let owner = label[index];
    if (owner === 0 && value > 8) {
      const x = index % size;
      const y = (index - x) / size;
      for (let dy = -2; dy <= 2 && owner === 0; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
          const neighbour = label[ny * size + nx];
          if (neighbour !== 0 && keep[neighbour]) { owner = neighbour; break; }
        }
      }
    }
    if (owner === 0 || !keep[owner]) continue;
    const t = Math.min(1, Math.max(0, (value / 255 - 0.2) / 0.6));
    refined[index] = Math.round(t * t * (3 - 2 * t) * 255);
  }
  return refined;
}
