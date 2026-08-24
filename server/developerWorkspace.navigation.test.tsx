// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DeveloperWorkspace from '../client/src/components/DeveloperWorkspace';

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
  afterEach(() => cleanup());

  it('يبدأ بالرئيسية ويتيح الوصول المباشر إلى المزودين والنظام', async () => {
    render(<DeveloperWorkspace onBack={vi.fn()} />);

    expect(screen.getByText('كل صلاحيات المطور هنا')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'المزودون' }));
    expect(await screen.findByText('إضافة مزود جديد')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'النظام' }));
    expect(screen.getByText('السجل التشخيصي')).toBeTruthy();
  });
});
