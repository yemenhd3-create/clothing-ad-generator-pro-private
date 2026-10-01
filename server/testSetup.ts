import 'dotenv/config';

// Keep the test suite runnable from a clean clone without ever committing or
// inventing production credentials. Real environment values still take precedence.
process.env.JWT_SECRET ||= 'vitest-only-jwt-secret';
process.env.DEVELOPER_PANEL_USERNAME ||= 'vitest-developer';
process.env.DEVELOPER_PANEL_PASSWORD ||= 'vitest-password';
// Dedicated test-only EC key pair for offline lease tokens. This is NOT the
// production key (which lives only in Render's env vars) — it is paired with
// the mocked public key in server/offlineToken.test.ts, never used for real data.
process.env.OFFLINE_LEASE_PRIVATE_JWK ||= JSON.stringify({
  kty: 'EC',
  crv: 'P-256',
  x: 'sZVDcDvW5uhltRbQp1xj4OZO2G7H0hoEb1lOXNYko6o',
  y: '_Y-Ui4tXRZF_KGsgOjKhMMH14zVkX4W5pqzbwtkuMEA',
  d: '_paOHv0cnFZ3DOxfuVa1VjKcpQCSDQnx9H1_tmiOIyY',
});

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof globalThis.ResizeObserver === 'undefined') globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
