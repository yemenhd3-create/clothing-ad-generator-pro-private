import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ImagePlus,
  Layers,
  LayoutTemplate,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { Input } from './ui/input';
import { useDynamicAssets } from '@/hooks/useDynamicAssets';
import {
  validateAndProcessTemplateImage,
  buildSmartDynamicTemplate,
  SMART_LAYOUT_PRESETS,
  MAX_DYNAMIC_TEMPLATES,
  type SmartLayoutPreset,
} from '@/lib/smartTemplateProcessor';

const DEFAULT_SAMPLE_TEMPLATE = `{
  "schemaVersion": 1,
  "id": "sample-template",
  "name": "قالب افتراضي",
  "size": "square",
  "elements": [
    {
      "id": "product",
      "visible": true,
      "required": true,
      "box": { "x": 0.05, "y": 0.12, "width": 0.44, "height": 0.76 }
    },
    {
      "id": "header",
      "visible": true,
      "required": false,
      "box": { "x": 0.52, "y": 0.10, "width": 0.44, "height": 0.22 }
    },
    {
      "id": "price",
      "visible": true,
      "required": false,
      "box": { "x": 0.52, "y": 0.36, "width": 0.44, "height": 0.22 }
    }
  ]
}`;

interface DeveloperTemplateManagerProps {
  onBack?: () => void;
  addDiagnostic?: (level: 'success' | 'error' | 'info', message: string) => void;
}

export default function DeveloperTemplateManager({
  addDiagnostic,
}: DeveloperTemplateManagerProps) {
  const {
    templates,
    activeTemplate,
    setActiveTemplate,
    errorNotice: templateError,
    successNotice: templateSuccess,
    saveJsonTemplate,
    saveTemplateDirectly,
    removeTemplate,
    setErrorNotice: setTemplateError,
    setSuccessNotice: setTemplateSuccess,
  } = useDynamicAssets();

  const [jsonInput, setJsonInput] = useState<string>(DEFAULT_SAMPLE_TEMPLATE);
  const [smartName, setSmartName] = useState('');
  const [smartLayout, setSmartLayout] = useState<SmartLayoutPreset>('split-left');
  const [smartPreviewDataUri, setSmartPreviewDataUri] = useState<string | null>(null);
  const [smartImageInfo, setSmartImageInfo] = useState<string | null>(null);
  const [isProcessingSmartImage, setIsProcessingSmartImage] = useState(false);
  const [showAdvancedJson, setShowAdvancedJson] = useState(false);

  useEffect(() => {
    if (activeTemplate) {
      setJsonInput(JSON.stringify(activeTemplate, null, 2));
    }
  }, [activeTemplate]);

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      setJsonInput(JSON.stringify(parsed, null, 2));
      setTemplateSuccess('تم تنسيق كود JSON بنجاح');
      setTemplateError(null);
    } catch (e) {
      setTemplateError(`فشل التنسيق: ${(e as Error).message}`);
    }
  };

  const handleSaveJsonTemplate = async () => {
    const success = await saveJsonTemplate(jsonInput);
    if (success) {
      addDiagnostic?.('success', 'تم حفظ وتفعيل قالب ديناميكي في IndexedDB');
    } else {
      addDiagnostic?.('error', 'فشل حفظ القالب الديناميكي');
    }
  };

  const handleResetToSample = () => {
    setJsonInput(DEFAULT_SAMPLE_TEMPLATE);
    setTemplateSuccess('تمت استعادة النموذج الافتراضي');
    setTemplateError(null);
  };

  const handleExportCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonInput);
      setTemplateSuccess('تم نسخ كود القالب إلى الحافظة بنجاح');
      setTemplateError(null);
    } catch {
      setTemplateSuccess('تفضل بنسخ الكود من المنطقة النصية مباشرة');
    }
  };

  const handleDeleteTemplate = async (templateId?: string) => {
    const idToDelete = templateId || activeTemplate?.id;
    if (!idToDelete) {
      setTemplateError('يرجى اختيار قالب للحذف');
      return;
    }
    await removeTemplate(idToDelete);
    setJsonInput(DEFAULT_SAMPLE_TEMPLATE);
    setTemplateSuccess('تم حذف القالب بنجاح');
  };

  const handleSmartFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingSmartImage(true);
    setTemplateError(null);
    setTemplateSuccess(null);

    try {
      const result = await validateAndProcessTemplateImage(file);
      setIsProcessingSmartImage(false);

      if (!result.success || !result.dataUri) {
        setTemplateError(result.error || 'تعذر معالجة صورة القالب');
        setSmartPreviewDataUri(null);
        setSmartImageInfo(null);
        return;
      }

      setSmartPreviewDataUri(result.dataUri);
      const kb = Math.round((result.sizeBytes || 0) / 1024);
      setSmartImageInfo(`أبعاد 1080×1080 بكسل | حجم مضغوط ومناسب للذاكرة ~${kb} ك.ب`);
      if (!smartName.trim()) {
        const clean = file.name.replace(/\.[^/.]+$/, '').slice(0, 30);
        setSmartName(clean.startsWith('قالب') ? clean : `قالب ${clean}`);
      }
      setTemplateSuccess('تم فحص وضغط صورة القالب بنجاح وفق معيار واتساب (1:1)');
    } catch {
      setIsProcessingSmartImage(false);
      setTemplateError('حدث خطأ غير متوقع أثناء معالجة صورة القالب');
    }
  };

  const handleSaveSmartTemplate = async () => {
    if (!smartPreviewDataUri) {
      setTemplateError('يرجى اختيار صورة للقالب أولاً');
      return;
    }
    if (!smartName.trim()) {
      setTemplateError('يرجى كتابة اسم للقالب');
      return;
    }
    if (templates.length >= MAX_DYNAMIC_TEMPLATES) {
      setTemplateError(`تم الوصول للحد الأقصى المسموح به (${MAX_DYNAMIC_TEMPLATES} قوالب). يرجى حذف أحد القوالب السابقة لتفريغ مساحة الذاكرة والحفاظ على سرعة الهاتف.`);
      return;
    }

    const tpl = buildSmartDynamicTemplate({
      name: smartName.trim(),
      backgroundImage: smartPreviewDataUri,
      layoutPreset: smartLayout,
    });

    const ok = await saveTemplateDirectly(tpl);
    if (ok) {
      setSmartPreviewDataUri(null);
      setSmartImageInfo(null);
      setSmartName('');
      addDiagnostic?.('success', `تم حفظ وتفعيل قالب واتساب ذكي: ${tpl.name}`);
    } else {
      addDiagnostic?.('error', 'فشل حفظ القالب الذكي في الذاكرة المحلية');
    }
  };

  return (
    <section className="space-y-4 rounded-[24px] bg-secondary p-4 shadow-[0_12px_30px_rgba(37,35,95,0.06)] sm:p-6" dir="rtl">
      {/* رأس الصفحة والمعلومات الأساسية */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-primary/10 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="text-primary" size={20} />
            <h3 className="font-black text-foreground">إدارة قوالب واتساب الذكية (Offline)</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            أضف قوالب إعلانات واتساب (1080×1080) مع فحص تلقائي للأبعاد وحماية ذكية للملابس من تداخل النصوص.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-black text-primary">
            السعة: {templates.length} من {MAX_DYNAMIC_TEMPLATES} قوالب
          </span>
        </div>
      </div>

      {templateError && (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700 border border-red-200">
          <AlertTriangle className="mt-0.5 shrink-0 text-red-600" size={16} />
          <span>{templateError}</span>
        </div>
      )}

      {templateSuccess && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-700 border border-emerald-200">
          <Check className="shrink-0 text-emerald-600" size={16} />
          <span>{templateSuccess}</span>
        </div>
      )}

      {/* بطاقة رفع وفحص قالب جديد */}
      <div className="space-y-3 rounded-2xl border border-primary/15 bg-card p-3.5 shadow-sm sm:p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black text-foreground flex items-center gap-1.5">
            <ImagePlus size={16} className="text-primary" /> رفع قالب واتساب جديد
          </span>
          <span className="text-[11px] font-bold text-muted-foreground">المقاس المطلوب: 1080×1080 (1:1)</span>
        </div>

        {/* منتقي الملف */}
        <div>
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary/20 bg-secondary/50 p-4 text-center transition hover:bg-secondary/80 hover:border-primary/40 active:scale-[0.99]">
            <Upload className="text-primary mb-1.5" size={22} />
            <span className="text-xs font-black text-foreground">
              {isProcessingSmartImage ? 'جارٍ الفحص والضغط التلقائي...' : 'اضغط لاختيار صورة القالب من الجهاز'}
            </span>
            <span className="mt-1 text-[10px] text-muted-foreground">
              يتم رفض أي صورة لا تطابق نسبة 1:1 وضغط الصورة تلقائياً لحفظ الذاكرة
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={handleSmartFileChange}
              disabled={isProcessingSmartImage}
              className="hidden"
            />
          </label>
        </div>

        {/* المعاينة الحية مع منطقة حماية الملابس */}
        {smartPreviewDataUri && (
          <div className="space-y-3 pt-2 border-t border-primary/10">
            <div className="flex items-center justify-between text-xs">
              <span className="font-black text-foreground">معاينة القالب مع موضع القطعة:</span>
              <span className="text-[10px] font-bold text-emerald-600">{smartImageInfo}</span>
            </div>

            <div className="relative mx-auto aspect-square w-full max-w-[260px] overflow-hidden rounded-2xl border-2 border-primary/20 bg-slate-900 shadow-inner">
              <img src={smartPreviewDataUri} alt="معاينة القالب المرفوع" className="h-full w-full object-cover" />
              {/* الموضع المحدد للقطعة لمنع التداخل */}
              {(() => {
                const preset = SMART_LAYOUT_PRESETS.find(p => p.id === smartLayout);
                if (!preset) return null;
                const { x, y, width, height } = preset.productSlot;
                return (
                  <div
                    className="absolute border-2 border-dashed border-emerald-400 bg-emerald-500/25 flex flex-col items-center justify-center p-1 rounded-lg text-center shadow-lg"
                    style={{
                      left: `${x * 100}%`,
                      top: `${y * 100}%`,
                      width: `${width * 100}%`,
                      height: `${height * 100}%`,
                    }}
                  >
                    <span className="rounded bg-slate-900/80 px-1.5 py-0.5 text-[9px] font-black text-emerald-300">
                      موضع الملابس المحمي
                    </span>
                    <span className="text-[8px] font-bold text-white/90 mt-0.5">
                      (النصوص في الجانب المقابل)
                    </span>
                  </div>
                );
              })()}
            </div>

            {/* اسم القالب */}
            <div>
              <label className="block text-xs font-bold text-foreground mb-1">اسم القالب:</label>
              <Input
                value={smartName}
                onChange={e => setSmartName(e.target.value)}
                placeholder="مثال: قالب صيفي فاخر"
                maxLength={40}
                className="text-xs"
              />
            </div>

            {/* اختيار نمط التوزيع الذكي */}
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">نمط توزيع التصميم:</label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {SMART_LAYOUT_PRESETS.map(preset => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setSmartLayout(preset.id)}
                    className={`rounded-xl border p-2.5 text-right transition active:scale-95 ${
                      smartLayout === preset.id
                        ? 'border-primary ring-2 ring-primary bg-primary/5'
                        : 'border-primary/15 bg-card hover:bg-secondary/40'
                    }`}
                  >
                    <span className="block text-xs font-black text-foreground">{preset.label}</span>
                    <span className="mt-1 block text-[10px] text-muted-foreground leading-4">{preset.description}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* زر الحفظ والتفعيل */}
            <button
              type="button"
              onClick={handleSaveSmartTemplate}
              disabled={templates.length >= MAX_DYNAMIC_TEMPLATES}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-black text-primary-foreground shadow-sm transition active:scale-95 disabled:opacity-50"
            >
              <Save size={16} />
              <span>{templates.length >= MAX_DYNAMIC_TEMPLATES ? 'السعة ممتلئة (احذف قالباً أولاً)' : 'حفظ وتفعيل القالب في التطبيق'}</span>
            </button>
          </div>
        )}
      </div>

      {/* قائمة القوالب المحفوظة بالجهاز */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black text-foreground flex items-center gap-1.5">
            <Layers size={16} className="text-primary" /> القوالب المحفوظة بالجهاز ({templates.length} من {MAX_DYNAMIC_TEMPLATES}):
          </span>
        </div>

        {templates.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-primary/20 bg-card p-6 text-center text-xs text-muted-foreground">
            لا توجد قوالب مخصصة محفوظة حالياً. ارفع أول قالب أعلاه لتبدأ استخدامه فوراً في التطبيق.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {templates.map(tpl => (
              <div
                key={tpl.id}
                className={`flex items-center justify-between gap-2 rounded-2xl border p-3 shadow-sm transition ${
                  activeTemplate?.id === tpl.id ? 'border-primary ring-1 ring-primary bg-primary/5' : 'border-primary/15 bg-card'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {tpl.backgroundImage ? (
                    <img
                      src={tpl.backgroundImage}
                      alt={tpl.name}
                      className="h-12 w-12 shrink-0 rounded-xl object-cover border border-primary/10 shadow-inner"
                    />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xs font-black text-primary">
                      JSON
                    </div>
                  )}
                  <div className="min-w-0">
                    <h4 className="truncate text-xs font-black text-foreground">{tpl.name}</h4>
                    <p className="text-[10px] text-muted-foreground">
                      {tpl.layoutPreset === 'split-left' ? 'القطعة يسار' : tpl.layoutPreset === 'split-right' ? 'القطعة يمين' : 'القطعة وسط'} • {tpl.size}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTemplate(tpl);
                      setJsonInput(JSON.stringify(tpl, null, 2));
                      setTemplateSuccess(`تم تحديد القالب "${tpl.name}"`);
                      setTemplateError(null);
                    }}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-black transition active:scale-95 ${
                      activeTemplate?.id === tpl.id
                        ? 'bg-primary text-primary-foreground'
                        : 'border border-primary/20 bg-card text-foreground hover:bg-primary/5'
                    }`}
                  >
                    {activeTemplate?.id === tpl.id ? 'مُفعّل' : 'تفعيل'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteTemplate(tpl.id)}
                    className="rounded-lg border border-red-200 bg-red-50 p-1.5 text-red-600 transition hover:bg-red-100 active:scale-95"
                    title="حذف القالب"
                    aria-label="حذف القالب"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* الأدوات المتقدمة (JSON Structure) - قابلة للطي */}
      <div className="border-t border-primary/10 pt-2">
        <button
          type="button"
          onClick={() => setShowAdvancedJson(curr => !curr)}
          className="flex w-full items-center justify-between rounded-xl bg-card px-3 py-2 text-xs font-bold text-muted-foreground hover:text-foreground border border-primary/10 transition"
        >
          <span className="flex items-center gap-1.5">
            <LayoutTemplate size={15} /> الأدوات المتقدمة (تعديل كود القالب JSON يدوياً)
          </span>
          {showAdvancedJson ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showAdvancedJson && (
          <div className="mt-3 space-y-3 rounded-2xl border border-primary/15 bg-card p-3 shadow-inner">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-foreground">كود القالب (JSON Structure):</label>
              <button
                type="button"
                onClick={handleFormatJson}
                className="rounded-lg border border-primary/20 bg-secondary px-2.5 py-1 text-[11px] font-bold text-foreground hover:bg-primary/10 active:scale-95 transition"
              >
                تنسيق JSON
              </button>
            </div>

            <textarea
              value={jsonInput}
              onChange={e => setJsonInput(e.target.value)}
              className="h-56 w-full rounded-xl border border-primary/15 bg-slate-900 p-3 font-mono text-xs text-slate-100 shadow-inner focus:outline-none focus:ring-2 focus:ring-primary dir-ltr text-left"
              placeholder="ضع كود JSON للقالب هنا..."
              spellCheck={false}
            />

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button
                type="button"
                onClick={handleSaveJsonTemplate}
                className="flex min-h-10 items-center justify-center gap-1 rounded-xl bg-primary px-2.5 text-xs font-black text-primary-foreground shadow-sm transition active:scale-95"
              >
                <Save size={15} />
                <span>حفظ الكود</span>
              </button>
              <button
                type="button"
                onClick={handleExportCopy}
                className="flex min-h-10 items-center justify-center gap-1 rounded-xl border border-primary/15 bg-card px-2.5 text-xs font-bold text-foreground transition hover:bg-primary/5 active:scale-95"
              >
                <Copy size={15} />
                <span>نسخ الكود</span>
              </button>
              <button
                type="button"
                onClick={handleResetToSample}
                className="flex min-h-10 items-center justify-center gap-1 rounded-xl border border-primary/15 bg-card px-2.5 text-xs font-bold text-foreground transition hover:bg-primary/5 active:scale-95"
              >
                <RotateCcw size={15} />
                <span>نموذج افتراضي</span>
              </button>
              <button
                type="button"
                onClick={() => handleDeleteTemplate()}
                className="flex min-h-10 items-center justify-center gap-1 rounded-xl border border-red-200 bg-red-50 px-2.5 text-xs font-bold text-red-600 transition hover:bg-red-100 active:scale-95"
              >
                <Trash2 size={15} />
                <span>حذف القالب</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
