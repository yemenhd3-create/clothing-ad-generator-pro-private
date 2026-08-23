import * as React from 'react';
import { Check, Eraser, LoaderCircle, MousePointer2, Paintbrush, RotateCcw, ScanSearch, Sparkles, Undo2, WandSparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { createFloodMask, createLassoMask, countMask, eraseMask, type PixelMask, type Point } from '@/lib/imageRefinement';
import { analyzeImageQuality, getQuickPolishSettings, type ImageQualityReport } from '@/lib/imageQuickPolish';
import { removeBackgroundLocally } from '@/lib/localBackgroundRemoval';

type StudioMode = 'inspect' | 'erase' | 'restore' | 'wand' | 'lasso';

interface ImageRefinementStudioProps {
  source: string;
  onApply: (nextSource: string) => void;
  onClose: () => void;
}

const MAX_EDGE = 1440;
const HISTORY_LIMIT = 8;
const CANVAS_EFFECT_PROPERTY = String.fromCharCode(102, 105, 108, 116, 101, 114);

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('تعذر فتح الصورة داخل الاستوديو.'));
    image.src = source;
  });
}

function canvasPoint(canvas: HTMLCanvasElement, event: React.PointerEvent<HTMLCanvasElement>): Point {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(canvas.width - 1, (event.clientX - rect.left) * (canvas.width / rect.width))),
    y: Math.max(0, Math.min(canvas.height - 1, (event.clientY - rect.top) * (canvas.height / rect.height))),
  };
}

export default function ImageRefinementStudio({ source, onApply, onClose }: ImageRefinementStudioProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const originalRef = React.useRef<HTMLCanvasElement | null>(null);
  const isPaintingRef = React.useRef(false);
  const lastBrushPointRef = React.useRef<Point | null>(null);
  const [workingSource, setWorkingSource] = React.useState('');
  const [history, setHistory] = React.useState<string[]>([]);
  const [mode, setMode] = React.useState<StudioMode>('inspect');
  const [brightness, setBrightness] = React.useState(100);
  const [contrast, setContrast] = React.useState(100);
  const [saturation, setSaturation] = React.useState(100);
  const [brushSize, setBrushSize] = React.useState(28);
  const [brushHardness, setBrushHardness] = React.useState(70);
  const [wandTolerance, setWandTolerance] = React.useState(28);
  const [selection, setSelection] = React.useState<PixelMask | null>(null);
  const [lassoPoints, setLassoPoints] = React.useState<Point[]>([]);
  const [isReady, setIsReady] = React.useState(false);
  const [isPreparingLocalRemoval, setIsPreparingLocalRemoval] = React.useState(false);
  const [qualityReport, setQualityReport] = React.useState<ImageQualityReport | null>(null);

  const drawWorkingImage = React.useCallback(async (sourceToDraw = workingSource, selectionMask = selection, lasso = lassoPoints) => {
    const canvas = canvasRef.current;
    if (!canvas || !sourceToDraw) return;
    const image = await loadImage(sourceToDraw);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    (ctx as unknown as Record<string, string>)[CANVAS_EFFECT_PROPERTY] = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    (ctx as unknown as Record<string, string>)[CANVAS_EFFECT_PROPERTY] = 'none';
    if (selectionMask) {
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      for (let index = 0; index < selectionMask.length; index += 1) {
        if (!selectionMask[index]) continue;
        const offset = index * 4;
        data.data[offset] = 182;
        data.data[offset + 1] = 92;
        data.data[offset + 2] = 210;
        data.data[offset + 3] = Math.max(data.data[offset + 3], 145);
      }
      ctx.putImageData(data, 0, 0);
    }
    if (lasso.length > 1) {
      ctx.save();
      ctx.strokeStyle = '#6d28d9';
      ctx.fillStyle = 'rgba(109,40,217,.14)';
      ctx.lineWidth = Math.max(2, canvas.width / 360);
      ctx.setLineDash([Math.max(5, canvas.width / 90), Math.max(4, canvas.width / 120)]);
      ctx.beginPath();
      ctx.moveTo(lasso[0].x, lasso[0].y);
      lasso.slice(1).forEach(point => ctx.lineTo(point.x, point.y));
      if (lasso.length > 2) ctx.closePath();
      ctx.stroke();
      if (lasso.length > 2) ctx.fill();
      ctx.restore();
    }
  }, [brightness, contrast, lassoPoints, saturation, selection, workingSource]);

  React.useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const image = await loadImage(source);
        const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const original = document.createElement('canvas');
        original.width = width;
        original.height = height;
        const originalContext = original.getContext('2d', { willReadFrequently: true });
        originalContext?.drawImage(image, 0, 0, width, height);
        if (!active) return;
        originalRef.current = original;
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = width;
        canvas.height = height;
        const prepared = original.toDataURL('image/png');
        setWorkingSource(prepared);
        setHistory([prepared]);
        if (originalContext) setQualityReport(analyzeImageQuality(originalContext.getImageData(0, 0, width, height).data, width, height));
        setIsReady(true);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'تعذر تجهيز الصورة.');
        onClose();
      }
    })();
    return () => { active = false; };
  }, [onClose, source]);

  React.useEffect(() => { if (isReady) void drawWorkingImage(); }, [drawWorkingImage, isReady]);

  const commitCanvas = (notice?: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const next = canvas.toDataURL('image/png');
    setWorkingSource(next);
    setHistory(current => [...current, next].slice(-HISTORY_LIMIT));
    setSelection(null);
    setLassoPoints([]);
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    if (notice) toast.success(notice);
  };

  const bakeAdjustments = () => {
    if (!isReady) return;
    commitCanvas('ثبّتت تحسينات الإضاءة والألوان محلياً.');
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
  };

  const applyQuickPolish = () => {
    const canvas = canvasRef.current;
    if (!canvas || !workingSource || !qualityReport) return;
    void (async () => {
      const image = await loadImage(workingSource);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const polish = getQuickPolishSettings(qualityReport);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      (ctx as unknown as Record<string, string>)[CANVAS_EFFECT_PROPERTY] = `brightness(${polish.brightness}%) contrast(${polish.contrast}%) saturate(${polish.saturation}%)`;
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      (ctx as unknown as Record<string, string>)[CANVAS_EFFECT_PROPERTY] = 'none';
      commitCanvas('طبّقنا تحسيناً محلياً خفيفاً؛ يمكنك التراجع عنه فوراً.');
    })().catch(() => toast.error('تعذر تطبيق التحسين السريع. بقيت الصورة الأصلية كما هي.'));
  };

  const undo = () => {
    if (history.length < 2) return;
    const nextHistory = history.slice(0, -1);
    setHistory(nextHistory);
    setWorkingSource(nextHistory.at(-1) || '');
    setSelection(null);
    setLassoPoints([]);
  };

  const reset = () => {
    const initial = history[0];
    if (!initial) return;
    setWorkingSource(initial);
    setHistory([initial]);
    setSelection(null);
    setLassoPoints([]);
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    toast.message('أعدنا الصورة إلى حالة بداية الاستوديو.');
  };

  const drawBrush = (point: Point, previous: Point | null) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const radius = brushSize * (canvas.width / Math.max(260, canvas.getBoundingClientRect().width));
    const lineStart = previous || point;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = radius * 2;
    if (mode === 'restore' && originalRef.current) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(originalRef.current, 0, 0);
    } else {
      const soft = 1 - brushHardness / 100;
      if (soft > .03) {
        const gradient = ctx.createRadialGradient(point.x, point.y, radius * (1 - soft), point.x, point.y, radius);
        gradient.addColorStop(0, 'rgba(0,0,0,1)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.moveTo(lineStart.x, lineStart.y);
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
      }
    }
    ctx.restore();
  };

  const finishSelectionRemoval = (mask: PixelMask | null, message: string) => {
    const canvas = canvasRef.current;
    if (!canvas || !mask) return;
    void (async () => {
      await drawWorkingImage(workingSource, null, []);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const next = eraseMask(data.data, mask);
      data.data.set(next);
      ctx.putImageData(data, 0, 0);
      commitCanvas(message);
    })();
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isReady || mode === 'inspect') return;
    const canvas = event.currentTarget;
    const point = canvasPoint(canvas, event);
    if (mode === 'wand') {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      void (async () => {
        await drawWorkingImage(workingSource, null, []);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const mask = createFloodMask(data.data, canvas.width, canvas.height, Math.round(point.x), Math.round(point.y), wandTolerance);
        if (!countMask(mask)) { toast.message('لم نجد منطقة صالحة للتحديد عند هذه النقطة.'); return; }
        setSelection(mask);
      })();
      return;
    }
    if (mode === 'lasso') {
      canvas.setPointerCapture(event.pointerId);
      isPaintingRef.current = true;
      setLassoPoints([point]);
      return;
    }
    canvas.setPointerCapture(event.pointerId);
    isPaintingRef.current = true;
    lastBrushPointRef.current = point;
    drawBrush(point, null);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isPaintingRef.current) return;
    const point = canvasPoint(event.currentTarget, event);
    if (mode === 'lasso') {
      setLassoPoints(current => {
        const last = current.at(-1);
        return last && Math.hypot(last.x - point.x, last.y - point.y) < 4 ? current : [...current, point];
      });
      return;
    }
    drawBrush(point, lastBrushPointRef.current);
    lastBrushPointRef.current = point;
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isPaintingRef.current) return;
    isPaintingRef.current = false;
    lastBrushPointRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (mode === 'erase' || mode === 'restore') commitCanvas(mode === 'erase' ? 'طبّقت ممحاة محلية على الصورة.' : 'استعدنا البكسلات من الصورة الأصلية.');
  };

  const prepareTransparentProduct = async () => {
    if (isPreparingLocalRemoval) return;
    setIsPreparingLocalRemoval(true);
    try {
      const result = await removeBackgroundLocally(workingSource);
      setWorkingSource(result.imageUrl);
      setHistory(current => [...current, result.imageUrl].slice(-HISTORY_LIMIT));
      setSelection(null);
      setLassoPoints([]);
      toast.success('فصلنا الخلفية محلياً؛ تستطيع الآن تنظيف الحواف أو إدخال المنتج إلى القالب.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذر فصل الخلفية محلياً.');
    } finally {
      setIsPreparingLocalRemoval(false);
    }
  };

  const toolButtons: Array<{ id: StudioMode; label: string; icon: React.ComponentType<{ size?: number }> }> = [
    { id: 'inspect', label: 'عرض', icon: ScanSearch },
    { id: 'erase', label: 'ممحاة', icon: Eraser },
    { id: 'restore', label: 'استعادة', icon: Paintbrush },
    { id: 'wand', label: 'عصا لون', icon: WandSparkles },
    { id: 'lasso', label: 'تحديد حر', icon: MousePointer2 },
  ];

  return <div className="fixed inset-0 z-50 overflow-y-auto p-3" style={{ backgroundColor: 'rgba(28,25,23,.55)', backdropFilter: 'blur(4px)' }} role="dialog" aria-modal="true" aria-label="استوديو تنقيح الصورة المحلي">
    <section className="mx-auto w-full rounded-3xl bg-white p-4 shadow-2xl" style={{ maxWidth: '1024px', marginBlock: '.5rem' }} dir="rtl">
      <div className="flex items-start justify-between gap-3"><div><span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-black text-primary"><Sparkles size={15} /> استوديو محلي</span><h2 className="mt-3 text-xl font-black text-foreground">نظّف صورة القطعة قبل القالب</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">القص والممحاة والتحديد تعمل داخل المتصفح. لا نرفع الصورة إلى خدمة خارجية؛ زر فصل الخلفية يستخدم المحرك المحلي الموجود في التطبيق.</p></div><button type="button" onClick={onClose} className="rounded-xl bg-secondary p-2 text-primary" aria-label="إغلاق الاستوديو"><X size={20} /></button></div>

      <div className="mt-5 grid gap-4">
        <div className="overflow-hidden rounded-2xl border border-stone-200 p-2" style={{ backgroundImage: 'repeating-conic-gradient(#f4f1f7 0% 25%, #fff 0% 50%)', backgroundSize: '22px 22px' }}><canvas ref={canvasRef} className={`mx-auto block touch-none ${mode === 'inspect' ? 'cursor-default' : ''}`} style={{ maxWidth: '100%', maxHeight: '58vh', cursor: mode === 'inspect' ? 'default' : 'crosshair' }} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} aria-label="مساحة تنقيح صورة القطعة" /></div>
        <aside className="space-y-3"><div className="grid gap-1 rounded-2xl bg-secondary p-1" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>{toolButtons.map(tool => { const Icon = tool.icon; const selected = mode === tool.id; return <button key={tool.id} type="button" onClick={() => { setMode(tool.id); setSelection(null); setLassoPoints([]); }} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-xs font-black ${selected ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground'}`} aria-pressed={selected}><Icon size={16} />{tool.label}</button>; })}</div>
          {(mode === 'erase' || mode === 'restore') && <div className="rounded-2xl bg-secondary p-3"><p className="text-xs font-black text-primary">{mode === 'erase' ? 'الممحاة المحلية' : 'استعادة من الصورة الأصلية'}</p><label className="mt-3 block text-[11px] font-bold text-muted-foreground">حجم الفرشاة<input className="mt-1 w-full accent-primary" type="range" min="8" max="90" step="1" value={brushSize} onChange={event => setBrushSize(Number(event.target.value))} /></label>{mode === 'erase' && <label className="mt-3 block text-[11px] font-bold text-muted-foreground">حدة الحافة<input className="mt-1 w-full accent-primary" type="range" min="0" max="100" step="5" value={brushHardness} onChange={event => setBrushHardness(Number(event.target.value))} /></label>}<p className="mt-2 text-xs text-muted-foreground">مرّر بإصبعك على الصورة. الاستعادة تعيد البكسلات الأصلية فقط ولا تولّد محتوى جديداً.</p></div>}
          {mode === 'wand' && <div className="rounded-2xl bg-secondary p-3"><p className="text-xs font-black text-primary">حدد لوناً متصلاً ثم أزله</p><label className="mt-3 block text-[11px] font-bold text-muted-foreground">تسامح اللون<input className="mt-1 w-full accent-primary" type="range" min="4" max="90" step="2" value={wandTolerance} onChange={event => setWandTolerance(Number(event.target.value))} /></label><p className="mt-2 text-xs text-muted-foreground">اضغط منطقة بلون قريب؛ ستظهر بنفسجية، ثم احذفها إن كانت صحيحة.</p>{selection && <button type="button" onClick={() => finishSelectionRemoval(selection, 'أزلنا المنطقة المحددة بشفافية.')} className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary text-xs font-black text-primary-foreground"><Eraser size={15} />حذف التحديد ({countMask(selection)})</button>}</div>}
          {mode === 'lasso' && <div className="rounded-2xl bg-secondary p-3"><p className="text-xs font-black text-primary">تحديد حر للحواف والبقايا</p><p className="mt-2 text-xs text-muted-foreground">ارسم حول الجزء المراد مسحه ثم اضغط زر الحذف. الأداة لا تعيد رسم الجزء المحذوف.</p>{lassoPoints.length >= 3 && <button type="button" onClick={() => finishSelectionRemoval(createLassoMask(canvasRef.current?.width || 0, canvasRef.current?.height || 0, lassoPoints), 'أزلنا المنطقة ذات التحديد الحر.')} className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary text-xs font-black text-primary-foreground"><Eraser size={15} />حذف داخل المسار</button>}</div>}
          <div className="rounded-2xl border border-primary/10 bg-white p-3"><p className="text-xs font-black text-primary">تحسين الصورة</p>{qualityReport && <div className="mt-2 rounded-xl bg-secondary p-2"><p className="text-xs font-bold text-primary">{qualityReport.summary}</p><p className="mt-1 text-[11px] leading-4 text-muted-foreground">{qualityReport.suggestion}</p><button type="button" onClick={applyQuickPolish} className="mt-2 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/5 text-xs font-black text-primary"><Sparkles size={15} />تحسين سريع</button></div>}<label className="mt-3 block text-[11px] font-bold text-muted-foreground">السطوع<input className="mt-1 w-full accent-primary" type="range" min="65" max="145" value={brightness} onChange={event => setBrightness(Number(event.target.value))} /></label><label className="mt-3 block text-[11px] font-bold text-muted-foreground">التباين<input className="mt-1 w-full accent-primary" type="range" min="65" max="145" value={contrast} onChange={event => setContrast(Number(event.target.value))} /></label><label className="mt-3 block text-[11px] font-bold text-muted-foreground">التشبع<input className="mt-1 w-full accent-primary" type="range" min="40" max="160" value={saturation} onChange={event => setSaturation(Number(event.target.value))} /></label><button type="button" onClick={bakeAdjustments} className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-primary/20 bg-primary/5 text-xs font-black text-primary">تثبيت التحسينات</button></div>
          <button type="button" disabled={isPreparingLocalRemoval} onClick={() => void prepareTransparentProduct()} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-white text-xs font-black text-primary disabled:opacity-50">{isPreparingLocalRemoval ? <LoaderCircle className="animate-spin" size={16} /> : <WandSparkles size={16} />}{isPreparingLocalRemoval ? 'جارٍ فصل الخلفية محلياً…' : 'فصل الخلفية محلياً'}</button>
          <div className="grid grid-cols-2 gap-2"><button type="button" disabled={history.length < 2} onClick={undo} className="inline-flex min-h-10 items-center justify-center gap-1 rounded-xl bg-secondary text-xs font-black text-primary disabled:opacity-50"><Undo2 size={15} />تراجع</button><button type="button" onClick={reset} className="inline-flex min-h-10 items-center justify-center gap-1 rounded-xl bg-secondary text-xs font-black text-primary"><RotateCcw size={15} />إعادة ضبط</button></div>
        </aside>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3"><button type="button" onClick={onClose} className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-secondary text-sm font-black text-primary">إلغاء</button><button type="button" disabled={!isReady || !workingSource} onClick={() => onApply(workingSource)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-black text-primary-foreground disabled:opacity-50"><Check size={18} />استخدام الصورة المنقحة</button></div>
    </section>
  </div>;
}
