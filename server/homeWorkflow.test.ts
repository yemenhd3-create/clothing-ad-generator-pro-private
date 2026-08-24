// @vitest-environment jsdom
import { createElement } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_AD_DETAILS, DEFAULT_TEMPLATE_SETTINGS, StorageKeys, type AdDetails, type TemplateSettings } from '../shared/types';

const mutateAsync = vi.fn();
const removeBackgroundMutateAsync = vi.fn();
const renderAd = vi.fn();
const removeFromStorage = vi.fn();
const removeBackgroundLocally = vi.fn();
const prewarmLocalBackgroundRemoval = vi.fn().mockResolvedValue(undefined);
const inspectRenderedPixelTruth = vi.fn();
let savedTemplateSettings: TemplateSettings | undefined;
let savedAdDetails: AdDetails | undefined;

vi.mock('../client/src/lib/trpc', () => ({
  trpc: {
    tryOn: {
      run: { useMutation: () => ({ mutateAsync }) },
      removeBackground: { useMutation: () => ({ mutateAsync: removeBackgroundMutateAsync }) },
    },
    marketingText: { generate: { useMutation: () => ({ mutateAsync: vi.fn() }) } },
    leader: { connected: { useMutation: () => ({ mutateAsync: vi.fn() }) } },
    personal: { announcement: { useQuery: () => ({ data: null }) } },
  },
}));
vi.mock('../client/src/lib/canvasRenderer', () => ({ renderAd }));
vi.mock('../client/src/lib/localBackgroundRemoval', () => ({ removeBackgroundLocally, prewarmLocalBackgroundRemoval }));
vi.mock('../client/src/lib/pixelTruthGate', async () => {
  const actual = await vi.importActual<typeof import('../client/src/lib/pixelTruthGate')>('../client/src/lib/pixelTruthGate');
  return { ...actual, inspectRenderedPixelTruth };
});
vi.mock('../client/src/lib/storage', () => ({
  getFromStorage: (key: string) => {
    if (key === StorageKeys.TEMPLATE_SETTINGS) return savedTemplateSettings;
    if (key === StorageKeys.LAST_AD_DETAILS) return savedAdDetails;
    return undefined;
  },
  saveToStorage: vi.fn(),
  removeFromStorage,
}));
vi.mock('../client/src/components/ImageUploader', async () => {
  const { createElement: h } = await import('react');
  return {
    default: ({ onImageSelect }: { onImageSelect: (url: string) => void }) => h('button', { type: 'button', onClick: () => onImageSelect('blob:transparent-garment') }, 'رفع صورة اختبار'),
  };
});
vi.mock('../client/src/components/AdDetailsForm', async () => {
  const { createElement: h } = await import('react');
  return { default: () => h('div', null, 'نموذج بيانات الاختبار') };
});
vi.mock('../client/src/components/AIChatBox', async () => {
  const { createElement: h } = await import('react');
  return { AIChatBox: () => h('div', null, 'واجهة محادثة المساعد المحلية') };
});
vi.mock('../client/src/components/ArtworkCropEditor', async () => {
  const { createElement: h } = await import('react');
  return {
    default: ({ kind, onSave }: { kind: 'logo' | 'footer'; onSave: (value: string) => void }) => h('button', { type: 'button', onClick: () => onSave('data:image/jpeg;base64,trend-brand') }, kind === 'logo' ? 'حفظ الشعار في المشروع' : 'حفظ التذييل في المشروع'),
  };
});

const { default: Home } = await import('../client/src/pages/Home');

describe('Home Try-On workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    savedTemplateSettings = undefined;
    savedAdDetails = undefined;
    localStorage.clear();
    renderAd.mockResolvedValue('blob:final-ad');
    removeBackgroundLocally.mockResolvedValue({ imageUrl: 'blob:transparent-garment', timing: { sessionMs: 0, sourcePreparationMs: 20, inferenceMs: 600, finishingMs: 50, totalMs: 670 } });
    inspectRenderedPixelTruth.mockResolvedValue({ version: 1, status: 'pass', checks: [], repairs: [], sampledWidth: 1080, sampledHeight: 1350, privacy: { networkUsed: false, includedImage: false, includedPersonalFields: false } });
    removeBackgroundMutateAsync.mockRejectedValue(new Error('لا يوجد مزود إزالة خلفية مفعّل'));
    Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:prepared-tryon'), configurable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });
    vi.stubGlobal('confirm', vi.fn(() => true));
    vi.stubGlobal('fetch', vi.fn((url: string | URL | Request) => {
      const target = typeof url === 'string' ? url : url.toString();
      if (target === 'blob:transparent-garment') return Promise.resolve({ ok: true, blob: async () => new Blob(['product'], { type: 'image/png' }) });
      if (target === '/manus-storage/tryon-result.png' || target === '/manus-storage/raw-cutout.png') return Promise.resolve({ ok: true, blob: async () => new Blob(['tryon'], { type: 'image/png' }) });
      if (target === 'blob:final-ad') return Promise.resolve({ ok: true, blob: async () => new Blob(['advertisement'], { type: 'image/png' }) });
      if (target === 'blob:repaired-ad') return Promise.resolve({ ok: true, blob: async () => new Blob(['repaired advertisement'], { type: 'image/png' }) });
      return Promise.reject(new Error(`Unexpected URL: ${target}`));
    }));
  });

  afterEach(() => cleanup());

  it('يعرض وصولاً مباشراً إلى إعدادات الإعلان ولوحة المطور من أيقونة الرأس', async () => {
    render(createElement(Home));

    fireEvent.click(screen.getByRole('button', { name: 'الإعدادات والوصول للمطور' }));

    expect(await screen.findByRole('button', { name: 'إعدادات الإعلان' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'لوحة المطور' })).toBeTruthy();
  });

  async function startGeneration() {
    render(createElement(Home));
    fireEvent.click(screen.getByRole('button', { name: 'رفع صورة اختبار' }));
    await screen.findByRole('button', { name: 'متابعة إلى بيانات الإعلان' });
    fireEvent.click(screen.getByRole('button', { name: 'متابعة إلى بيانات الإعلان' }));
    await screen.findByRole('button', { name: 'إنشاء الإعلان' });
    fireEvent.click(screen.getByRole('button', { name: 'إنشاء الإعلان' }));
  }

  it('يعرض مراجعة الصورة قبل فتح بيانات الإعلان ويواصل التدفق بعد تأكيد المستخدم', async () => {
    render(createElement(Home));
    fireEvent.click(screen.getByRole('button', { name: 'رفع صورة اختبار' }));

    expect(await screen.findByText('راجع الصورة قبل المتابعة')).toBeTruthy();
    expect(screen.queryByText('نموذج بيانات الاختبار')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'متابعة إلى بيانات الإعلان' }));
    expect(await screen.findByText('نموذج بيانات الاختبار')).toBeTruthy();
  });

  it('يهيّئ محرك الإزالة محلياً بعد اختيار الصورة بدلاً من تأخير التنزيل إلى زر الإنشاء', async () => {
    vi.stubGlobal('requestIdleCallback', (callback: () => void) => {
      callback();
      return 1;
    });
    render(createElement(Home));

    fireEvent.click(screen.getByRole('button', { name: 'رفع صورة اختبار' }));

    await waitFor(() => expect(prewarmLocalBackgroundRemoval).toHaveBeenCalledOnce());
  });

  it('يستخدم إزالة الخلفية المحلية تلقائياً قبل اللجوء إلى أي مسار بديل', async () => {
    removeBackgroundLocally.mockResolvedValueOnce({ imageUrl: 'blob:transparent-garment', timing: { sessionMs: 0, sourcePreparationMs: 20, inferenceMs: 600, finishingMs: 50, totalMs: 670 } });

    await startGeneration();

    await screen.findByText('تمت إزالة الخلفية محلياً خلال أقل من ثانية. لم تُرسل الصورة إلى أي خدمة خارجية.');
    expect(renderAd).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'blob:transparent-garment', expect.objectContaining({ visualMode: 'garment' }));
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('يعرض فشل الإزالة المحلية مباشرة ولا يطلب أي مزود خارجي', async () => {
    removeBackgroundLocally.mockRejectedValueOnce(new Error('LOCAL_REMOVAL_UNAVAILABLE'));
    await startGeneration();
    expect(await screen.findByText(/تعذّرت إزالة الخلفية محلياً/)).toBeTruthy();
    expect(renderAd).not.toHaveBeenCalled();
    expect(mutateAsync).not.toHaveBeenCalled();
    expect(removeBackgroundMutateAsync).not.toHaveBeenCalled();
  });

  it('يمرر الشعار وتذييل المتجر الكامل المحفوظين إلى معاينة الإعلان النهائية', async () => {
    savedTemplateSettings = {
      ...DEFAULT_TEMPLATE_SETTINGS,
      showFooterArtwork: true,
      footerArtwork: 'data:image/png;base64,footer',
      showStoreLogo: true,
      storeLogoArtwork: 'data:image/png;base64,logo',
    };
    mutateAsync.mockRejectedValue(new Error('لا يوجد مزود مفعّل'));

    await startGeneration();

    await waitFor(() => expect(renderAd).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ showFooterArtwork: true, footerArtwork: 'data:image/png;base64,footer', showStoreLogo: true, storeLogoArtwork: 'data:image/png;base64,logo' }),
      'blob:transparent-garment',
      expect.anything()
    ));
  });

  it('يُظهر بيانات المسودة المستعادة ويتيح بدء بيانات جديدة من دون حذف إعدادات القالب', async () => {
    savedAdDetails = { ...DEFAULT_AD_DETAILS, productName: 'فستان محفوظ', storeName: 'متجر محفوظ' };
    render(createElement(Home));

    expect(await screen.findByText('استعدنا بيانات آخر مسودة')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'بدء جديد' }));

    expect(removeFromStorage).toHaveBeenCalledWith(StorageKeys.LAST_AD_DETAILS);
    await waitFor(() => expect(screen.queryByText('استعدنا بيانات آخر مسودة')).toBeNull());
  });

  it('يسمح بالعودة إلى مرحلة مكتملة من شريط المراحل من دون القفز إلى مرحلة ناقصة', async () => {
    render(createElement(Home));
    fireEvent.click(screen.getByRole('button', { name: 'رفع صورة اختبار' }));
    fireEvent.click(await screen.findByRole('button', { name: 'متابعة إلى بيانات الإعلان' }));
    await screen.findByText('نموذج بيانات الاختبار');

    fireEvent.click(screen.getByRole('button', { name: 'رفع الملابس' }));
    expect(await screen.findByRole('button', { name: 'رفع صورة اختبار' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /الإعلان جاهز/ }).disabled).toBe(true);
  });

  it('يفتح تبويبة القائد الذكي من التنقل السفلي من دون استدعاء أي مزود سحابي', async () => {
    render(createElement(Home));

    fireEvent.click(screen.getByRole('button', { name: 'القائد' }));

    expect(await screen.findByText('القائد الذكي')).toBeTruthy();
    expect(screen.getByText(/مرحباً! أنا القائد المحلي/)).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'رد على القائد المحلي' })).toBeTruthy();
    expect(mutateAsync).not.toHaveBeenCalled();
    expect(removeBackgroundMutateAsync).not.toHaveBeenCalled();
  });

  it('يحمل شعاراً وتذييلاً كاملاً من الإعدادات ثم يستخدمهما في الإعلان النهائي في التدفق نفسه', async () => {
    vi.stubGlobal('Image', class {
      width = 2688;
      height = 494;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_: string) { queueMicrotask(() => this.onload?.()); }
    });
    vi.stubGlobal('FileReader', class {
      result: string | null = 'data:image/jpeg;base64,trend-brand';
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsDataURL() { queueMicrotask(() => this.onload?.()); }
    });
    mutateAsync.mockRejectedValue(new Error('لا يوجد مزود مفعّل'));
    render(createElement(Home));

    fireEvent.click(screen.getAllByRole('button', { name: 'الإعدادات' })[0]);
    await screen.findByText('عدّل شكل الإعلان عند الحاجة');
    fireEvent.click(screen.getByRole('button', { name: /بيانات المركز والهوية/ }));
    const inputs = document.querySelectorAll<HTMLInputElement>('input[type="file"]');
    fireEvent.change(inputs[0], { target: { files: [new File(['logo'], 'trend-logo.png', { type: 'image/png' })] } });
    fireEvent.click(await screen.findByRole('button', { name: 'حفظ الشعار في المشروع' }));
    await screen.findByAltText('معاينة شعار المتجر');
    fireEvent.change(document.querySelectorAll<HTMLInputElement>('input[type="file"]')[1], { target: { files: [new File(['footer'], 'trend-footer.jpg', { type: 'image/jpeg' })] } });
    fireEvent.click(await screen.findByRole('button', { name: 'حفظ التذييل في المشروع' }));
    await screen.findByAltText('معاينة تذييل المتجر الكامل');
    fireEvent.click(screen.getByRole('button', { name: 'العودة إلى الإنشاء' }));
    fireEvent.click(screen.getByRole('button', { name: 'رفع صورة اختبار' }));
    fireEvent.click(await screen.findByRole('button', { name: 'متابعة إلى بيانات الإعلان' }));
    await screen.findByRole('button', { name: 'إنشاء الإعلان' });
    fireEvent.click(screen.getByRole('button', { name: 'إنشاء الإعلان' }));

    await waitFor(() => expect(renderAd).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ showFooterArtwork: true, footerArtwork: 'data:image/jpeg;base64,trend-brand', showStoreLogo: true, storeLogoArtwork: 'data:image/jpeg;base64,trend-brand' }),
      'blob:transparent-garment',
      expect.anything()
    ));
  });

  it('يبقي مدخل لوحة المطور المحمية متاحاً من الإعدادات في التطبيق الكامل', async () => {
    render(createElement(Home));
    fireEvent.click(screen.getAllByRole('button', { name: 'الإعدادات' })[0]);
    await screen.findByText('عدّل شكل الإعلان عند الحاجة');
    fireEvent.click(screen.getByRole('button', { name: /المساعدة والتطبيق/ }));
    expect(await screen.findByRole('button', { name: 'فتح لوحة المطور المحمية' })).toBeTruthy();
  });

  it('يعيد توليد الإعلان النهائي بإعدادات القالب المعدلة من دون تكرار طلب Try-On', async () => {
    mutateAsync.mockRejectedValue(new Error('لا يوجد مزود مفعّل'));
    await startGeneration();
    await screen.findByRole('button', { name: 'إعادة توليد بالتغييرات الجديدة' });
    const requestsBefore = mutateAsync.mock.calls.length;

    fireEvent.click(screen.getAllByRole('button', { name: 'الإعدادات' })[0]);
    fireEvent.click(await screen.findByRole('button', { name: /شارات العرض/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'بدون' }));
    fireEvent.click(screen.getByRole('button', { name: 'العودة إلى الإنشاء' }));
    renderAd.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'إعادة توليد بالتغييرات الجديدة' }));

    await waitFor(() => expect(renderAd).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ badgeType: 'none', badgeTypes: [] }),
      'blob:transparent-garment',
      expect.anything()
    ));
    expect(mutateAsync.mock.calls).toHaveLength(requestsBefore);
  });

  it('يعرض تحكم حجم المنتج ويعيد رسم الإعلان محلياً عند التكبير من دون إعادة إزالة الخلفية', async () => {
    await startGeneration();
    await screen.findByLabelText('حجم المنتج داخل الإعلان');
    renderAd.mockClear();
    const removalCallsBefore = removeBackgroundLocally.mock.calls.length;

    fireEvent.click(screen.getByRole('button', { name: 'أكبر' }));

    await waitFor(() => expect(renderAd).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ productScale: .96 }),
      'blob:transparent-garment',
      expect.objectContaining({ visualMode: 'garment' })
    ));
    expect(removeBackgroundLocally.mock.calls).toHaveLength(removalCallsBefore);
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('lets the user return to editing and clear the completed advertising session', async () => {
    mutateAsync.mockRejectedValue(new Error('لا يوجد مزود مفعّل'));
    await startGeneration();

    await screen.findByRole('button', { name: 'تعديل' });
    fireEvent.click(screen.getAllByRole('button', { name: 'تعديل' })[0]);
    expect(screen.getByText('نموذج بيانات الاختبار')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /إنشاء الإعلان/ }));
    await screen.findByRole('button', { name: /مسح جلسة الإعلان/ });
    fireEvent.click(screen.getByRole('button', { name: /مسح جلسة الإعلان/ }));

    expect(await screen.findByRole('button', { name: 'رفع صورة اختبار' })).toBeTruthy();
    expect(removeFromStorage).toHaveBeenCalled();
  });

  it('keeps the completed advertisement editable after system share or WhatsApp handoff', async () => {
    mutateAsync.mockRejectedValue(new Error('لا يوجد مزود مفعّل'));
    await startGeneration();
    await screen.findByRole('button', { name: 'مشاركة أخرى' });

    const nativeShare = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { configurable: true, value: nativeShare });
    fireEvent.click(screen.getByRole('button', { name: 'مشاركة أخرى' }));
    await waitFor(() => expect(nativeShare).toHaveBeenCalled());
    fireEvent.click(screen.getAllByRole('button', { name: 'تعديل' })[0]);
    expect(screen.getByText('نموذج بيانات الاختبار')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /إنشاء الإعلان/ }));
    await screen.findByRole('button', { name: 'مشاركة عبر WhatsApp' });
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    const openWindow = vi.spyOn(window, 'open').mockImplementation(() => null);
    fireEvent.click(screen.getByRole('button', { name: 'مشاركة عبر WhatsApp' }));
    await waitFor(() => expect(openWindow).toHaveBeenCalled());
    fireEvent.click(screen.getAllByRole('button', { name: 'تعديل' })[0]);
    expect(screen.getByText('نموذج بيانات الاختبار')).toBeTruthy();
  });

  it('يعيد رسم العنوان ويعيد فحصه قبل قبول الإصلاح ثم يعيد الأصل عند التراجع', async () => {
    const headerBlock = { version: 1, status: 'block', checks: [{ id: 'header', status: 'block', contrastRatio: 1, foregroundCoverage: 0, detail: 'عنوان غير مقروء' }], repairs: [{ id: 'restore-readable-background', title: 'استعادة خلفية عنوان مقروءة', detail: 'إصلاح العنوان', affectedElements: ['header'] }], sampledWidth: 1080, sampledHeight: 1350, privacy: { networkUsed: false, includedImage: false, includedPersonalFields: false } };
    const visualPass = { version: 1, status: 'pass', checks: [{ id: 'header', status: 'pass', contrastRatio: 9, foregroundCoverage: .04, detail: 'عنوان مقروء' }], repairs: [], sampledWidth: 1080, sampledHeight: 1350, privacy: { networkUsed: false, includedImage: false, includedPersonalFields: false } };
    renderAd.mockReset().mockResolvedValueOnce('blob:final-ad').mockResolvedValueOnce('blob:repaired-ad');
    inspectRenderedPixelTruth.mockReset().mockResolvedValueOnce(headerBlock).mockResolvedValueOnce(visualPass);

    await startGeneration();
    fireEvent.click(await screen.findByRole('button', { name: 'استعادة خلفية عنوان مقروءة' }));

    await screen.findByText('نجح إصلاح العنوان: أُعيد الرسم والفحص قبل إتاحة التصدير.');
    expect(renderAd).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ smartBackgroundColor: '#FFFFFF' }), 'blob:transparent-garment', expect.anything());
    expect(inspectRenderedPixelTruth).toHaveBeenCalledTimes(2);

    const repairStatus = screen.getByText('نجح إصلاح العنوان: أُعيد الرسم والفحص قبل إتاحة التصدير.').parentElement;
    fireEvent.click(repairStatus!.querySelector('button')!);
    expect(await screen.findByText('أعيدت إعدادات الإعلان والصورة الأصلية قبل إصلاح العنوان.')).toBeTruthy();
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it('يبقي الإعلان الأصلي محجوباً عندما تفشل إعادة فحص إصلاح العنوان', async () => {
    const headerBlock = { version: 1, status: 'block', checks: [{ id: 'header', status: 'block', contrastRatio: 1, foregroundCoverage: 0, detail: 'عنوان غير مقروء' }], repairs: [{ id: 'restore-readable-background', title: 'استعادة خلفية عنوان مقروءة', detail: 'إصلاح العنوان', affectedElements: ['header'] }], sampledWidth: 1080, sampledHeight: 1350, privacy: { networkUsed: false, includedImage: false, includedPersonalFields: false } };
    renderAd.mockReset().mockResolvedValueOnce('blob:final-ad').mockResolvedValueOnce('blob:repaired-ad');
    inspectRenderedPixelTruth.mockReset().mockResolvedValueOnce(headerBlock).mockResolvedValueOnce(headerBlock);

    await startGeneration();
    fireEvent.click(await screen.findByRole('button', { name: 'استعادة خلفية عنوان مقروءة' }));

    expect(await screen.findByText('لم ينجح إصلاح العنوان؛ أبقينا الإعلان الأصلي والتصدير محجوباً.')).toBeTruthy();
    expect(renderAd).toHaveBeenCalledTimes(2);
    const repairStatus = screen.getByText('لم ينجح إصلاح العنوان؛ أبقينا الإعلان الأصلي والتصدير محجوباً.').parentElement;
    expect(repairStatus?.querySelector('button')).toBeNull();
  });

  it.each(['portrait', 'square', 'story', 'whatsapp', 'landscape'] as const)('يعيد رسم إصلاح العنوان للمقاس %s عبر المسار نفسه', async size => {
    const headerBlock = { version: 1, status: 'block', checks: [{ id: 'header', status: 'block', contrastRatio: 1, foregroundCoverage: 0, detail: 'عنوان غير مقروء' }], repairs: [{ id: 'restore-readable-background', title: 'استعادة خلفية عنوان مقروءة', detail: 'إصلاح العنوان', affectedElements: ['header'] }], sampledWidth: 1080, sampledHeight: 1350, privacy: { networkUsed: false, includedImage: false, includedPersonalFields: false } };
    const visualPass = { version: 1, status: 'pass', checks: [{ id: 'header', status: 'pass', contrastRatio: 9, foregroundCoverage: .04, detail: 'عنوان مقروء' }], repairs: [], sampledWidth: 1080, sampledHeight: 1350, privacy: { networkUsed: false, includedImage: false, includedPersonalFields: false } };
    savedTemplateSettings = { ...DEFAULT_TEMPLATE_SETTINGS, size };
    renderAd.mockReset().mockResolvedValueOnce('blob:final-ad').mockResolvedValueOnce('blob:repaired-ad');
    inspectRenderedPixelTruth.mockReset().mockResolvedValueOnce(headerBlock).mockResolvedValueOnce(visualPass);

    await startGeneration();
    fireEvent.click(await screen.findByRole('button', { name: 'استعادة خلفية عنوان مقروءة' }));

    await screen.findByText('نجح إصلاح العنوان: أُعيد الرسم والفحص قبل إتاحة التصدير.');
    expect(renderAd).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ size, smartBackgroundColor: '#FFFFFF' }), 'blob:transparent-garment', expect.anything());
  });
});
