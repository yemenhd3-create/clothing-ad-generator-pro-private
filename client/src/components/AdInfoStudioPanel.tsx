import { useMemo, useState } from 'react';
import type { AdDetails, TemplateSettings } from '@shared/types';
import {
  AD_COPY_FONTS,
  AD_COPY_LAYER_LABELS,
  type AdCopyInput,
  type AdCopyLayer,
  type AdCopyLayerKind,
  createAdCopyLayers,
  buildFallbackAdCopy,
} from '@shared/adCopyStudio';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Sparkles, X } from 'lucide-react';

const FIELD_OPTIONS: Array<{ id: AdCopyLayerKind; label: string }> = [
  { id: 'productTitle', label: 'اسم القطعة' },
  { id: 'price', label: 'السعر والعملة' },
  { id: 'shortDescription', label: 'الوصف القصير' },
  { id: 'discount', label: 'نسبة الخصم' },
  { id: 'quantity', label: 'الكمية المتاحة' },
  { id: 'colors', label: 'خيارات الألوان' },
  { id: 'contact', label: 'رقم للتواصل' },
  { id: 'location', label: 'عنوان المركز' },
  { id: 'cta', label: 'زر الطلب' },
];

type Props = {
  details: AdDetails;
  template: TemplateSettings;
  disabled: boolean;
  isGenerating: boolean;
  onClose: () => void;
  onDetailsChange: (patch: Partial<AdDetails>) => void;
  onTemplateChange: (patch: Partial<TemplateSettings>) => void;
};

export function AdInfoStudioPanel({
  details,
  template,
  disabled,
  isGenerating,
  onClose,
  onDetailsChange,
  onTemplateChange,
}: Props) {
  const existing = template.adCopyLayers || [];
  const [selectedFields, setSelectedFields] = useState<AdCopyLayerKind[]>(
    existing.length > 0 ? existing.map(l => l.id) : ['productTitle', 'price', 'shortDescription', 'cta']
  );
  const [activeLayer, setActiveLayer] = useState<AdCopyLayerKind>(existing[0]?.id || 'productTitle');
  const [notice, setNotice] = useState('');

  const [draft, setDraft] = useState({
    productName: details.productName || '',
    price: details.price || '',
    currency: details.currency || 'ريال',
    storeLocation: details.storeLocation || '',
    storePhone: details.storePhone || '',
    discount: details.discount || '',
    quantity: details.quantity || '',
    colors: (details.colors || []).join('، '),
    cta: 'اطلب الآن عبر واتساب',
    productContext: details.headline || '',
  });

  const layers = useMemo(() => template.adCopyLayers || [], [template.adCopyLayers]);
  const active = layers.find(layer => layer.id === activeLayer) || layers[0];

  const setField = (key: keyof typeof draft, value: string) =>
    setDraft(current => ({ ...current, [key]: value }));

  const toggleField = (id: AdCopyLayerKind) =>
    setSelectedFields(current =>
      current.includes(id) ? current.filter(item => item !== id) : [...current, id]
    );

  const applySmartTexts = () => {
    const input: AdCopyInput = {
      ...draft,
      colors: draft.colors.split(/[،,]/).map(item => item.trim()).filter(Boolean),
      selectedFields,
    };

    onDetailsChange({
      productName: draft.productName,
      price: draft.price,
      currency: draft.currency,
      storeLocation: draft.storeLocation,
      storePhone: draft.storePhone,
      discount: draft.discount,
      quantity: draft.quantity,
      colors: input.colors,
      headline: draft.productContext,
    });

    const suggestion = buildFallbackAdCopy(input);
    const nextLayers = createAdCopyLayers(suggestion, selectedFields);
    onTemplateChange({ adCopyLayers: nextLayers });
    setActiveLayer(nextLayers[0]?.id || 'productTitle');
    setNotice('تم تجهيز وتوزيع النصوص فوق القالب بنجاح. يمكنك تحريكها وتعديل خطها ومكانها.');
  };

  const updateLayer = (patch: Partial<AdCopyLayer>) => {
    if (!active) return;
    onTemplateChange({
      adCopyLayers: layers.map(layer => (layer.id === active.id ? { ...layer, ...patch } : layer)),
    });
  };

  const moveLayer = (dx: number, dy: number) => {
    if (!active) return;
    const nextX = Math.min(0.95, Math.max(0.05, Number((active.x + dx).toFixed(2))));
    const nextY = Math.min(0.95, Math.max(0.05, Number((active.y + dy).toFixed(2))));
    updateLayer({ x: nextX, y: nextY });
  };

  return (
    <div
      data-wardrobe-tool-panel
      className="absolute inset-x-2 bottom-20 z-30 max-h-[82%] overflow-y-auto rounded-3xl border border-primary/20 bg-white/95 p-3.5 text-right shadow-2xl backdrop-blur-md"
      dir="rtl"
      aria-label="استوديو نصوص القالب"
    >
      <div className="flex items-center justify-between border-b border-primary/10 pb-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="text-amber-500" size={18} />
          <h3 className="text-sm font-black text-primary">نصوص القالب الذكية</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-secondary p-1 text-primary hover:bg-secondary/80"
          aria-label="إغلاق"
        >
          <X size={16} />
        </button>
      </div>

      <p className="mt-2 text-[11px] font-bold text-muted-foreground leading-4">
        اختر العناصر المطلوبة داخل الإعلان ثم اضغط لتوليدها وترتيبها فوق الصورة مع إمكانية تحريكها وتكبيرها:
      </p>

      {/* حقول الاختيار السريعة */}
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {FIELD_OPTIONS.map(field => {
          const checked = selectedFields.includes(field.id);
          return (
            <button
              key={field.id}
              type="button"
              disabled={disabled}
              onClick={() => toggleField(field.id)}
              className={`rounded-xl px-2.5 py-1 text-xs font-bold transition active:scale-95 ${
                checked
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-secondary/60 text-foreground ring-1 ring-stone-200'
              }`}
            >
              {field.label}
            </button>
          );
        })}
      </div>

      {/* مدخلات البيانات الأساسية */}
      <div className="mt-3 grid grid-cols-2 gap-2 text-right">
        <label className="text-[10px] font-bold text-muted-foreground">
          اسم القطعة
          <input
            value={draft.productName}
            onChange={e => setField('productName', e.target.value)}
            placeholder="مثال: فستان سهرة مخمل"
            className="mt-1 min-h-9 w-full rounded-xl border border-primary/15 bg-white px-2 text-xs text-foreground outline-none focus:border-primary"
          />
        </label>
        <label className="text-[10px] font-bold text-muted-foreground">
          السعر
          <input
            value={draft.price}
            onChange={e => setField('price', e.target.value)}
            placeholder="مثال: 4500"
            className="mt-1 min-h-9 w-full rounded-xl border border-primary/15 bg-white px-2 text-xs text-foreground outline-none focus:border-primary"
          />
        </label>
        <label className="text-[10px] font-bold text-muted-foreground">
          نسبة الخصم
          <input
            value={draft.discount}
            onChange={e => setField('discount', e.target.value)}
            placeholder="مثال: 25"
            className="mt-1 min-h-9 w-full rounded-xl border border-primary/15 bg-white px-2 text-xs text-foreground outline-none focus:border-primary"
          />
        </label>
        <label className="text-[10px] font-bold text-muted-foreground">
          الوصف القصير
          <input
            value={draft.productContext}
            onChange={e => setField('productContext', e.target.value)}
            placeholder="مثال: خامة تركية مميزة"
            className="mt-1 min-h-9 w-full rounded-xl border border-primary/15 bg-white px-2 text-xs text-foreground outline-none focus:border-primary"
          />
        </label>
      </div>

      {/* زر التوليد / التطبيق فوق الصورة */}
      <button
        type="button"
        disabled={disabled || isGenerating || selectedFields.length === 0}
        onClick={applySmartTexts}
        className="mt-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 text-xs font-black text-primary-foreground shadow-sm transition active:scale-95 disabled:opacity-50"
      >
        <Sparkles size={15} />
        وضع النصوص الذكية فوق القالب
      </button>

      {notice && (
        <p className="mt-2 rounded-xl bg-primary/5 p-2 text-[10px] font-bold text-primary text-center">
          {notice}
        </p>
      )}

      {/* قسم تحرير وتحريك الطبقات */}
      {layers.length > 0 && (
        <div className="mt-3.5 border-t border-primary/10 pt-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-black text-primary">تحريك وتعديل الطبقات</span>
            <span className="text-[10px] text-muted-foreground">اختر الطبقة لتحريكها وتغيير حجمها</span>
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1.5" dir="rtl">
            {layers.map(layer => (
              <button
                key={layer.id}
                type="button"
                onClick={() => setActiveLayer(layer.id)}
                className={`shrink-0 rounded-xl px-2.5 py-1 text-xs font-black transition ${
                  active?.id === layer.id
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-secondary text-primary hover:bg-secondary/80'
                }`}
              >
                {AD_COPY_LAYER_LABELS[layer.id as AdCopyLayerKind] || layer.label || 'نص'}
              </button>
            ))}
          </div>

          {active && (
            <div className="mt-2 space-y-2.5 rounded-2xl bg-secondary/30 p-2.5">
              <label className="block text-[10px] font-bold text-muted-foreground">
                النص المكتوب
                <input
                  value={active.text}
                  onChange={e => updateLayer({ text: e.target.value })}
                  className="mt-1 min-h-8 w-full rounded-lg border border-primary/15 bg-white px-2 text-xs text-foreground outline-none focus:border-primary"
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="text-[10px] font-bold text-muted-foreground">
                  نوع الخط
                  <select
                    value={active.fontFamily}
                    onChange={e => updateLayer({ fontFamily: e.target.value })}
                    className="mt-1 min-h-8 w-full rounded-lg border border-primary/15 bg-white px-1 text-xs text-foreground"
                  >
                    {AD_COPY_FONTS.map(f => (
                      <option key={f.id} value={f.family}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-[10px] font-bold text-muted-foreground">
                  لون النص
                  <input
                    type="color"
                    value={active.color}
                    onChange={e => updateLayer({ color: e.target.value })}
                    className="mt-1 h-8 w-full cursor-pointer rounded-lg border border-primary/15 bg-white p-0.5"
                  />
                </label>
              </div>

              {/* تحكم الحجم والتحريك */}
              <div className="flex items-center justify-between text-xs font-bold text-muted-foreground pt-1">
                <span>حجم النص: {active.fontSize}px</span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => updateLayer({ fontSize: Math.max(14, active.fontSize - 4) })}
                    className="rounded-lg bg-white px-2.5 py-1 text-xs font-black text-primary shadow-sm active:scale-95"
                  >
                    تصغير
                  </button>
                  <button
                    type="button"
                    onClick={() => updateLayer({ fontSize: Math.min(84, active.fontSize + 4) })}
                    className="rounded-lg bg-primary px-2.5 py-1 text-xs font-black text-primary-foreground shadow-sm active:scale-95"
                  >
                    تكبير
                  </button>
                </div>
              </div>

              {/* أسهم تحريك النص فوق الصورة */}
              <div className="border-t border-primary/10 pt-2">
                <span className="block text-center text-[10px] font-black text-primary mb-1">
                  تحريك موضع النص داخل القالب
                </span>
                <div className="mx-auto grid grid-cols-3 gap-1.5" style={{ width: 132 }}>
                  <span />
                  <button
                    type="button"
                    onClick={() => moveLayer(0, -0.04)}
                    className="flex h-8 items-center justify-center rounded-lg bg-white text-primary shadow-sm active:scale-95"
                    aria-label="تحريك لأعلى"
                  >
                    <ArrowUp size={15} />
                  </button>
                  <span />
                  <button
                    type="button"
                    onClick={() => moveLayer(0.04, 0)}
                    className="flex h-8 items-center justify-center rounded-lg bg-white text-primary shadow-sm active:scale-95"
                    aria-label="تحريك لليمين"
                  >
                    <ArrowRight size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => updateLayer({ visible: !active.visible })}
                    className="flex h-8 items-center justify-center rounded-lg bg-secondary text-[10px] font-black text-primary active:scale-95"
                  >
                    {active.visible ? 'إخفاء' : 'إظهار'}
                  </button>
                  <button
                    type="button"
                    onClick={() => moveLayer(-0.04, 0)}
                    className="flex h-8 items-center justify-center rounded-lg bg-white text-primary shadow-sm active:scale-95"
                    aria-label="تحريك لليسار"
                  >
                    <ArrowLeft size={15} />
                  </button>
                  <span />
                  <button
                    type="button"
                    onClick={() => moveLayer(0, 0.04)}
                    className="flex h-8 items-center justify-center rounded-lg bg-white text-primary shadow-sm active:scale-95"
                    aria-label="تحريك لأسفل"
                  >
                    <ArrowDown size={15} />
                  </button>
                  <span />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
