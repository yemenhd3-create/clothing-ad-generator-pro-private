import React, { useState } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { trpc } from '@/lib/trpc';

export default function DeveloperAiUsageLogs() {
  const utils = trpc.useUtils();
  const [filterFeature, setFilterFeature] = useState<string>('all');
  const logsQuery = trpc.developer.personal.aiQuota.logs.useQuery({ limit: 50 });

  const featureLabels: Record<string, string> = {
    connected_leader: 'القائد الذكي المتصل',
    marketing_text: 'صياغة النصوص التسويقية',
  };

  const statusLabels: Record<string, { label: string; className: string }> = {
    success: { label: 'نجاح', className: 'bg-emerald-50 text-emerald-700' },
    credits_exhausted: { label: 'نفاد الرصيد', className: 'bg-amber-50 text-amber-800' },
    daily_limit_exceeded: { label: 'تجاوز الحد اليومي', className: 'bg-amber-50 text-amber-800' },
    provider_error: { label: 'خطأ مزود', className: 'bg-red-50 text-red-700' },
  };

  const logs = logsQuery.data ?? [];
  const filteredLogs = logs.filter(log => {
    if (filterFeature !== 'all' && log.feature !== filterFeature) return false;
    return true;
  });

  return (
    <section className="rounded-[28px] bg-white p-5 shadow-[0_12px_30px_rgba(37,35,95,0.06)] sm:p-7">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-primary">
          <Activity size={20} />
          <h3 className="font-black">سجلات استهلاك الذكاء الاصطناعي</h3>
        </div>
        <button
          type="button"
          onClick={() => void utils.developer.personal.aiQuota.logs.invalidate()}
          disabled={logsQuery.isFetching}
          className="inline-flex items-center gap-1 rounded-xl bg-secondary px-3 py-2 text-xs font-bold text-primary disabled:opacity-50"
          title="تحديث السجلات"
        >
          <RefreshCw size={14} className={logsQuery.isFetching ? 'animate-spin' : ''} />
          تحديث
        </button>
      </div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        عرض مباشر لآخر عمليات التوليد والاستهلاك السحابي للحسابات والأكواد.
      </p>

      <div className="mt-4 flex items-center justify-between gap-3">
        <select
          value={filterFeature}
          onChange={e => setFilterFeature(e.target.value)}
          className="h-10 rounded-xl border border-stone-200 bg-white px-3 text-xs font-bold text-primary outline-none focus:border-primary"
          aria-label="تصفية الميزة"
        >
          <option value="all">كل الميزات</option>
          <option value="connected_leader">القائد الذكي المتصل</option>
          <option value="marketing_text">صياغة النصوص</option>
        </select>
        <span className="text-xs font-bold text-muted-foreground">
          {filteredLogs.length} سجل معروض
        </span>
      </div>

      <div className="mt-4 space-y-2">
        {logsQuery.isLoading && <p className="text-sm text-muted-foreground">جارٍ تحميل السجلات…</p>}
        {!logsQuery.isLoading && !filteredLogs.length && (
          <p className="rounded-2xl bg-secondary/70 p-4 text-sm text-muted-foreground">
            لا توجد سجلات استهلاك مسجلة حتى الآن.
          </p>
        )}
        {filteredLogs.map(log => {
          const statusInfo = statusLabels[log.status] ?? {
            label: log.status,
            className: 'bg-secondary text-foreground',
          };
          const featureName = featureLabels[log.feature] || log.feature;
          const dateStr = log.createdAt ? new Date(log.createdAt).toLocaleString('ar-YE', { dateStyle: 'short', timeStyle: 'short' }) : '';

          return (
            <article key={log.id} className="rounded-2xl border border-stone-100 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-foreground text-sm">{featureName}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${statusInfo.className}`}>
                      {statusInfo.label}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    النموذج: <span dir="ltr" className="font-mono">{log.provider}/{log.model}</span>
                    {log.responseTimeMs > 0 && ` · استجابة: ${log.responseTimeMs}ms`}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {log.accessCodeId ? `رمز دخول #${log.accessCodeId}` : log.userId ? `مستخدم #${log.userId}` : 'بدون هوية'}
                    {dateStr && ` · ${dateStr}`}
                  </p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
