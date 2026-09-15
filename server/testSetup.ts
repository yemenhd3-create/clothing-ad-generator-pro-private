import 'dotenv/config';

// Keep the test suite runnable from a clean clone without ever committing or
// inventing production credentials. Real environment values still take precedence.
process.env.JWT_SECRET ||= 'vitest-only-jwt-secret';
process.env.DEVELOPER_PANEL_USERNAME ||= 'vitest-developer';
process.env.DEVELOPER_PANEL_PASSWORD ||= 'vitest-password';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof globalThis.ResizeObserver === 'undefined') globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
