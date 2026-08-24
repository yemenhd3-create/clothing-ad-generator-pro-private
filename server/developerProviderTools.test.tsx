// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DeveloperProviderTools from '../client/src/components/DeveloperProviderTools';

const { toastSuccess, toastError, providers } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  providers: [
    { id: 'fast', name: 'مزود سريع', baseUrl: 'https://fast.example/v1', model: 'fast-text', enabled: true, hasApiKey: true },
    { id: 'paused', name: 'مزود مؤقت', baseUrl: 'https://paused.example/v1', model: 'slow-text', enabled: false, hasApiKey: false },
  ],
}));

vi.mock('sonner', () => ({ toast: { success: toastSuccess, error: toastError } }));
vi.mock('../client/src/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({ developer: { providers: { invalidate: vi.fn() } } }),
    developer: {
      providers: {
        list: { useQuery: () => ({ isLoading: false, data: providers }) },
        save: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
        remove: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
        check: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      },
    },
  },
}));

describe('أدوات مزودي لوحة المطور', () => {
  afterEach(() => { cleanup(); toastSuccess.mockClear(); toastError.mockClear(); });

  it('يصفّي المزودين بالبحث والحالة من دون تعديل بياناتهم', () => {
    render(<DeveloperProviderTools onDiagnostic={vi.fn()} />);
    expect(screen.getByText('مزود سريع')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('البحث في المزودين'), { target: { value: 'مؤقت' } });
    expect(screen.queryByText('مزود سريع')).toBeNull();
    expect(screen.getByText('مزود مؤقت')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('تصفية المزودين'), { target: { value: 'enabled' } });
    expect(screen.getByText('لا توجد نتيجة مطابقة. غيّر البحث أو التصفية.')).toBeTruthy();
  });

  it('ينسخ المفتاح المدخل مؤقتاً فقط ويعرض تأكيد نجاح', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<DeveloperProviderTools onDiagnostic={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('مفتاح API للمزود'), { target: { value: 'secret-temporary-value' } });
    fireEvent.click(screen.getByRole('button', { name: 'نسخ المفتاح المؤقت' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('secret-temporary-value'));
    expect(toastSuccess).toHaveBeenCalledWith(expect.stringContaining('تم نسخ المفتاح المؤقت'));
  });
});
