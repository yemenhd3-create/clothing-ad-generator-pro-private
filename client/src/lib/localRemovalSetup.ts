import type { LocalRemovalStage } from './localBackgroundRemoval';

export type LocalToolSetupStatus = 'checking' | 'preparing' | 'success' | 'ready' | 'failed';

export type LocalToolSetupState = {
  status: LocalToolSetupStatus;
  progress: number;
  label: string;
};

export const LOCAL_TOOL_READY_KEY = 'clothing-ad-local-tools-ready-v1';

export function createLocalToolSetupState(status: LocalToolSetupStatus): LocalToolSetupState {
  if (status === 'ready') return { status, progress: 100, label: 'الأدوات جاهزة على هذا الهاتف.' };
  if (status === 'success') return { status, progress: 100, label: 'تم تجهيز الأدوات بنجاح.' };
  if (status === 'failed') return { status, progress: 0, label: 'تعذر تجهيز أدوات إزالة الخلفية.' };
  if (status === 'preparing') return { status, progress: 8, label: 'نجهز أدوات إزالة الخلفية محلياً…' };
  return { status, progress: 0, label: 'نتحقق من أدوات إزالة الخلفية…' };
}

export function localToolSetupStateForStage(stage: LocalRemovalStage): LocalToolSetupState {
  if (stage === 'downloading') return { status: 'preparing', progress: 32, label: 'نجهز نموذج إزالة الخلفية…' };
  if (stage === 'loading') return { status: 'preparing', progress: 72, label: 'نشغّل أدوات المعالجة المحلية…' };
  if (stage === 'processing') return { status: 'preparing', progress: 88, label: 'نتأكد من جاهزية المعالجة…' };
  return { status: 'preparing', progress: 94, label: 'نُنهي تجهيز الأدوات…' };
}
