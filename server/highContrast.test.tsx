// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyHighContrast, loadHighContrast, toggleHighContrast } from '../client/src/lib/highContrast';

import UserTemplateSettings from '../client/src/components/UserTemplateSettings';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), message: vi.fn() } }));

describe('وضع التباين المرتفع', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('high-contrast', 'dark');
    document.documentElement.style.cssText = '';
  });
  afterEach(cleanup);

  it('الوضع الافتراضي متوقف', () => {
    expect(loadHighContrast()).toBe(false);
  });

  it('التفعيل يضيف الصنف والمتغيرات ويُحفظ محلياً', () => {
    applyHighContrast(true);
    expect(document.documentElement.classList.contains('high-contrast')).toBe(true);
    expect(document.documentElement.style.getPropertyValue('--color-muted-foreground')).toBe('oklch(0.34 0.03 285)');
    expect(loadHighContrast()).toBe(true);
  });

  it('الوضع الداكن يستخدم متغيرات أفتح', () => {
    document.documentElement.classList.add('dark');
    applyHighContrast(true);
    expect(document.documentElement.style.getPropertyValue('--color-muted-foreground')).toBe('oklch(0.93 0.01 285)');
  });

  it('الإيقاف يزيل الصنف ويعيد القيم المضمنة السابقة', () => {
    document.documentElement.style.setProperty('--color-muted-foreground', 'oklch(0.77 0.02 285)');
    applyHighContrast(true);
    applyHighContrast(false);
    expect(document.documentElement.classList.contains('high-contrast')).toBe(false);
    expect(document.documentElement.style.getPropertyValue('--color-muted-foreground')).toBe('oklch(0.77 0.02 285)');
    expect(loadHighContrast()).toBe(false);
  });

  it('toggleHighContrast يبدّل الحالة ويعيد الجديدة', () => {
    expect(toggleHighContrast()).toBe(true);
    expect(toggleHighContrast()).toBe(false);
  });
});

describe('بطاقة شاشة أوضح في الإعدادات', () => {
  afterEach(cleanup);
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('high-contrast', 'dark');
    document.documentElement.style.cssText = '';
  });

  function renderSettings() {
    const settings = { size: 'square' } as unknown as Parameters<typeof UserTemplateSettings>[0]['settings'];
    return render(
      <UserTemplateSettings
        settings={settings}
        onChange={() => undefined}
        onBack={() => undefined}
        onAbout={() => undefined}
        onDeveloper={() => undefined}
        profile={{ storeName: '', storePhone: '', storeLocation: '', storeCategory: '' } as unknown as Parameters<typeof UserTemplateSettings>[0]['profile']}
        onProfileChange={() => undefined}
        onRestoreNormal={() => undefined}
        localToolSetup={undefined as unknown as Parameters<typeof UserTemplateSettings>[0]['localToolSetup']}
        onPrepareLocalTools={() => undefined}
      />
    );
  }

  it('تظهر البطاقة ويؤدي المفتاح إلى تفعيل الوضع', () => {
    renderSettings();
    fireEvent.click(screen.getByText('شاشة أوضح'));
    const toggle = screen.getByRole('switch');
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(toggle);
    expect(document.documentElement.classList.contains('high-contrast')).toBe(true);
    expect(loadHighContrast()).toBe(true);
  });
});
