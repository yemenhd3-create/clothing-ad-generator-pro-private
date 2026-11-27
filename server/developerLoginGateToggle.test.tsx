// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const setLoginRequiredMutate = vi.fn();
const invalidate = vi.fn();

const state = vi.hoisted(() => ({
  accessSettings: { loginRequired: true, registrationOpen: true, offlineGraceHours: 72 } as Record<string, unknown>,
}));

vi.mock('../client/src/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({
      developer: { personal: { announcements: { invalidate }, messages: { invalidate }, users: { invalidate }, accessSettings: { invalidate } } },
      projectAccess: { mode: { invalidate } },
    }),
    developer: {
      personal: {
        announcements: { useQuery: () => ({ data: [], isLoading: false }) },
        messages: { useQuery: () => ({ data: [], isLoading: false }) },
        users: { useQuery: () => ({ data: [], isLoading: false }) },
        accessSettings: { useQuery: () => ({ data: state.accessSettings, isLoading: false }) },
        saveAnnouncement: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
        updateMessageStatus: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
        setUserAccess: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
        setLoginRequired: { useMutation: () => ({ mutate: setLoginRequiredMutate, isPending: false }) },
        setRegistrationOpen: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
        setOfflineGraceHours: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      },
    },
  },
}));

vi.mock('../client/src/components/Modal', () => ({
  default: ({ isOpen, title, children, footer }: { isOpen: boolean; title?: React.ReactNode; children?: React.ReactNode; footer?: React.ReactNode }) =>
    isOpen ? <div><h2>{title}</h2><div>{children}</div><div>{footer}</div></div> : null,
}));
vi.mock('../client/src/components/DeveloperAccessCodes', () => ({ default: () => <div>رموز الدخول</div> }));
vi.mock('../client/src/components/DeveloperAiUsageLogs', () => ({ default: () => <div>سجل الاستخدام</div> }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import DeveloperPersonalConsole from '../client/src/components/DeveloperPersonalConsole';

describe('مفتاح بوابة الدخول في لوحة المطور', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    state.accessSettings = { loginRequired: true, registrationOpen: true, offlineGraceHours: 72 };
  });

  it('إيقاف البوابة يتطلب تأكيداً أولاً', () => {
    render(<DeveloperPersonalConsole />);
    const toggle = screen.getAllByRole('switch')[0];
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(toggle);
    expect(setLoginRequiredMutate).not.toHaveBeenCalled();
    expect(screen.getByText('إيقاف بوابة الدخول')).toBeTruthy();
    fireEvent.click(screen.getByText('إيقاف البوابة'));
    expect(setLoginRequiredMutate).toHaveBeenCalledWith({ loginRequired: false });
  });

  it('تشغيل البوابة لا يحتاج تأكيداً', () => {
    state.accessSettings = { loginRequired: false, registrationOpen: false, offlineGraceHours: 72 };
    render(<DeveloperPersonalConsole />);
    const toggle = screen.getAllByRole('switch')[0];
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(toggle);
    expect(setLoginRequiredMutate).toHaveBeenCalledWith({ loginRequired: true });
  });
});
