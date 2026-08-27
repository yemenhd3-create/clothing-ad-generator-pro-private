// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../client/src/App';

const { useModeQuery } = vi.hoisted(() => ({
  useModeQuery: vi.fn(() => ({ isLoading: false, data: { loginRequired: false } })),
}));

vi.mock('../client/src/lib/trpc', () => ({
  trpc: {
    projectAccess: { mode: { useQuery: useModeQuery } },
  },
}));

vi.mock('../client/src/components/AuthenticatedApplication', () => ({
  default: ({ friendTestMode = false }: { friendTestMode?: boolean }) => <div>{friendTestMode ? 'وضع محدود' : 'التطبيق الكامل'}</div>,
}));

describe('الدخول المباشر', () => {
  afterEach(() => {
    cleanup();
    useModeQuery.mockClear();
    window.history.replaceState({}, '', '/');
  });

  it('يفتح وضع ضيف محدود للأصدقاء من الرابط العادي بلا طلب تسجيل دخول', async () => {
    render(<App />);
    expect(await screen.findByText('وضع محدود')).toBeTruthy();
    expect(screen.queryByText('التطبيق الكامل')).toBeNull();
    expect(useModeQuery).not.toHaveBeenCalled();
  });
});
