import * as React from 'react';
import { Github, MessageCircle, ShieldCheck } from 'lucide-react';

const LOGO_URL = import.meta.env.VITE_EMBEDDED_ANDROID_APP === 'true' ? '/app-logo.png' : '/manus-storage/marwan-designer-logo_df9b28d4.png';

export default function AboutApp({ onBack }: { onBack: () => void }) {
  return (
    <section className="p-5 text-right sm:p-7" style={{ minHeight: '100%', width: '100%', background: 'var(--card)' }} dir="rtl">
      <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary"><ShieldCheck size={15} /> مشروع شخصي تعليمي</span>
      <div className="mt-5 flex flex-col items-center text-center">
        <img src={LOGO_URL} alt="Marwan Designer" className="h-24 w-24 rounded-3xl object-contain shadow-sm" />
        <h2 className="mt-4 text-2xl font-black text-foreground">حول التطبيق</h2>
        <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">مولد إعلانات الملابس يساعدك على تحويل صورة القطعة إلى إعلان عربي جاهز للمشاركة، مع تجربة ملابس اختيارية وخطة محلية تعمل عند عدم توفر الذكاء الاصطناعي.</p>
      </div>

      <div className="mt-6 space-y-3">
        <div className="rounded-2xl bg-secondary/70 p-4"><p className="text-xs font-bold text-muted-foreground">مطور التطبيق</p><p className="mt-1 font-black text-foreground">المهندس مروان داغس</p></div>
        <a href="https://wa.me/967770976559" target="_blank" rel="noreferrer" aria-label="مراسلة المطور عبر واتساب" className="flex items-center gap-3 rounded-2xl border border-stone-100 p-4 text-foreground"><MessageCircle size={19} className="text-primary" /><span className="min-w-0 flex-1"><span className="block text-xs font-bold text-muted-foreground">واتساب للتواصل</span><span className="mt-1 block font-black" dir="ltr">770976559</span></span></a>
        <a href="https://github.com/yemenhd3-create" target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl border border-stone-100 p-4 text-foreground"><Github size={19} className="text-primary" /><span className="min-w-0 flex-1"><span className="block text-xs font-bold text-muted-foreground">GitHub</span><span className="mt-1 block font-black" dir="ltr">yemenhd3-create</span></span></a>
      </div>

      <button type="button" onClick={onBack} className="mt-7 inline-flex min-h-14 w-full items-center justify-center rounded-2xl bg-primary text-base font-black text-primary-foreground transition active:scale-[0.98]">العودة إلى الإعدادات</button>
    </section>
  );
}
