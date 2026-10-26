import { useEffect, useRef, useState } from 'react';
import type { AdDetails, TemplateSettings } from '@shared/types';
import { DEFAULT_PRODUCT_ANIMATION_SETTINGS, type ProductAnimationPivot } from '@shared/animationTypes';
import { generateAnimatedAdGif, type AnimatedExportProgress } from '@/lib/animatedAdRenderer';
import { Download, LoaderCircle, Play, RotateCcw, X } from 'lucide-react';
import { toast } from 'sonner';

type Props = {
  details: AdDetails;
  template: TemplateSettings;
  productImage: string;
  onClose: () => void;
};

export default function AnimatedAdPanel({ details, template, productImage, onClose }: Props) {
  const [pivot, setPivot] = useState<ProductAnimationPivot>(DEFAULT_PRODUCT_ANIMATION_SETTINGS.pivot);
  const [previewUrl, setPreviewUrl] = useState('');
  const [progress, setProgress] = useState<AnimatedExportProgress | null>(null);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => {
    abortRef.current?.abort();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const generate = async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setError('');
    setProgress({ frame: 0, total: 12, percent: 0 });
    try {
      const blob = await generateAnimatedAdGif(details, template, productImage, { pivot, type: 'swing', intensity: 'light', frameCount: 12, frameDurationMs: 90, outputWidth: 720, loop: true }, { signal: controller.signal, onProgress: setProgress });
      const nextUrl = URL.createObjectURL(blob);
      setPreviewUrl(previous => {
        if (previous) URL.revokeObjectURL(previous);
        return nextUrl;
      });
      toast.success('تم تجهيز الإعلان المتحرك محليًا.');
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      setError(cause instanceof Error ? cause.message : 'تعذر تجهيز الإعلان المتحرك');
      toast.error('تعذر تجهيز الإعلان المتحرك. بقي الإعلان الثابت محفوظًا.');
    } finally {
      setProgress(null);
    }
  };

  const download = () => {
    if (!previewUrl) return;
    const anchor = document.createElement('a');
    anchor.href = previewUrl;
    anchor.download = `إعلان-${details.productName.trim() || 'ملابس'}-متحرك.gif`;
    anchor.click();
  };

  return <section className="rounded-2xl border border-primary/15 bg-white p-3 shadow-xl" dir="rtl" aria-label="الإعلان المتحرك">
    <div className="flex items-center justify-between gap-2"><div><h3 className="text-sm font-black text-primary">إعلان متحرك</h3><p className="mt-1 text-[11px] leading-5 text-muted-foreground">تأرجح خفيف للقطعة فوق نفس القالب، دون إنترنت.</p></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-muted-foreground" aria-label="إغلاق الإعلان المتحرك"><X size={17} /></button></div>
    <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" disabled={Boolean(progress)} onClick={() => setPivot('top-center')} className={`rounded-xl border px-2 py-2 text-xs font-black ${pivot === 'top-center' ? 'border-primary bg-primary text-primary-foreground' : 'border-primary/10 bg-secondary text-primary'}`}>ارتكاز علوي</button><button type="button" disabled={Boolean(progress)} onClick={() => setPivot('center')} className={`rounded-xl border px-2 py-2 text-xs font-black ${pivot === 'center' ? 'border-primary bg-primary text-primary-foreground' : 'border-primary/10 bg-secondary text-primary'}`}>ارتكاز مركزي</button></div>
    <div className="mt-3 overflow-hidden rounded-xl border border-stone-100 bg-stone-50 p-2">{previewUrl ? <img src={previewUrl} alt="معاينة الإعلان المتحرك" className="max-h-64 w-full object-contain" /> : <div className="flex min-h-32 items-center justify-center text-center text-xs leading-5 text-muted-foreground">سيبقى السعر والنص والخلفية ثابتة، وتتحرك طبقة الملابس فقط.</div>}</div>
    {progress && <div className="mt-3"><div className="flex items-center justify-between text-[11px] font-bold text-primary"><span><LoaderCircle className="ml-1 inline animate-spin" size={13} />جارٍ تجهيز الإطارات</span><span>{progress.percent}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress.percent}%` }} /></div><button type="button" onClick={() => abortRef.current?.abort()} className="mt-2 w-full rounded-xl border border-red-200 bg-red-50 py-2 text-xs font-black text-red-700">إلغاء التصدير</button></div>}
    {error && <p className="mt-2 rounded-xl bg-red-50 p-2 text-[11px] font-bold leading-5 text-red-800" role="alert">{error}</p>}
    <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" disabled={Boolean(progress)} onClick={() => void generate()} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl bg-primary px-2 text-xs font-black text-primary-foreground disabled:opacity-50">{previewUrl ? <RotateCcw size={15} /> : <Play size={15} />} {previewUrl ? 'إعادة التوليد' : 'تجهيز GIF'}</button><button type="button" disabled={!previewUrl || Boolean(progress)} onClick={download} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-primary/20 bg-white px-2 text-xs font-black text-primary disabled:opacity-50"><Download size={15} />تنزيل GIF</button></div>
  </section>;
}
