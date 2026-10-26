import { useEffect, useRef, useState } from 'react';
import type { AdDetails, TemplateSettings } from '@shared/types';
import { DEFAULT_PRODUCT_VIDEO_SETTINGS, PRODUCT_VIDEO_DIMENSIONS, type ProductVideoPreset, type ProductVideoSettings, type ProductVideoStyle } from '@shared/productVideoTypes';
import { drawProductVideoFrame, exportProductPromoVideo } from '@/lib/productVideoExport';

type Props = {
  details: AdDetails;
  template: TemplateSettings;
  productImage: string;
  finalAd: string;
  onClose: () => void;
  onDetailsChange: (patch: Partial<AdDetails>) => void;
  onTemplateChange: (patch: Partial<TemplateSettings>) => void;
};

const inputClass = 'w-full rounded-xl border border-primary/15 bg-white px-3 py-2 text-xs font-bold text-primary outline-none focus:border-primary';

export default function ProductVideoPanel({ details, template, productImage, finalAd, onClose, onDetailsChange, onTemplateChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [settings, setSettings] = useState<ProductVideoSettings>(DEFAULT_PRODUCT_VIDEO_SETTINGS);
  const [playing, setPlaying] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const rafRef = useRef<number | undefined>(undefined);
  const startedRef = useRef(performance.now());

  const patchSettings = (patch: Partial<ProductVideoSettings>) => setSettings(current => ({ ...current, ...patch }));

  useEffect(() => {
    let cancelled = false;
    const product = new Image();
    const ad = new Image();
    product.src = productImage;
    ad.src = finalAd;
    const draw = (now: number) => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (canvas && product.complete && ad.complete) {
        const dimensions = PRODUCT_VIDEO_DIMENSIONS[settings.preset];
        const scale = .5;
        canvas.width = Math.round(dimensions.width * scale);
        canvas.height = Math.round(dimensions.height * scale);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const elapsed = playing ? (now - startedRef.current) / 1000 : ((startedRef.current ? (now - startedRef.current) / 1000 : 0));
          const time = ((elapsed % settings.durationSeconds) + settings.durationSeconds) % settings.durationSeconds;
          drawProductVideoFrame(ctx, canvas.width, canvas.height, time, settings, details, template, product, ad);
        }
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    product.onload = () => { ad.onload = () => { startedRef.current = performance.now(); rafRef.current = requestAnimationFrame(draw); }; };
    return () => { cancelled = true; if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [details, finalAd, playing, productImage, settings, template]);

  const togglePlaying = () => {
    if (!playing) startedRef.current = performance.now();
    setPlaying(current => !current);
  };

  const handleExport = async () => {
    setExporting(true);
    setProgress(0);
    setMessage('جارٍ تجهيز الفيديو محليًا…');
    setDownloadUrl('');
    try {
      const blob = await exportProductPromoVideo(details, template, productImage, finalAd, settings, { onProgress: value => setProgress(value.percent) });
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setMessage(`تم إنشاء الفيديو بصيغة ${blob.type.includes('webm') ? 'WebM' : 'MP4'} بنجاح.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر إنشاء الفيديو.');
    } finally {
      setExporting(false);
    }
  };

  const presets: Array<{ id: ProductVideoPreset; label: string }> = [
    { id: 'whatsapp', label: 'واتساب 3:4' }, { id: 'story', label: 'ستوري 9:16' }, { id: 'square', label: 'مربع' }, { id: 'portrait', label: 'منشور 4:5' },
  ];
  const styles: Array<{ id: ProductVideoStyle; label: string }> = [
    { id: 'studio', label: 'استوديو' }, { id: 'before-after', label: 'قبل/بعد' }, { id: 'store-fast', label: 'متجر سريع' },
  ];

  return <section className="absolute inset-x-3 bottom-24 z-30 max-h-[78vh] overflow-y-auto rounded-3xl border border-primary/15 bg-white p-3 shadow-2xl" data-wardrobe-tool-panel aria-label="فيديو ترويجي للمنتج" dir="rtl">
    <div className="flex items-center justify-between gap-2"><div><h3 className="text-base font-black text-primary">فيديو ترويجي للمنتج</h3><p className="mt-1 text-[10px] font-bold text-muted-foreground">معاينة وتصدير محلي للويب، دون رفع الصورة.</p></div><button type="button" onClick={onClose} className="rounded-xl px-3 py-2 text-lg font-black text-muted-foreground">×</button></div>
    <div className="mt-3 overflow-hidden rounded-2xl border border-primary/10 bg-black shadow-inner"><canvas ref={canvasRef} className="mx-auto block max-h-[36vh] w-full object-contain" aria-label="معاينة الفيديو" /></div>
    <div className="mt-2 flex items-center gap-2"><button type="button" onClick={togglePlaying} className="rounded-xl bg-primary px-3 py-2 text-xs font-black text-primary-foreground">{playing ? 'إيقاف' : 'تشغيل'}</button><span className="text-[11px] font-bold text-muted-foreground">الموسيقى متوقفة حاليًا؛ ستضاف كمسارات محلية اختيارية.</span></div>

    <details open className="mt-3 rounded-2xl bg-secondary/50 p-3"><summary className="cursor-pointer text-xs font-black text-primary">المقاس والمدة والأسلوب</summary><div className="mt-3 grid grid-cols-2 gap-2">{presets.map(item => <button key={item.id} type="button" onClick={() => patchSettings({ preset: item.id })} className={`rounded-xl border px-2 py-2 text-[11px] font-black ${settings.preset === item.id ? 'border-primary bg-primary text-primary-foreground' : 'border-primary/10 bg-white text-primary'}`}>{item.label}</button>)}</div><div className="mt-2 grid grid-cols-3 gap-2">{styles.map(item => <button key={item.id} type="button" onClick={() => patchSettings({ style: item.id })} className={`rounded-xl border px-2 py-2 text-[11px] font-black ${settings.style === item.id ? 'border-primary bg-primary text-primary-foreground' : 'border-primary/10 bg-white text-primary'}`}>{item.label}</button>)}</div><label className="mt-3 block text-[11px] font-black text-primary">مدة الفيديو<select value={settings.durationSeconds} onChange={event => patchSettings({ durationSeconds: Number(event.target.value) as ProductVideoSettings['durationSeconds'] })} className={`${inputClass} mt-1`}><option value={6}>6 ثوانٍ</option><option value={9}>9 ثوانٍ</option><option value={12}>12 ثانية</option><option value={15}>15 ثانية</option></select></label><label className="mt-2 block text-[11px] font-black text-primary">جودة التصدير<select value={settings.quality} onChange={event => patchSettings({ quality: event.target.value as ProductVideoSettings['quality'] })} className={`${inputClass} mt-1`}><option value="light">خفيفة</option><option value="balanced">متوازنة</option><option value="high">عالية</option></select></label></details>

    <details className="mt-2 rounded-2xl bg-secondary/50 p-3"><summary className="cursor-pointer text-xs font-black text-primary">بيانات المنتج والمتجر (اختيارية)</summary><div className="mt-3 grid grid-cols-2 gap-2"><input className={inputClass} value={details.productName} onChange={event => onDetailsChange({ productName: event.target.value })} placeholder="اسم القطعة" /><input className={inputClass} value={details.storeName} onChange={event => onDetailsChange({ storeName: event.target.value })} placeholder="اسم المركز" /><input className={inputClass} value={details.price} onChange={event => onDetailsChange({ price: event.target.value })} placeholder="السعر" inputMode="decimal" /><input className={inputClass} value={details.discount} onChange={event => onDetailsChange({ discount: event.target.value })} placeholder="نسبة الخصم %" inputMode="decimal" /><input className={inputClass} value={details.quantity} onChange={event => onDetailsChange({ quantity: event.target.value })} placeholder="الكمية" /><input className={inputClass} value={details.currency} onChange={event => onDetailsChange({ currency: event.target.value })} placeholder="العملة" /></div><textarea className={`${inputClass} mt-2 min-h-16`} value={details.marketingText} onChange={event => onDetailsChange({ marketingText: event.target.value })} placeholder="عبارة ترويجية اختيارية" /></details>

    <details className="mt-2 rounded-2xl bg-secondary/50 p-3"><summary className="cursor-pointer text-xs font-black text-primary">الخلفية واللون</summary><div className="mt-3 grid grid-cols-2 gap-2"><label className="text-[11px] font-black text-primary">لون الخلفية<input type="color" value={template.smartBackgroundColor || '#faf8ff'} onChange={event => onTemplateChange({ smartBackgroundColor: event.target.value })} className="mt-1 h-10 w-full rounded-xl border border-primary/10 bg-white p-1" /></label><label className="text-[11px] font-black text-primary">لون النص<input type="color" value={template.smartTextColor || '#24154f'} onChange={event => onTemplateChange({ smartTextColor: event.target.value })} className="mt-1 h-10 w-full rounded-xl border border-primary/10 bg-white p-1" /></label></div></details>

    {message && <p className="mt-3 rounded-xl bg-primary/5 p-2 text-center text-[11px] font-black text-primary">{message}{exporting && ` ${progress}%`}</p>}
    <div className="mt-3 flex gap-2"><button type="button" disabled={exporting} onClick={() => void handleExport()} className="min-h-11 flex-1 rounded-xl bg-primary px-3 text-xs font-black text-primary-foreground disabled:opacity-50">{exporting ? `جاري التصدير ${progress}%` : 'تصدير الفيديو'}</button>{downloadUrl && <a href={downloadUrl} download={`${details.productName.trim() || 'فيديو-منتج'}.webm`} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-primary/20 bg-white px-3 text-xs font-black text-primary">تنزيل</a>}</div>
  </section>;
}
