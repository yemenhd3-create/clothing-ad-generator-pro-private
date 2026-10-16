import React, { useState } from 'react';
import { Coins, Copy, KeyRound, RotateCcw, ShieldBan, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

export default function DeveloperAccessCodes() {
  const utils = trpc.useUtils();
  const codesQuery = trpc.developer.personal.accessCodes.list.useQuery();
  const [label, setLabel] = useState('');
  const [aiCreditsTotal, setAiCreditsTotal] = useState('500');
  const [aiDailyLimit, setAiDailyLimit] = useState('50');
  const [expiresAt, setExpiresAt] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  const [activeCodeId, setActiveCodeId] = useState<number | null>(null);
  const [rechargeAmount, setRechargeAmount] = useState('100');
  const [editTotalCredits, setEditTotalCredits] = useState('500');
  const [editDailyLimit, setEditDailyLimit] = useState('50');

  const createCode = trpc.developer.personal.accessCodes.create.useMutation({
    onSuccess: async data => {
      setCreatedCode(data.code);
      toast.success('تم إنشاء الرمز برصيد الكريدت المحدد بنجاح.');
      setLabel('');
      await utils.developer.personal.accessCodes.list.invalidate();
    },
    onError: error => toast.error(error.message || 'تعذر إنشاء الرمز.'),
  });

  const revokeCode = trpc.developer.personal.accessCodes.revoke.useMutation({
    onSuccess: async () => {
      toast.success('تم إلغاء الرمز وإيقاف جلسته الحالية.');
      await utils.developer.personal.accessCodes.list.invalidate();
    },
    onError: error => toast.error(error.message || 'تعذر إلغاء الرمز.'),
  });

  const rechargeMutation = trpc.developer.personal.aiQuota.recharge.useMutation({
    onSuccess: async () => {
      toast.success('تم شحن الرصيد بنجاح.');
      setActiveCodeId(null);
      await utils.developer.personal.accessCodes.list.invalidate();
    },
    onError: error => toast.error(error.message || 'تعذر شحن الرصيد.'),
  });

  const resetDailyMutation = trpc.developer.personal.aiQuota.resetDaily.useMutation({
    onSuccess: async () => {
      toast.success('تم تصفير استهلاك الحد اليومي للرمز.');
      await utils.developer.personal.accessCodes.list.invalidate();
    },
    onError: error => toast.error(error.message || 'تعذر تصفير الحد اليومي.'),
  });

  const updateLimitsMutation = trpc.developer.personal.aiQuota.updateLimits.useMutation({
    onSuccess: async () => {
      toast.success('تم حفظ الحدود بنجاح.');
      setActiveCodeId(null);
      await utils.developer.personal.accessCodes.list.invalidate();
    },
    onError: error => toast.error(error.message || 'تعذر حفظ الحدود.'),
  });

  const submit = () => {
    if (!label.trim()) return toast.error('اكتب اسماً مختصراً للرمز أو لصاحبه.');
    const expiry = expiresAt ? new Date(expiresAt).getTime() : undefined;
    if (expiresAt && (!expiry || expiry <= Date.now())) return toast.error('اختر تاريخ صلاحية مستقبلياً أو اتركه فارغاً لصلاحية مفتوحة.');
    const uses = maxUses.trim() ? Number(maxUses) : undefined;
    if (uses !== undefined && (!Number.isInteger(uses) || uses < 1)) return toast.error('عدد الاستخدامات يجب أن يكون رقماً موجباً أو اتركه فارغاً لغير محدود.');
    const credits = aiCreditsTotal.trim() ? Number(aiCreditsTotal) : 500;
    const daily = aiDailyLimit.trim() ? Number(aiDailyLimit) : 50;

    createCode.mutate({
      label: label.trim(),
      expiresAt: expiry,
      maxUses: uses,
      aiCreditsTotal: Number.isInteger(credits) ? credits : 500,
      aiDailyLimit: Number.isInteger(daily) ? daily : 50,
    });
  };

  const copy = async () => {
    if (!createdCode) return;
    await navigator.clipboard.writeText(createdCode);
    toast.success('تم نسخ الرمز.');
  };

  const handleRecharge = (codeId: number) => {
    const credits = Number(rechargeAmount);
    if (!credits || credits <= 0) return toast.error('أدخل رصيداً صحيحاً أكبر من صفر.');
    rechargeMutation.mutate({ id: codeId, credits });
  };

  const handleUpdateLimits = (codeId: number) => {
    const total = Number(editTotalCredits);
    const daily = Number(editDailyLimit);
    updateLimitsMutation.mutate({
      id: codeId,
      aiCreditsTotal: Number.isInteger(total) ? total : undefined,
      aiDailyLimit: Number.isInteger(daily) ? daily : undefined,
    });
  };

  return <section className="rounded-[28px] bg-white p-5 shadow-[0_12px_30px_rgba(37,35,95,0.06)] sm:p-7">
    <div className="flex items-center gap-2 text-primary"><KeyRound size={20} /><h3 className="font-black">رموز دخول المستخدمين وبطاقات الرصيد (Credits)</h3></div>
    <p className="mt-2 text-sm leading-6 text-muted-foreground">أنشئ رمز دخول يعمل بنظام محفظة الرصيد. يبقى الرمز نشطاً ويدخل للتطبيق طالما يحتوي على رصيد متبقٍ دون الحاجة لتحديد تواريخ انتهاء.</p>

    {/* جدول استهلاك الكريدت */}
    <div className="mt-3 rounded-2xl bg-secondary/60 p-3.5 text-xs text-primary">
      <p className="font-bold flex items-center gap-1.5"><Sparkles size={14} /> جدول استهلاك الرصيد لكل عملية:</p>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
        <div className="rounded-xl bg-white p-2 border border-stone-100 shadow-sm">
          <span className="text-muted-foreground block">صورة إعلان / قياس</span>
          <span className="font-black text-foreground">10 كريدت</span>
        </div>
        <div className="rounded-xl bg-white p-2 border border-stone-100 shadow-sm">
          <span className="text-muted-foreground block">إزالة خلفية صورة</span>
          <span className="font-black text-foreground">5 كريدت</span>
        </div>
        <div className="rounded-xl bg-white p-2 border border-stone-100 shadow-sm">
          <span className="text-muted-foreground block">صياغة نص تسويقي</span>
          <span className="font-black text-foreground">2 كريدت</span>
        </div>
        <div className="rounded-xl bg-white p-2 border border-stone-100 shadow-sm">
          <span className="text-muted-foreground block">استشارة القائد الذكي</span>
          <span className="font-black text-foreground">2 كريدت</span>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-emerald-700 font-bold">* الصياغة المحلية البديلة مجانية تماماً (0 كريدت) وتعمل دائماً.</p>
    </div>

    {/* نموذج إنشاء الرمز */}
    <div className="mt-4 space-y-3">
      <label className="block text-xs font-bold text-primary">اسم الرمز أو صاحبه
        <input value={label} onChange={event => setLabel(event.target.value)} maxLength={120} placeholder="مثال: بطاقة أحمد - 500 كريدت" className="mt-1 min-h-12 w-full rounded-xl border border-stone-200 px-3 text-sm text-foreground outline-none focus:border-primary" />
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-xs font-bold text-primary">إجمالي رصيد الكريدت
          <input value={aiCreditsTotal} onChange={event => setAiCreditsTotal(event.target.value)} inputMode="numeric" placeholder="مثال: 500 أو 1000 (-1 = غير محدود)" className="mt-1 min-h-12 w-full rounded-xl border border-stone-200 px-3 text-sm text-foreground outline-none focus:border-primary font-bold" />
        </label>
        <label className="block text-xs font-bold text-primary">الحد اليومي المسموح
          <input value={aiDailyLimit} onChange={event => setAiDailyLimit(event.target.value)} inputMode="numeric" placeholder="مثال: 50 (-1 = غير محدود)" className="mt-1 min-h-12 w-full rounded-xl border border-stone-200 px-3 text-sm text-foreground outline-none focus:border-primary font-bold" />
        </label>
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
        >
          {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {showAdvanced ? 'إخفاء الخيارات الإضافية' : 'خيارات إضافية (تاريخ الصلاحية وعدد أجهزة الدخول)'}
        </button>

        {showAdvanced && (
          <div className="mt-2 grid grid-cols-1 gap-3 rounded-2xl bg-stone-50 p-3 sm:grid-cols-2">
            <label className="block text-xs font-bold text-primary">تاريخ الصلاحية — اختياري (فارغ = دائم طالما وُجد رصيد)
              <input value={expiresAt} onChange={event => setExpiresAt(event.target.value)} type="datetime-local" className="mt-1 min-h-12 w-full rounded-xl border border-stone-200 px-3 text-sm text-foreground outline-none focus:border-primary" />
            </label>
            <label className="block text-xs font-bold text-primary">عدد مرات الدخول — اختياري (فارغ = مفتوح)
              <input value={maxUses} onChange={event => setMaxUses(event.target.value)} inputMode="numeric" placeholder="فارغ = دخول مفتوح" className="mt-1 min-h-12 w-full rounded-xl border border-stone-200 px-3 text-sm text-foreground outline-none focus:border-primary" />
            </label>
          </div>
        )}
      </div>
    </div>

    <button type="button" disabled={createCode.isPending} onClick={submit} className="mt-3 min-h-12 w-full rounded-xl bg-primary text-sm font-black text-primary-foreground disabled:opacity-50">{createCode.isPending ? 'جارٍ الإنشاء…' : 'توليد بطاقة رصيد'}</button>
    {createdCode && <div className="mt-3 rounded-2xl bg-secondary p-4"><p className="text-xs font-bold text-primary">احفظه الآن؛ لا يمكن عرضه لاحقاً.</p><div className="mt-2 flex items-center gap-2" dir="ltr"><code className="min-w-0 flex-1 truncate rounded-lg bg-white px-3 py-2 font-bold text-primary">{createdCode}</code><button type="button" onClick={copy} className="rounded-lg bg-primary p-2 text-white" aria-label="نسخ الرمز"><Copy size={18} /></button></div></div>}

    {/* قائمة الأكواد والبطاقات */}
    <div className="mt-5 space-y-3">
      {codesQuery.data?.map(code => {
        const remainingCredits = code.aiCreditsTotal === -1 ? 'غير محدود' : Math.max(0, code.aiCreditsTotal - code.aiCreditsUsed);
        const dailyLimitStr = code.aiDailyLimit === -1 ? 'غير محدود' : `${code.aiDailyUsed} من ${code.aiDailyLimit}`;
        const isEditing = activeCodeId === code.id;

        const isRevoked = code.isRevoked;
        const isCreditsExhausted = code.aiCreditsTotal !== -1 && code.aiCreditsUsed >= code.aiCreditsTotal;
        const isDateExpired = code.expiresAt && new Date(code.expiresAt) <= new Date();
        const isUsesExhausted = code.maxUses !== null && code.useCount >= code.maxUses;

        let badgeText = 'نشط (رصيد متاح)';
        let badgeColor = 'bg-emerald-50 text-emerald-700';

        if (isRevoked) {
          badgeText = 'ملغى';
          badgeColor = 'bg-red-50 text-red-700';
        } else if (isCreditsExhausted) {
          badgeText = 'نفد الرصيد';
          badgeColor = 'bg-rose-50 text-rose-700 font-black';
        } else if (isDateExpired) {
          badgeText = 'منتهٍ زمنيّاً';
          badgeColor = 'bg-amber-50 text-amber-800';
        } else if (isUsesExhausted) {
          badgeText = 'اكتمل الدخول';
          badgeColor = 'bg-stone-100 text-stone-700';
        }

        return (
          <article key={code.id} className="rounded-2xl border border-stone-100 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate font-black text-foreground">{code.label}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${badgeColor}`}>
                    {badgeText}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  مرات تسجيل الدخول: {code.useCount}{code.maxUses ? ` / ${code.maxUses}` : ' (مفتوحة)'}
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-bold ${isCreditsExhausted ? 'bg-rose-50 text-rose-700' : 'bg-secondary text-primary'}`}>
                    <Coins size={13} />
                    الرصيد: {remainingCredits} (مستهلك: {code.aiCreditsUsed})
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-lg bg-secondary px-2.5 py-1 font-bold text-primary">
                    <Sparkles size={13} />
                    اليومي: {dailyLimitStr}
                  </span>
                </div>
              </div>
              {!code.isRevoked && (
                <button
                  type="button"
                  disabled={revokeCode.isPending}
                  onClick={() => revokeCode.mutate({ id: code.id })}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700"
                >
                  <ShieldBan size={14} />
                  إلغاء
                </button>
              )}
            </div>

            {!code.isRevoked && (
              <div className="mt-3 border-t border-stone-100 pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (isEditing) setActiveCodeId(null);
                      else {
                        setActiveCodeId(code.id);
                        setEditTotalCredits(String(code.aiCreditsTotal));
                        setEditDailyLimit(String(code.aiDailyLimit));
                      }
                    }}
                    className="rounded-lg bg-secondary px-2.5 py-1.5 text-xs font-bold text-primary"
                  >
                    {isEditing ? 'إغلاق الإدارة' : 'إدارة الرصيد والحدود'}
                  </button>

                  <button
                    type="button"
                    disabled={resetDailyMutation.isPending}
                    onClick={() => resetDailyMutation.mutate({ id: code.id })}
                    className="inline-flex items-center gap-1 rounded-lg bg-stone-100 px-2.5 py-1.5 text-xs font-bold text-foreground hover:bg-stone-200 disabled:opacity-50"
                    title="تصفير الاستهلاك اليومي لهذا الكود فوراً"
                  >
                    <RotateCcw size={12} />
                    تصفير اليومي
                  </button>
                </div>

                {isEditing && (
                  <div className="mt-3 rounded-xl bg-secondary/50 p-3 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-primary">شحن رصيد إضافي:</span>
                      <input
                        type="number"
                        min="1"
                        value={rechargeAmount}
                        onChange={e => setRechargeAmount(e.target.value)}
                        placeholder="عدد الكريدت"
                        className="w-28 rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs font-bold text-foreground outline-none focus:border-primary"
                      />
                      <button
                        type="button"
                        disabled={rechargeMutation.isPending}
                        onClick={() => handleRecharge(code.id)}
                        className="rounded-lg bg-primary px-3 py-1 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50"
                      >
                        {rechargeMutation.isPending ? 'جارٍ الشحن…' : 'شحن الرصيد'}
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 border-t border-stone-200/50 pt-2">
                      <span className="text-xs font-bold text-primary">تعديل الإجمالي:</span>
                      <input
                        type="number"
                        min="-1"
                        value={editTotalCredits}
                        onChange={e => setEditTotalCredits(e.target.value)}
                        className="w-24 rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs font-bold text-foreground outline-none focus:border-primary"
                      />
                      <span className="text-xs font-bold text-primary">واليومي:</span>
                      <input
                        type="number"
                        min="-1"
                        value={editDailyLimit}
                        onChange={e => setEditDailyLimit(e.target.value)}
                        className="w-20 rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs font-bold text-foreground outline-none focus:border-primary"
                      />
                      <button
                        type="button"
                        disabled={updateLimitsMutation.isPending}
                        onClick={() => handleUpdateLimits(code.id)}
                        className="rounded-lg bg-stone-800 px-3 py-1 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50"
                      >
                        {updateLimitsMutation.isPending ? 'حفظ…' : 'حفظ التعديل'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </article>
        );
      })}
    </div>
  </section>;
}
