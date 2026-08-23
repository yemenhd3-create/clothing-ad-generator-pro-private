// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../client/src/App';

vi.mock('../client/src/lib/trpc', () => ({
  trpc: {
    projectAccess: { mode: { useQuery: () => ({ isLoading: false, data: { loginRequired: false } }) } },
  },
}));

vi.mock('../client/src/components/AuthenticatedApplication', () => ({
  default: ({ friendTestMode = false }: { friendTestMode?: boolean }) => <div>{friendTestMode ? 'وضع محدود' : 'التطبيق الكامل'}</div>,
}));

describe('الدخول المباشر', () => {
  afterEach(() => cleanup());

  it('يفتح التطبيق الكامل عندما يكون تأمين الدخول متوقفاً ولا يخفي صلاحيات المطور', async () => {
    render(<App />);
    expect(await screen.findByText('التطبيق الكامل')).toBeTruthy();
    expect(screen.queryByText('وضع محدود')).toBeNull();
  });
});
