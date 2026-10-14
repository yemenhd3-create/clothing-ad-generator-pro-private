// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DeveloperAiUsageLogs from '../client/src/components/DeveloperAiUsageLogs';
import DeveloperAccessCodes from '../client/src/components/DeveloperAccessCodes';

const { toastSuccess, toastError, rechargeMock, resetDailyMock, updateLimitsMock } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  rechargeMock: vi.fn(),
  resetDailyMock: vi.fn(),
  updateLimitsMock: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: { success: toastSuccess, error: toastError } }));

const sampleCodes = [
  {
    id: 101,
    label: 'كود تجربة متجر النخبة',
    expiresAt: null,
    maxUses: 5,
    useCount: 2,
    isRevoked: 0,
    aiCreditsTotal: 100,
    aiCreditsUsed: 15,
    aiDailyLimit: 20,
    aiDailyUsed: 4,
    aiDailyResetAt: new Date(),
    createdAt: new Date(),
    lastUsedAt: new Date(),
  },
];

const sampleLogs = [
  {
    id: 1,
    userId: 10,
    accessCodeId: 101,
    feature: 'connected_leader',
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    status: 'success',
    responseTimeMs: 350,
    createdAt: new Date('2026-10-13T12:00:00Z'),
  },
  {
    id: 2,
    userId: 11,
    accessCodeId: null,
    feature: 'marketing_text',
    provider: 'local',
    model: 'local-preset',
    status: 'daily_limit_exceeded',
    responseTimeMs: 50,
    createdAt: new Date('2026-10-13T12:05:00Z'),
  },
];

vi.mock('../client/src/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({
      developer: {
        personal: {
          accessCodes: { list: { invalidate: vi.fn() } },
          aiQuota: { logs: { invalidate: vi.fn() } },
        },
      },
    }),
    developer: {
      personal: {
        accessCodes: {
          list: { useQuery: () => ({ isLoading: false, data: sampleCodes }) },
          create: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
          revoke: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
        },
        aiQuota: {
          logs: { useQuery: () => ({ isLoading: false, isFetching: false, data: sampleLogs }) },
          recharge: { useMutation: () => ({ mutate: rechargeMock, isPending: false }) },
          resetDaily: { useMutation: () => ({ mutate: resetDailyMock, isPending: false }) },
          updateLimits: { useMutation: () => ({ mutate: updateLimitsMock, isPending: false }) },
        },
      },
    },
  },
}));

describe('إدارة أرصدة وسجلات الذكاء الاصطناعي في لوحة المطور', () => {
  afterEach(() => {
    cleanup();
    rechargeMock.mockClear();
    resetDailyMock.mockClear();
    updateLimitsMock.mockClear();
  });

  it('يعرض تفاصيل الحصص والأرصدة لرموز الوصول ويوفر أزرار الإدارة', () => {
    render(<DeveloperAccessCodes />);
    expect(screen.getByText('كود تجربة متجر النخبة')).toBeTruthy();
    expect(screen.getByText(/الرصيد: 85/)).toBeTruthy();
    expect(screen.getByText(/اليومي: 4 من 20/)).toBeTruthy();

    const resetDailyBtn = screen.getByRole('button', { name: /تصفير اليومي/ });
    expect(resetDailyBtn).toBeTruthy();
    fireEvent.click(resetDailyBtn);
    expect(resetDailyMock).toHaveBeenCalledWith({ id: 101 });

    const manageBtn = screen.getByRole('button', { name: 'إدارة الرصيد والحدود' });
    fireEvent.click(manageBtn);

    const recharge20Btn = screen.getByRole('button', { name: '+20' });
    fireEvent.click(recharge20Btn);
    expect(rechargeMock).toHaveBeenCalledWith({ id: 101, credits: 20 });
  });

  it('يعرض سجلات استهلاك الذكاء الاصطناعي ويتيح تصفيتها', () => {
    render(<DeveloperAiUsageLogs />);
    expect(screen.getByText('سجلات استهلاك الذكاء الاصطناعي')).toBeTruthy();
    expect(screen.getAllByText('القائد الذكي المتصل').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('صياغة النصوص التسويقية')).toBeTruthy();
    expect(screen.getByText('نجاح')).toBeTruthy();
    expect(screen.getByText('تجاوز الحد اليومي')).toBeTruthy();

    // Filter by feature
    fireEvent.change(screen.getByLabelText('تصفية الميزة'), { target: { value: 'connected_leader' } });
    expect(screen.getAllByText('القائد الذكي المتصل').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('صياغة النصوص التسويقية')).toBeNull();
  });
});
