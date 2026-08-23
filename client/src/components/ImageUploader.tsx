import { AlertTriangle, BadgeCheck, Camera, ImageUp, LoaderCircle, ScanLine, Upload, X } from 'lucide-react';
import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { prepareSelectedFile, readImageWithFallback } from '@/lib/imageUploadFlow';
import { getCameraCaptureErrorMessage, getImagePreparationErrorMessage } from '@/lib/imageUploadSupport';
import GarmentCropEditor from './GarmentCropEditor';
import { Button } from './ui/button';

interface ImageUploaderProps {
  onImageSelect: (imageUrl: string, file: File) => void;
  currentImage?: string;
  onImageRemove?: () => void;
}

export default function ImageUploader({
  onImageSelect,
  currentImage,
  onImageRemove,
}: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [pendingCrop, setPendingCrop] = useState<{ source: string; file: File } | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [isCameraStarting, setIsCameraStarting] = useState(false);

  useEffect(() => {
    const video = cameraVideoRef.current;
    if (!cameraStream || !video) return;
    video.srcObject = cameraStream;
    void video.play().catch(() => undefined);
    return () => {
      video.srcObject = null;
    };
  }, [cameraStream]);

  useEffect(() => () => {
    cameraStream?.getTracks().forEach(track => track.stop());
  }, [cameraStream]);

  const stopCamera = () => {
    cameraStream?.getTracks().forEach(track => track.stop());
    setCameraStream(null);
  };

  const startCamera = async () => {
    setErrorMessage('');
    if (!navigator.mediaDevices?.getUserMedia) {
      // تبقى هذه الخطة مهمة للمتصفحات التي تدعم capture في input فقط.
      cameraInputRef.current?.click();
      return;
    }

    setIsCameraStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' } },
      });
      setCameraStream(stream);
    } catch (error) {
      setErrorMessage(getCameraCaptureErrorMessage(error));
    } finally {
      setIsCameraStarting(false);
    }
  };

  const captureCameraPhoto = () => {
    const video = cameraVideoRef.current;
    if (!video || video.videoWidth < 1 || video.videoHeight < 1) {
      setErrorMessage('انتظر لحظة حتى تظهر معاينة الكاميرا بوضوح ثم التقط الصورة.');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      setErrorMessage('تعذر تجهيز صورة الكاميرا على هذا الجهاز. استخدم زر «من المعرض» كبديل.');
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(async blob => {
      if (!blob) {
        setErrorMessage('تعذر حفظ لقطة الكاميرا. التقط صورة مرة أخرى أو استخدم المعرض.');
        return;
      }
      stopCamera();
      await handleFileSelect(new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.9);
  };

  const handleFileSelect = async (file: File) => {
    setErrorMessage('');
    if (!isSupportedImage(file)) {
      setErrorMessage('اختر صورة بصيغة JPG أو PNG أو WebP. إذا كانت الصورة من واتساب، احفظها أولاً في معرض الهاتف ثم اخترها من جديد.');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setErrorMessage('حجم الصورة أكبر من 25 ميجابايت. اختر نسخة أصغر أو قصّ الصورة من معرض الهاتف ثم أعد المحاولة.');
      return;
    }

    setIsLoading(true);

    try {
      const imageUrl = await prepareImageFile(file);
      setPendingCrop({ source: imageUrl, file });
    } catch (error) {
      console.error('Failed to prepare image:', error);
      setErrorMessage(getImagePreparationErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const saveCroppedImage = (dataUrl: string) => {
    if (!pendingCrop) return;
    const file = pendingCrop.file;
    URL.revokeObjectURL(pendingCrop.source);
    setPendingCrop(null);
    onImageSelect(dataUrl, file);
  };

  const useOriginalImage = () => {
    if (!pendingCrop) return;
    const { source, file } = pendingCrop;
    setPendingCrop(null);
    onImageSelect(source, file);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files && files.length > 0) {
      // بعض موفري ملفات Android يلغون صلاحية القراءة عندما يُمسح الحقل فوراً.
      // ننتظر اكتمال تجهيز الصورة بكل مساراته قبل السماح باختيار الملف نفسه ثانية.
      await prepareSelectedFile(e.currentTarget, () => handleFileSelect(files[0]));
      return;
    }
    // يسمح بإعادة اختيار الملف نفسه بعد تصحيح مشكلة أو تغيير أذونات الصور.
    e.currentTarget.value = '';
  };

  return (
    <div className="space-y-4">
      {/* Image Preview */}
      {currentImage ? (
        <div className="relative">
          <div className="w-full overflow-hidden rounded-[28px] border border-[#e8e4ee] bg-[#fbfaff] shadow-sm">
            <img
              src={currentImage}
              alt="معاينة صورة الملابس المختارة"
              className="h-auto max-h-96 w-full object-cover"
            />
          </div>

          {/* Remove Button */}
          {onImageRemove && (
            <button
              type="button"
              onClick={onImageRemove}
              className="absolute left-3 top-3 rounded-xl bg-primary p-2 text-primary-foreground shadow-sm transition active:scale-95"
              aria-label="حذف صورة الملابس"
            >
              <X size={20} />
            </button>
          )}

          {/* Change Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-3 left-3 flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-black text-primary-foreground shadow-sm transition active:scale-95"
          >
            <Upload size={18} />
            تغيير الصورة
          </button>
        </div>
      ) : (
        /* Upload Area */
        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={`rounded-[28px] border-2 border-dashed p-7 text-center transition-colors ${
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-[#ddd7e8] bg-[#fcfbff] hover:border-primary/40'
          }`}
        >
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-lg shadow-primary/20"><ImageUp size={29} /></div>

          <h3 className="mb-2 text-lg font-black text-foreground">اختر صورة الملابس</h3>
          <p className="mb-3 text-sm leading-6 text-muted-foreground">من المعرض أو بالكاميرا. الأفضل أن تظهر القطعة وحدها بوضوح.</p>

          <div className="mb-4 flex flex-wrap justify-center gap-2 text-[11px] font-bold text-muted-foreground"><span className="rounded-full bg-white px-2.5 py-1 shadow-sm">قطعة واحدة واضحة</span><span className="rounded-full bg-white px-2.5 py-1 shadow-sm">حتى 25 ميجابايت</span><span className="rounded-full bg-white px-2.5 py-1 shadow-sm">يُحسَّن تلقائياً</span></div>

          {isLoading && <div role="status" aria-live="polite" className="mb-4 flex items-center justify-center gap-2 rounded-2xl border border-primary/10 bg-primary/5 px-3 py-3 text-sm font-black text-primary"><LoaderCircle className="animate-spin" size={18} />جارٍ قراءة الصورة وتحسينها للهاتف…</div>}
          {errorMessage && <div role="alert" className="mb-4 rounded-2xl border border-red-100 bg-red-50 px-3 py-3 text-sm font-medium leading-6 text-red-800"><div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 shrink-0" size={17} /><p>{errorMessage}</p></div><button type="button" onClick={() => void startCamera()} className="mt-2 inline-flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-xs font-black text-red-800 shadow-sm" disabled={isLoading || isCameraStarting}><Camera size={14} />جرّب التقاط صورة الآن</button></div>}

          <div className="mx-auto grid max-w-xs grid-cols-2 gap-3">
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="reference-primary min-h-14 w-full"
            >
              <ImageUp size={17} /> {isLoading ? 'جارٍ التحميل…' : 'من المعرض'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void startCamera()}
              disabled={isLoading || isCameraStarting}
              className="reference-outline min-h-14 w-full"
            >
              <Camera size={17} /> {isCameraStarting ? 'جارٍ فتح الكاميرا…' : 'بالكاميرا'}
            </Button>
          </div>
        </div>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.heic,.heif,.avif,.gif,.bmp"
        onChange={handleFileInputChange}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*,.heic,.heif,.avif,.gif,.bmp"
        capture="environment"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {cameraStream && (
        <section role="dialog" aria-label="التقاط صورة الملابس بالكاميرا" className="space-y-3 rounded-[28px] border border-primary/10 bg-primary/5 p-3">
          <video ref={cameraVideoRef} autoPlay muted playsInline className="max-h-96 w-full rounded-2xl bg-primary/5 object-contain" />
          <p className="text-center text-sm font-bold text-muted-foreground">ضع قطعة الملابس داخل الإطار ثم التقط الصورة.</p>
          <div className="grid grid-cols-2 gap-3">
            <Button type="button" onClick={captureCameraPhoto} className="reference-primary min-h-12 w-full"><Camera size={17} />التقط الصورة</Button>
            <Button type="button" variant="outline" onClick={stopCamera} className="reference-outline min-h-12 w-full">إلغاء</Button>
          </div>
        </section>
      )}

      {/* Image Info */}
      {currentImage && (
        <div className="reference-local-note">
          <BadgeCheck size={18} />
          <p>تم تجهيز الصورة محلياً. راجعها ثم اختر المتابعة عندما تكون جاهزة.</p>
        </div>
      )}

      {pendingCrop && <GarmentCropEditor source={pendingCrop.source} onSave={saveCroppedImage} onUseOriginal={useOriginalImage} />}
    </div>
  );
}

export async function prepareImageFile(file: File): Promise<string> {
  const sourceUrl = URL.createObjectURL(file);
  try {
    return await readImageWithFallback(
      () => optimizeLoadedImageFromUrl(sourceUrl, file.type),
      () => optimizeFileWithImageBitmap(file, file.type),
      async () => optimizeLoadedImageFromUrl(await readFileAsDataUrl(file), file.type),
    );
  } catch (error) {
    // لا نتابع إلى الإعلان بمصدر لا يمكن للـ Canvas رسمه، كي لا تظهر رسالة فشل متأخرة ومربكة.
    throw error;
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

async function optimizeLoadedImageFromUrl(sourceUrl: string, mimeType: string) {
  return optimizeLoadedImage(await loadFileImage(sourceUrl), mimeType);
}

async function optimizeFileWithImageBitmap(file: File, mimeType: string): Promise<string> {
  if (typeof createImageBitmap !== 'function') throw new Error('ImageBitmap is unavailable');
  const bitmap = await createImageBitmap(file);
  try {
    return await optimizeLoadedImage(bitmap, mimeType);
  } finally {
    bitmap.close();
  }
}

async function optimizeLoadedImage(image: CanvasImageSource & { width: number; height: number; naturalWidth?: number; naturalHeight?: number }, mimeType: string): Promise<string> {
  const maxSide = 1600;
  const ratio = Math.min(1, maxSide / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
  const width = Math.max(1, Math.round((image.naturalWidth || image.width) * ratio));
  const height = Math.max(1, Math.round((image.naturalHeight || image.height) * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is unavailable');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, width, height);
  const outputType = mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
  const blob = await canvasToBlob(canvas, outputType, 0.88);
  return URL.createObjectURL(blob);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('FILE_READ_UNAVAILABLE'));
    reader.onabort = () => reject(new Error('FILE_READ_UNAVAILABLE'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

export function isSupportedImage(file: File) {
  if (file.size < 1) return false;
  if (file.type.startsWith('image/') || file.type === '' || file.type === 'application/octet-stream') {
    return !/\.(pdf|docx?|xlsx?|pptx?|zip|rar|7z|mp4|mov|avi|mkv|mp3|wav)$/i.test(file.name);
  }
  return /\.(jpe?g|png|webp|heic|heif|avif|gif|bmp|jfif)$/i.test(file.name);
}

function loadFileImage(sourceUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timeout = window.setTimeout(() => reject(new Error('Image preparation timed out')), 10_000);
    image.onload = () => {
      window.clearTimeout(timeout);
      resolve(image);
    };
    image.onerror = () => {
      window.clearTimeout(timeout);
      reject(new Error('Image file could not be loaded'));
    };
    image.decoding = 'async';
    image.src = sourceUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('Could not optimize image'));
    }, type, quality);
  });
}
