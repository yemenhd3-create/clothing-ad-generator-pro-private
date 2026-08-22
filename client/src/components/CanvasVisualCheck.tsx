import { useEffect, useState } from 'react';
import type { TemplateSize } from '@shared/types';
import { DEFAULT_AD_DETAILS, DEFAULT_TEMPLATE_SETTINGS } from '@shared/types';
import { getCanvasDimensions } from '@shared/adWorkflow';
import { renderAd } from '@/lib/canvasRenderer';

const coloredGarment = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="700" height="900" viewBox="0 0 700 900"><rect width="700" height="900" fill="#52616B"/><path d="M205 150h290l90 580H115z" fill="#D01720"/><path d="M270 150c0-82 160-82 160 0" fill="none" stroke="#2A2865" stroke-width="30"/><path d="M160 465h380" stroke="#2A2865" stroke-width="30"/><circle cx="95" cy="110" r="45" fill="#F2C94C"/></svg>`)}`;
const transparentGarment = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="700" height="900" viewBox="0 0 700 900"><path d="M220 165 310 105h80l90 60 105 120-78 72-42-48 38 476H197l38-476-42 48-78-72z" fill="#D01720"/><path d="M310 105c0 70 80 70 80 0" fill="none" stroke="#8B1020" stroke-width="20"/><path d="M240 500h220" stroke="#F8D6D9" stroke-width="18"/><path d="M255 600h190" stroke="#F8D6D9" stroke-width="12"/></svg>`)}`;
const transparentPerson = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="620" height="1000" viewBox="0 0 620 1000"><circle cx="310" cy="120" r="78" fill="#D4A384"/><path d="M190 245c55-70 185-70 240 0l58 300H132z" fill="#D01720"/><path d="M205 550h90v350h-120zM325 550h90l30 350h-120z" fill="#2A2865"/><path d="M225 244c25-48 145-48 170 0" fill="none" stroke="#F0ECFF" stroke-width="22"/></svg>`)}`;
const footerArtwork = '/manus-storage/trend-banner_97366a10.jpg';
const storeLogoArtwork = '/manus-storage/trend-logo_14e4740a.png';
const sizes: Array<{ value: TemplateSize; label: string }> = [{ value: 'portrait', label: 'منشور 4:5' }, { value: 'square', label: 'مربع 1:1' }, { value: 'story', label: 'قصة 9:16' }, { value: 'whatsapp', label: 'واتساب 3:4' }, { value: 'landscape', label: 'بانر 1.91:1' }];

export default function CanvasVisualCheck() {
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    const details = { ...DEFAULT_AD_DETAILS, productName: 'فستان بلوشي أنيق', discount: '30', price: '3000', quantity: '10', colors: ['أبيض'], features: ['قطن ناعم ومريح', 'خامة عالية الجودة'], storeName: 'متجر مروان', storePhone: '770976559' };
    Promise.all(sizes.flatMap(({ value }) => {
      const dimensions = getCanvasDimensions(value);
      return [
        renderAd(DEFAULT_AD_DETAILS, { ...DEFAULT_TEMPLATE_SETTINGS, size: value, productBackdrop: 'spotlight', productShadow: 'grounded', studioCaption: 'متوفر لدى مركز السعر المناسب', studioCaptionTextColor: '#111827', studioCaptionBackgroundColor: '#ff5757', studioPrice: 'السعر 500', studioPriceTextColor: '#111827', studioPriceBackgroundColor: '#ffe600' }, transparentGarment, { ...dimensions, visualMode: 'garment' }).then(url => ({ key: `${value}-studio`, url })),
        renderAd(details, { ...DEFAULT_TEMPLATE_SETTINGS, size: value }, coloredGarment, { ...dimensions, visualMode: 'garment' }).then(url => ({ key: `${value}-raw`, url })),
        renderAd(details, { ...DEFAULT_TEMPLATE_SETTINGS, size: value }, transparentPerson, { ...dimensions, visualMode: 'transparentPerson' }).then(url => ({ key: `${value}-person`, url })),
        renderAd(details, { ...DEFAULT_TEMPLATE_SETTINGS, size: value, showFooterArtwork: true, footerArtwork, showStoreLogo: true, storeLogoArtwork }, coloredGarment, { ...dimensions, visualMode: 'garment' }).then(url => ({ key: `${value}-layers`, url })),
      ];
    }))
      .then(results => {
        if (!active) { results.forEach(result => URL.revokeObjectURL(result.url)); return; }
        setPreviews(Object.fromEntries(results.map(result => [result.key, result.url])));
      })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'تعذر إنشاء المعاينات'); });
    return () => { active = false; Object.values(previews).forEach(url => URL.revokeObjectURL(url)); };
  }, []);

  return <main className="min-h-screen bg-[#fffdf6] p-5 text-center" dir="rtl"><h1 className="text-xl font-black text-[#2A2865]">فحص هندسة قوالب الإعلان</h1><p className="mt-2 text-sm leading-6 text-slate-600">كل مقاس يعرض غرفة الملابس مع طبقات النص والسعر الاختيارية ثم القوالب التفصيلية. يجب أن تبقى القطعة هي أكبر عنصر مرئي.</p>{error && <p className="mt-5 rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}<section className="mx-auto mt-6 max-w-6xl space-y-6">{sizes.map(size => <article key={size.value} className="rounded-2xl bg-white p-3 text-right shadow-sm"><h2 className="mb-3 text-sm font-black text-[#2A2865]">{size.label}</h2><div className="grid gap-3 sm:grid-cols-4"><Preview label="غرفة الملابس مع طبقات اختيارية" url={previews[`${size.value}-studio`]} /><Preview label="ملابس بخلفية ملونة" url={previews[`${size.value}-raw`]} /><Preview label="شخص شفاف (Try-On)" url={previews[`${size.value}-person`]} /><Preview label="شعار وتذييل كامل" url={previews[`${size.value}-layers`]} /></div></article>)}</section></main>;
}

function Preview({ label, url }: { label: string; url?: string }) {
  return <figure className="rounded-xl bg-slate-50 p-2"><figcaption className="mb-2 text-xs font-bold text-slate-600">{label}</figcaption>{url ? <img src={url} alt={label} className="max-h-[560px] w-full object-contain" /> : <p className="py-16 text-center text-sm text-slate-500">جارٍ توليد المعاينة…</p>}</figure>;
}
