/**
 * تجهيز شعار المتجر وتذييله للحفظ مع المتاجر المحفوظة.
 * التصميم النهائي قد يصل عرضه إلى 2688 بكسل، لكن حفظ نسخة كاملة لكل متجر
 * يتجاوز سعة التخزين المحلي، لذلك نحفظ نسخة مخفّضة تكفي للعرض على الهاتف.
 */

export type StoreArtworkKind = 'logo' | 'footer';

const TARGET_MAX_EDGE: Record<StoreArtworkKind, number> = {
  logo: 512,
  footer: 2048,
};

/** إن كانت الصورة أصغر من الحد وبحجم معقول نحتفظ بالنسخة الأصلية كما هي بلا إعادة ترميز. */
const KEEP_ORIGINAL_MAX_CHARS = 350_000;

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('تعذر تحميل الصورة'));
    image.src = source;
  });
}

/**
 * يعيد نسخة مناسبة للحفظ من صورة الهوية. عند أي تعذر في المعالجة
 * يعيد المصدر كما هو حتى لا تضيع صورة اختارها المستخدم.
 */
export async function prepareStoreArtwork(source: string, kind: StoreArtworkKind): Promise<string> {
  const trimmed = typeof source === 'string' ? source.trim() : '';
  if (!trimmed.startsWith('data:image/')) return '';
  const maxEdge = TARGET_MAX_EDGE[kind];
  try {
    const image = await loadImage(trimmed);
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    if (!width || !height) return trimmed;
    const largest = Math.max(width, height);
    if (largest <= maxEdge && trimmed.length <= KEEP_ORIGINAL_MAX_CHARS) return trimmed;
    const scale = Math.min(1, maxEdge / largest);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d');
    if (!context) return trimmed;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const encoded = canvas.toDataURL('image/webp', 0.85);
    return encoded.startsWith('data:image/') ? encoded : trimmed;
  } catch {
    return trimmed;
  }
}
