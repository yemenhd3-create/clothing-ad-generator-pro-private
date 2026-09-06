// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../client/src/App';

const { useModeQuery } = vi.hoisted(() => ({
  useModeQuery: vi.fn(() => ({ isLoading: false, data: { loginRequired: true, registrationOpen: true, offlineGraceHours: 72 } })),
}));

vi.mock('../client/src/lib/trpc', () => ({
  trpc: {
    projectAccess: { mode: { useQuery: useModeQuery } },
  },
}));

vi.mock('../client/src/components/PersonalAccessGate', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div><span>بوابة الدخول الإلزامي</span>{children}</div>,
}));

vi.mock('../client/src/components/AuthenticatedApplication', () => ({
  default: () => <div>التطبيق الكامل</div>,
}));

describe('الدخول العام', () => {
  afterEach(() => {
    cleanup();
    useModeQuery.mockClear();
    window.history.replaceState({}, '', '/');
  });

  it('يمرر المسار العادي عبر بوابة الدخول ولا يفتح Guest Mode', async () => {
    render(<App />);
    expect(await screen.findByText('بوابة الدخول الإلزامي')).toBeTruthy();
    expect(screen.queryByText('وضع محدود')).toBeNull();
    expect(screen.getByText('التطبيق الكامل')).toBeTruthy();
    expect(useModeQuery).toHaveBeenCalledTimes(1);
  });
});
