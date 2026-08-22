import { LOCAL_BACKGROUND_MODEL_SIZE_BYTES, normalizeU2NetMask, withLocalRemovalTimeout } from './localBackgroundRemovalSupport';

const LOCAL_MODEL_URL = '/local-runtime-assets/u2netp.onnx';
const ORT_WASM_URL = '/local-runtime-assets/ort-wasm-simd-threaded.wasm';
const ORT_WASM_MJS_URL = '/local-runtime-assets/ort-wasm-simd-threaded.mjs';
const MODEL_CACHE_NAME = 'clothing-ad-u2netp-v2';
const MODEL_IDB_NAME = 'clothing-ad-local-models-v1';
const MODEL_IDB_STORE = 'models';
const MODEL_IDB_KEY = 'u2netp-onnx';
const INPUT_SIZE = 320;
const IMAGE_NET_MEAN = [0.485, 0.456, 0.406];
const IMAGE_NET_STD = [0.229, 0.224, 0.225];
const SOURCE_IMAGE_TIMEOUT_MS = 12_000;
const SESSION_INIT_TIMEOUT_MS = 35_000;
const INFERENCE_TIMEOUT_MS = 30_000;
const MODEL_DOWNLOAD_TIMEOUT_MS = 45_000;

export type LocalRemovalStage = 'downloading' | 'loading' | 'processing' | 'finishing';

export type LocalRemovalTiming = {
  sessionMs: number;
  sourcePreparationMs: number;
  inferenceMs: number;
  finishingMs: number;
  totalMs: number;
};

export type LocalBackgroundRemovalResult = {
  imageUrl: string;
  width: number;
  height: number;
  modelSizeBytes: number;
  timing: LocalRemovalTiming;
};

let sessionPromise: Promise<import('onnxruntime-web/wasm').InferenceSession> | null = null;
const now = () => typeof performance !== 'undefined' ? performance.now() : Date.now();

/**
 * يشغّل U2NetP على الهاتف عبر WebAssembly. لا يرسل الصورة إلى خادم أو API.
 * يُحمّل النموذج ويخزّنه عند أول استخدام فقط، ثم يعاد استعمال جلسة الاستدلال في الجلسة نفسها.
 */
export async function removeBackgroundLocally(sourceUrl: string, onStage?: (stage: LocalRemovalStage) => void): Promise<LocalBackgroundRemovalResult> {
  const startedAt = now();
  if (typeof WebAssembly === 'undefined') throw new Error('WebAssembly is unavailable');
  onStage?.('loading');
  const sessionStartedAt = now();
  const session = await getSession(onStage);
  const sessionMs = now() - sessionStartedAt;
  onStage?.('processing');

  const sourceStartedAt = now();
  const source = await withLocalRemovalTimeout(loadImage(sourceUrl), SOURCE_IMAGE_TIMEOUT_MS, 'SOURCE_IMAGE_TIMEOUT');
  const inputCanvas = document.createElement('canvas');
  inputCanvas.width = INPUT_SIZE;
  inputCanvas.height = INPUT_SIZE;
  const inputContext = inputCanvas.getContext('2d', { willReadFrequently: true });
  if (!inputContext) throw new Error('Canvas is unavailable');
  inputContext.drawImage(source, 0, 0, INPUT_SIZE, INPUT_SIZE);

  const inputPixels = inputContext.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE).data;
  const tensorData = new Float32Array(1 * 3 * INPUT_SIZE * INPUT_SIZE);
  for (let pixelIndex = 0; pixelIndex < INPUT_SIZE * INPUT_SIZE; pixelIndex += 1) {
    for (let channel = 0; channel < 3; channel += 1) {
      const rgb = inputPixels[pixelIndex * 4 + channel] / 255;
      tensorData[channel * INPUT_SIZE * INPUT_SIZE + pixelIndex] = (rgb - IMAGE_NET_MEAN[channel]) / IMAGE_NET_STD[channel];
    }
  }
  const sourcePreparationMs = now() - sourceStartedAt;

  const ort = await import('onnxruntime-web/wasm');
  const input = new ort.Tensor('float32', tensorData, [1, 3, INPUT_SIZE, INPUT_SIZE]);
  const inferenceStartedAt = now();
  const output = await withLocalRemovalTimeout(session.run({ [session.inputNames[0]]: input }), INFERENCE_TIMEOUT_MS, 'INFERENCE_TIMEOUT');
  const inferenceMs = now() - inferenceStartedAt;
  const outputName = session.outputNames.includes('d0') ? 'd0' : session.outputNames[0];
  const alphaValues = normalizeU2NetMask(output[outputName].data as Float32Array);

  onStage?.('finishing');
  const finishingStartedAt = now();
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = INPUT_SIZE;
  maskCanvas.height = INPUT_SIZE;
  const maskContext = maskCanvas.getContext('2d');
  if (!maskContext) throw new Error('Mask canvas is unavailable');
  const maskImageData = maskContext.createImageData(INPUT_SIZE, INPUT_SIZE);
  for (let index = 0; index < alphaValues.length; index += 1) {
    const alpha = alphaValues[index];
    const offset = index * 4;
    maskImageData.data[offset] = 255;
    maskImageData.data[offset + 1] = 255;
    maskImageData.data[offset + 2] = 255;
    maskImageData.data[offset + 3] = alpha;
  }
  maskContext.putImageData(maskImageData, 0, 0);

  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = source.naturalWidth || source.width;
  outputCanvas.height = source.naturalHeight || source.height;
  const outputContext = outputCanvas.getContext('2d', { willReadFrequently: true });
  if (!outputContext) throw new Error('Output canvas is unavailable');
  outputContext.drawImage(source, 0, 0, outputCanvas.width, outputCanvas.height);
  // destination-in يطبق القناع بعد تكبيره داخل Canvas نفسه، ويمنع نسخ بكسلات
  // كبيرة متعددة إلى JavaScript عند كل صورة، مع بقاء دقة الصورة النهائية كما هي.
  outputContext.save();
  outputContext.globalCompositeOperation = 'destination-in';
  outputContext.drawImage(maskCanvas, 0, 0, outputCanvas.width, outputCanvas.height);
  outputContext.restore();

  const blob = await canvasToBlob(outputCanvas);
  const finishingMs = now() - finishingStartedAt;
  return {
    imageUrl: URL.createObjectURL(blob),
    width: outputCanvas.width,
    height: outputCanvas.height,
    modelSizeBytes: LOCAL_BACKGROUND_MODEL_SIZE_BYTES,
    timing: {
      sessionMs: Math.round(sessionMs),
      sourcePreparationMs: Math.round(sourcePreparationMs),
      inferenceMs: Math.round(inferenceMs),
      finishingMs: Math.round(finishingMs),
      totalMs: Math.round(now() - startedAt),
    },
  };
}

/**
 * يبدأ تنزيل النموذج وتجهيز جلسة WebAssembly بعد اختيار صورة الملابس، بينما
 * يراجع المستخدم بيانات الإعلان. يعاد استعمال الوعد نفسه عند الضغط على التوليد.
 */
export async function prewarmLocalBackgroundRemoval(): Promise<void> {
  if (typeof WebAssembly === 'undefined') return;
  await getSession();
}

async function getSession(onStage?: (stage: LocalRemovalStage) => void) {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const model = await getCachedLocalModel(() => onStage?.('downloading'));
      const ort = await import('onnxruntime-web/wasm');
      // لا نعتمد على رابط ملف Vite المؤقت، ونمنع العامل المتعدد لرفع توافق Chrome Android.
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.wasmPaths = { wasm: ORT_WASM_URL, mjs: ORT_WASM_MJS_URL };
      onStage?.('loading');
      return withLocalRemovalTimeout(ort.InferenceSession.create(model, { executionProviders: ['wasm'] }), SESSION_INIT_TIMEOUT_MS, 'SESSION_INIT_TIMEOUT');
    })().catch(error => {
      sessionPromise = null;
      throw error;
    });
  }
  return sessionPromise;
}

export async function getCachedLocalModel(onCacheMiss?: () => void): Promise<ArrayBuffer> {
  try {
    const cache = 'caches' in window ? await caches.open(MODEL_CACHE_NAME) : null;
    const cached = await cache?.match(LOCAL_MODEL_URL);
    if (cached) {
      const cachedBytes = await cached.arrayBuffer();
      if (cachedBytes.byteLength > 0) {
        void saveModelToIndexedDb(cachedBytes.slice(0));
        return cachedBytes;
      }
    }

    const persistedBytes = await loadModelFromIndexedDb();
    if (persistedBytes?.byteLength) {
      if (cache) void cache.put(LOCAL_MODEL_URL, new Response(persistedBytes.slice(0), { headers: { 'content-type': 'application/octet-stream' } }));
      return persistedBytes;
    }

    onCacheMiss?.();
    const response = await withLocalRemovalTimeout(fetch(LOCAL_MODEL_URL, { cache: 'force-cache' }), MODEL_DOWNLOAD_TIMEOUT_MS, 'MODEL_DOWNLOAD_TIMEOUT');
    if (!response.ok) throw new Error('MODEL_DOWNLOAD');
    const modelBytes = await response.arrayBuffer();
    if (!modelBytes.byteLength) throw new Error('MODEL_DOWNLOAD');
    if (cache) await cache.put(LOCAL_MODEL_URL, new Response(modelBytes.slice(0), { headers: { 'content-type': 'application/octet-stream' } }));
    await saveModelToIndexedDb(modelBytes.slice(0));
    await requestPersistentModelStorage();
    return modelBytes;
  } catch (error) {
    if (error instanceof Error && (error.message === 'MODEL_DOWNLOAD' || error.message === 'MODEL_DOWNLOAD_TIMEOUT')) throw error;
    throw new Error('MODEL_DOWNLOAD');
  }
}

function openModelDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise(resolve => {
    try {
      const request = indexedDB.open(MODEL_IDB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(MODEL_IDB_STORE)) request.result.createObjectStore(MODEL_IDB_STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function loadModelFromIndexedDb(): Promise<ArrayBuffer | null> {
  const database = await openModelDatabase();
  if (!database) return null;
  return new Promise(resolve => {
    try {
      const request = database.transaction(MODEL_IDB_STORE, 'readonly').objectStore(MODEL_IDB_STORE).get(MODEL_IDB_KEY);
      request.onsuccess = () => {
        database.close();
        const value = request.result as unknown;
        resolve(value && typeof (value as { byteLength?: unknown }).byteLength === 'number' && typeof (value as { slice?: unknown }).slice === 'function' ? value as ArrayBuffer : null);
      };
      request.onerror = () => { database.close(); resolve(null); };
    } catch {
      database.close();
      resolve(null);
    }
  });
}

async function saveModelToIndexedDb(model: ArrayBuffer): Promise<void> {
  const database = await openModelDatabase();
  if (!database) return;
  await new Promise<void>(resolve => {
    try {
      const transaction = database.transaction(MODEL_IDB_STORE, 'readwrite');
      transaction.objectStore(MODEL_IDB_STORE).put(model, MODEL_IDB_KEY);
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => { database.close(); resolve(); };
      transaction.onabort = () => { database.close(); resolve(); };
    } catch {
      database.close();
      resolve();
    }
  });
}

/** يطلب من المتصفح الاحتفاظ بملفات النموذج؛ قد يرفض النظام الطلب عند امتلاء التخزين. */
async function requestPersistentModelStorage() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted?.())) await navigator.storage.persist();
  } catch {
    // يبقى Cache Storage العادي مستخدماً عند عدم دعم التخزين المستمر.
  }
}

function loadImage(sourceUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Unable to load product image locally'));
    image.decoding = 'async';
    image.src = sourceUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Unable to export transparent image')), 'image/png');
  });
}
