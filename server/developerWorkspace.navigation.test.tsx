// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DeveloperWorkspace from '../client/src/components/DeveloperWorkspace';
import { ThemeProvider } from '../client/src/contexts/ThemeContext';

const invalidate = vi.fn();

vi.mock('../client/src/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({ developer: { status: { invalidate }, providers: { invalidate } } }),
    developer: {
      status: { useQuery: () => ({ data: { authenticated: true } }) },
      providers: {
        list: { useQuery: () => ({ isLoading: false, data: [] }) },
        save: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
        remove: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
        check: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      },
      logout: { useMutation: () => ({ mutate: vi.fn() }) },
      login: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}));

describe('تنقل لوحة المطور الموحدة', () => {
  afterEach(() => { cleanup(); localStorage.clear(); document.documentElement.classList.remove('dark'); });

  it('يبدأ بالرئيسية ويتيح الوصول المباشر إلى المزودين والنظام', async () => {
    render(<ThemeProvider switchable><DeveloperWorkspace onBack={vi.fn()} /></ThemeProvider>);

    expect(screen.getByText('كل صلاحيات المطور هنا')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'المزودون' }));
    expect(await screen.findByText('إضافة مزود جديد')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'النظام' }));
    expect(screen.getByText('السجل التشخيصي')).toBeTruthy();
  });

  it('يبقي قسم النظام مخصصاً للسجل ولا يظهر تحكم مظهر المستخدم', async () => {
    render(<ThemeProvider switchable><DeveloperWorkspace onBack={vi.fn()} /></ThemeProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'النظام' }));
    await waitFor(() => expect(screen.getByText('السجل التشخيصي')).toBeTruthy());
    expect(screen.queryByRole('button', { name: /الوضع الليلي/ })).toBeNull();
  });
});
