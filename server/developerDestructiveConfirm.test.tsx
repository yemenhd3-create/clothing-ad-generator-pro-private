// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ConfirmDestructiveModal from '../client/src/components/ConfirmDestructiveModal';
import DeveloperProviderTools from '../client/src/components/DeveloperProviderTools';

vi.mock('../client/src/components/Modal', () => ({
  default: ({ isOpen, title, children, footer }: { isOpen: boolean; title?: React.ReactNode; children?: React.ReactNode; footer?: React.ReactNode }) =>
    isOpen ? <div><h2>{title}</h2><div>{children}</div><div>{footer}</div></div> : null,
}));

const removeMutate = vi.fn();
const saveMutate = vi.fn();
const checkMutate = vi.fn();
const resetCooldownMutate = vi.fn();
const clearAllCooldownsMutate = vi.fn();

const provider = {
  id: 'd26bb412-9f8b-4e66-b3a6-d8b60f833aa0',
  name: 'مزود تجريبي',
  baseUrl: 'https://api.example.com/v1',
  model: 'try-on',
  enabled: true,
  hasApiKey: true,
  updatedAt: 1,
};

vi.mock('../client/src/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({ developer: { providers: { invalidate: vi.fn(), cooldowns: { invalidate: vi.fn() } } } }),
    developer: {
      providers: {
        list: { useQuery: () => ({ data: [provider], isLoading: false }) },
        cooldowns: { useQuery: () => ({ data: {}, isLoading: false }) },
        save: { useMutation: () => ({ mutate: saveMutate, isPending: false }) },
        remove: { useMutation: () => ({ mutate: removeMutate, isPending: false }) },
        check: { useMutation: () => ({ mutate: checkMutate, isPending: false }) },
        resetCooldown: { useMutation: () => ({ mutate: resetCooldownMutate, isPending: false }) },
        clearAllCooldowns: { useMutation: () => ({ mutate: clearAllCooldownsMutate, isPending: false }) },
      },
    },
  },
}));

describe('نافذة تأكيد الإجراءات الحساسة', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('تعرض العنوان والوصف وتستدعي التأكيد والتراجع', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(
      <ConfirmDestructiveModal
        isOpen
        title="حذف المزود"
        description="سيُحذف نهائياً. هل أنت متأكد؟"
        confirmLabel="حذف نهائي"
        onConfirm={onConfirm}
        onClose={onClose}
      />,
    );
    expect(screen.getByText('حذف المزود')).toBeTruthy();
    fireEvent.click(screen.getByText('حذف نهائي'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('تراجع'));
    expect(onClose).toHaveBeenCalled();
  });

  it('لا تُظهر شيئاً وهي مغلقة', () => {
    render(<ConfirmDestructiveModal isOpen={false} title="حذف المزود" description="وصف" onConfirm={() => undefined} onClose={() => undefined} />);
    expect(screen.queryByText('حذف المزود')).toBeNull();
  });
});

describe('حذف المزود من لوحة المطور يتطلب تأكيداً', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('ضغطة الحذف تفتح التأكيد ولا تحذف مباشرة', () => {
    render(<DeveloperProviderTools onDiagnostic={() => undefined} />);
    fireEvent.click(screen.getByLabelText('حذف مزود تجريبي'));
    expect(removeMutate).not.toHaveBeenCalled();
    expect(screen.getByText('حذف المزود')).toBeTruthy();
  });

  it('التراجع يغلق النافذة دون حذف', () => {
    render(<DeveloperProviderTools onDiagnostic={() => undefined} />);
    fireEvent.click(screen.getByLabelText('حذف مزود تجريبي'));
    fireEvent.click(screen.getByText('تراجع'));
    expect(removeMutate).not.toHaveBeenCalled();
    expect(screen.queryByText('حذف نهائي')).toBeNull();
  });

  it('التأكيد هو الذي ينفذ الحذف', () => {
    render(<DeveloperProviderTools onDiagnostic={() => undefined} />);
    fireEvent.click(screen.getByLabelText('حذف مزود تجريبي'));
    fireEvent.click(screen.getByText('حذف نهائي'));
    expect(removeMutate).toHaveBeenCalledWith({ id: provider.id });
  });
});
