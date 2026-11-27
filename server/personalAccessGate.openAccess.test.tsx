// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  auth: { isAuthenticated: false, loading: false },
  query: { isLoading: false, data: undefined as unknown, error: null as unknown, refetch: vi.fn() },
  mode: { isLoading: false, data: { loginRequired: true, registrationOpen: true, offlineGraceHours: 72 } as Record<string, unknown> },
}));

vi.mock('@/_core/hooks/useAuth', () => ({ useAuth: () => state.auth }));
vi.mock('@/const', () => ({ startLogin: vi.fn() }));
vi.mock('@/lib/trpc', () => ({
  trpc: {
    personal: { access: { useQuery: () => state.query }, heartbeat: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) } },
    projectAccess: { mode: { useQuery: () => state.mode } },
    accessCodes: { redeem: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) } },
  },
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import PersonalAccessGate from '../client/src/components/PersonalAccessGate';

describe('بوابة الدخول المفتوحة (إيقاف رمز الوصول من لوحة المطور)', () => {
  afterEach(() => {
    cleanup();
    state.auth = { isAuthenticated: false, loading: false };
    state.query = { isLoading: false, data: undefined, error: null, refetch: vi.fn() };
    state.mode = { isLoading: false, data: { loginRequired: true, registrationOpen: true, offlineGraceHours: 72 } };
  });

  it('loginRequired=false يدخل الزائر مباشرة دون رمز', () => {
    state.mode.data = { loginRequired: false, registrationOpen: true, offlineGraceHours: 72 };
    render(<PersonalAccessGate><p>محتوى محمي</p></PersonalAccessGate>);
    expect(screen.getByText('محتوى محمي')).toBeTruthy();
    expect(screen.queryByText('دخول إلى المساحة الشخصية')).toBeNull();
  });

  it('loginRequired=true تظهر صفحة الدخول', () => {
    render(<PersonalAccessGate><p>محتوى محمي</p></PersonalAccessGate>);
    expect(screen.getByText('دخول إلى المساحة الشخصية')).toBeTruthy();
    expect(screen.queryByText('محتوى محمي')).toBeNull();
  });

  it('غياب القيمة يبقي البوابة مفعلة (الوضع الآمن)', () => {
    state.mode.data = { registrationOpen: true, offlineGraceHours: 72 };
    render(<PersonalAccessGate><p>محتوى محمي</p></PersonalAccessGate>);
    expect(screen.getByText('دخول إلى المساحة الشخصية')).toBeTruthy();
    expect(screen.queryByText('محتوى محمي')).toBeNull();
  });
});
