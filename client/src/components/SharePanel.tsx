import * as React from 'react';
import { Download, Eraser, FileCheck2, LoaderCircle, MessageCircle, Pencil, ScanLine, Send, Smartphone } from 'lucide-react';

interface SharePanelProps {
  onDownload: () => void;
  onShare: () => void;
  onWhatsApp: () => void;
  onEdit: () => void;
  onClear: () => void;
  onQualityCheck: () => void;
  onContractCheck: () => void;
  onExportGateCheck: () => void;
  isQualityChecking?: boolean;
  isContractChecking?: boolean;
  isExportGateChecking?: boolean;
  exportBlocked?: boolean;
}

export default function SharePanel({ onDownload, onShare, onWhatsApp, onEdit, onClear, onQualityCheck, onContractCheck, onExportGateCheck, isQualityChecking = false, isContractChecking = false, isExportGateChecking = false, exportBlocked = false }: SharePanelProps) {
  return (
    <section className="grid grid-cols-2 gap-3" dir="rtl" aria-label="خيارات الإعلان النهائي">
      <div className="col-span-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3"><div className="flex items-center gap-2 text-emerald-700"><Smartphone size={17} /><p className="text-sm font-black">تم حفظ الإعلان بنجاح</p></div><p className="mt-1 text-xs leading-5 text-emerald-800">يمكنك مشاركته الآن أو حفظ نسخة PNG في الهاتف. يظل التصميم قابلاً للتعديل.</p></div>
      {exportBlocked && <div className="col-span-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-center text-xs font-bold leading-5 text-red-800">أوقفت بوابة الجودة الحفظ والمشاركة حتى إصلاح الخطأ الهندسي الحرج.</div>}
      <button type="button" disabled={exportBlocked} onClick={onWhatsApp} className="reference-primary col-span-2 w-full disabled:cursor-not-allowed disabled:opacity-50"><MessageCircle size={20} /> مشاركة عبر WhatsApp</button>
      <button type="button" disabled={exportBlocked} onClick={onDownload} className="reference-outline col-span-2 w-full disabled:cursor-not-allowed disabled:opacity-50"><Download size={20} /> حفظ في الهاتف</button>
      <button type="button" disabled={isQualityChecking} onClick={onQualityCheck} className="col-span-2 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-3 text-sm font-black text-primary transition hover:bg-primary/5 active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"><FileCheck2 size={18} />{isQualityChecking ? <><LoaderCircle size={16} className="animate-spin" /> جارٍ فحص الإعلان محلياً</> : 'فحص جودة الإعلان'}</button>
      <button type="button" disabled={isContractChecking} onClick={onContractCheck} className="col-span-2 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-3 text-sm font-black text-primary transition hover:bg-primary/5 active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"><ScanLine size={18} />{isContractChecking ? <><LoaderCircle size={16} className="animate-spin" /> جارٍ فحص عقد التصميم</> : 'فحص عقد التصميم'}</button>
      <button type="button" disabled={isExportGateChecking} onClick={onExportGateCheck} className="col-span-2 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-3 text-sm font-black text-primary transition hover:bg-primary/5 active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"><ScanLine size={18} />{isExportGateChecking ? <><LoaderCircle size={16} className="animate-spin" /> جارٍ فحص صلاحية التصدير</> : 'فحص صلاحية التصدير'}</button>
      <button type="button" onClick={onEdit} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-3 text-sm font-black text-primary transition hover:bg-primary/5 active:scale-[0.98]"><Pencil size={18} /> تعديل الإعلان</button>
      <button type="button" disabled={exportBlocked} onClick={onShare} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-3 text-sm font-black text-primary transition hover:bg-primary/5 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"><Send size={18} /> مشاركة أخرى</button>
      <button type="button" onClick={onClear} className="col-span-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-3 text-xs font-black text-red-700 transition hover:bg-red-50 active:scale-[0.98]"><Eraser size={16} /> مسح جلسة الإعلان والبدء بإعلان جديد</button>
    </section>
  );
}
