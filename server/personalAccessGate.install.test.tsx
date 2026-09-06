// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ auth: { isAuthenticated: false, loading: false }, query: { isLoading: false, data: undefined as unknown, error: null as unknown, refetch: vi.fn() }, mode: { isLoading: false, data: { registrationOpen: true, offlineGraceHours: 72 }, error: null as unknown } }));
vi.mock('@/_core/hooks/useAuth', () => ({ useAuth: () => state.auth }));
vi.mock('@/const', () => ({ startLogin: vi.fn() }));
vi.mock('@/lib/trpc', () => ({
  trpc: {
    personal: { access: { useQuery: () => state.query }, heartbeat: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) } },
    projectAccess: { mode: { useQuery: () => state.mode } },
    accessCodes: { redeem: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) } },
  },
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

import PersonalAccessGate from '../client/src/components/PersonalAccessGate';

describe('PersonalAccessGate PWA install entry', () => {
  beforeEach(() => {
    Object.defineProperty(window.navigator, 'userAgent', { configurable: true, value: 'Mozilla/5.0 (Android 14; Mobile)' });
  });
  afterEach(() => { cleanup(); state.auth = { isAuthenticated: false, loading: false }; state.query = { isLoading: false, data: undefined, error: null, refetch: vi.fn() }; state.mode = { isLoading: false, data: { registrationOpen: true, offlineGraceHours: 72 }, error: null }; });

  it('offers the phone install path before login, where a user can actually need it', () => {
    render(<PersonalAccessGate><p>محتوى محمي</p></PersonalAccessGate>);
    expect(screen.getByText('دخول إلى المساحة الشخصية')).toBeTruthy();
    expect(screen.getByText('ثبّت مولد الإعلانات على هاتفك')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'عرض خطوات التثبيت' })).toBeTruthy();
  });

  it('يعرض إعادة محاولة واضحة عند تعذر فحص جلسة مستخدم مسجل', () => {
    const refetch = vi.fn();
    state.auth = { isAuthenticated: true, loading: false };
    state.query = { isLoading: false, data: undefined, error: new Error('network unavailable'), refetch };
    render(<PersonalAccessGate><p>محتوى محمي</p></PersonalAccessGate>);
    expect(screen.getByText('تعذر التحقق من الوصول مؤقتاً')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'إعادة التحقق' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
