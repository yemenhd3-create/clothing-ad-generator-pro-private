// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import UserTemplateSettings from '../client/src/components/UserTemplateSettings';
import { ThemeProvider } from '../client/src/contexts/ThemeContext';
import { createMerchantProfile } from '../shared/merchantAssistant';
import { DEFAULT_TEMPLATE_SETTINGS } from '../shared/types';

vi.mock('../client/src/components/ArtworkCropEditor', async () => {
  const { createElement: h } = await import('react');
  return {
    default: ({ kind, onSave }: { kind: 'logo' | 'footer'; onSave: (value: string) => void }) => h('button', { type: 'button', onClick: () => onSave('data:image/jpeg;base64,user-brand') }, kind === 'logo' ? 'حفظ الشعار في المشروع' : 'حفظ التذييل في المشروع'),
  };
});

describe('طبقات هوية المتجر في الإعدادات', () => {
  beforeEach(() => {
    vi.stubGlobal('Image', class {
      width = 2688;
      height = 494;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_: string) { queueMicrotask(() => this.onload?.()); }
    });
    vi.stubGlobal('FileReader', class {
      result: string | null = 'data:image/jpeg;base64,user-brand';
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsDataURL() { queueMicrotask(() => this.onload?.()); }
    });
    Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:user-banner'), configurable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });
  });

  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('يقبل شعاراً مربعاً ثم تذييل ترند التربية 2688×494 ويحفظهما في الإعدادات', async () => {
    const onChange = vi.fn();
    const { container, rerender } = render(<ThemeProvider switchable><UserTemplateSettings settings={DEFAULT_TEMPLATE_SETTINGS} onChange={onChange} onBack={vi.fn()} onAbout={vi.fn()} /></ThemeProvider>);
    fireEvent.click(screen.getByRole('button', { name: /بيانات المركز والهوية/ }));
    const fileInputs = container.querySelectorAll<HTMLInputElement>('input[type="file"]');
    expect(fileInputs).toHaveLength(2);
    expect(container.textContent).not.toContain('رفع بانر العنوان');
    expect(container.textContent).not.toContain('إطار القالب');

    fireEvent.change(fileInputs[0], { target: { files: [new File(['logo'], 'trend-logo.png', { type: 'image/png' })] } });
    fireEvent.click(await screen.findByRole('button', { name: 'حفظ الشعار في المشروع' }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ showStoreLogo: true, storeLogoArtwork: 'data:image/jpeg;base64,user-brand' })));

    const afterLogo = onChange.mock.calls.at(-1)?.[0];
    rerender(<ThemeProvider switchable><UserTemplateSettings settings={afterLogo} onChange={onChange} onBack={vi.fn()} onAbout={vi.fn()} /></ThemeProvider>);
    fireEvent.change(container.querySelectorAll<HTMLInputElement>('input[type="file"]')[1], { target: { files: [new File(['footer'], 'trend-footer.jpg', { type: 'image/jpeg' })] } });
    fireEvent.click(await screen.findByRole('button', { name: 'حفظ التذييل في المشروع' }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ showFooterArtwork: true, footerArtwork: 'data:image/jpeg;base64,user-brand', showStoreLogo: true })));
  });

  it('يسمح باختيار حتى ثلاث شارات مع تأكيد حفظ واضح للإعدادات', () => {
    const onChange = vi.fn();
    render(<ThemeProvider switchable><UserTemplateSettings settings={DEFAULT_TEMPLATE_SETTINGS} onChange={onChange} onBack={vi.fn()} onAbout={vi.fn()} /></ThemeProvider>);

    fireEvent.click(screen.getByRole('button', { name: /شارات العرض/ }));
    fireEvent.click(screen.getByRole('button', { name: 'جديد' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ badgeTypes: ['new'] }));

    fireEvent.click(screen.getByRole('button', { name: 'حفظ الإعدادات' }));
    expect(screen.getByRole('button', { name: 'تم حفظ الإعدادات على هذا الهاتف' })).toBeTruthy();
  });

  it('يحفظ خلفية الاستديو وظل المنتج كإعدادات محلية اختيارية', () => {
    const onChange = vi.fn();
    const { rerender } = render(<ThemeProvider switchable><UserTemplateSettings settings={DEFAULT_TEMPLATE_SETTINGS} onChange={onChange} onBack={vi.fn()} onAbout={vi.fn()} /></ThemeProvider>);

    fireEvent.click(screen.getByRole('button', { name: /استديو المنتج/ }));
    fireEvent.click(screen.getByRole('button', { name: /دافئ/ }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ productBackdrop: 'warm' }));

    const withWarmBackdrop = onChange.mock.calls.at(-1)?.[0];
    rerender(<ThemeProvider switchable><UserTemplateSettings settings={withWarmBackdrop} onChange={onChange} onBack={vi.fn()} onAbout={vi.fn()} /></ThemeProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'ظل ثابت' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ productBackdrop: 'warm', productShadow: 'grounded' }));
  });

  it('يعرض قائمة اختبار الهاتف المختصرة من المساعدة عند طلبها فقط', () => {
    render(<ThemeProvider switchable><UserTemplateSettings settings={DEFAULT_TEMPLATE_SETTINGS} onChange={vi.fn()} onBack={vi.fn()} onAbout={vi.fn()} /></ThemeProvider>);
    fireEvent.click(screen.getByRole('button', { name: /المساعدة والتطبيق/ }));
    expect(screen.queryByText('جرّب هذه الخطوات الست فقط')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'اختبار الهاتف السريع' }));
    expect(screen.getByText('جرّب هذه الخطوات الست فقط')).toBeTruthy();
    expect(screen.getByText(/2D أصلي ثم 2.5D مرتفع ثم منصة/)).toBeTruthy();
  });

  it('يحفظ بيانات المركز من إعدادات المستخدم ويضع الوضع الليلي في المسار نفسه', () => {
    const onProfileChange = vi.fn();
    const onRestoreNormal = vi.fn();
    render(<ThemeProvider switchable><UserTemplateSettings settings={DEFAULT_TEMPLATE_SETTINGS} onChange={vi.fn()} onBack={vi.fn()} onAbout={vi.fn()} profile={createMerchantProfile()} onProfileChange={onProfileChange} onRestoreNormal={onRestoreNormal} /></ThemeProvider>);
    fireEvent.click(screen.getByRole('button', { name: /بيانات المركز والهوية/ }));
    fireEvent.change(screen.getByLabelText('اسم المركز للنص التسويقي'), { target: { value: 'مركز السعر المناسب' } });
    expect(onProfileChange).toHaveBeenLastCalledWith(expect.objectContaining({ storeName: 'مركز السعر المناسب' }));
    fireEvent.click(screen.getByRole('button', { name: /المساعدة والتطبيق/ }));
    fireEvent.click(screen.getByRole('button', { name: /تفعيل الوضع الليلي/ }));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /استعادة الوضع الطبيعي/ }));
    expect(onRestoreNormal).toHaveBeenCalledTimes(1);
  });
});
