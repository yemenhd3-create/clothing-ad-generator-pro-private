import { describe, expect, it } from 'vitest';
import { createLoginLimiter } from './developerLoginLimiter';

describe('developer login limiter', () => {
  it('locks an address after 5 failures and unlocks after the lock time', () => {
    let time = 0;
    const limiter = createLoginLimiter({ now: () => time });
    for (let i = 0; i < 4; i += 1) limiter.recordFailure('1.1.1.1');
    expect(limiter.retryAfterSeconds('1.1.1.1')).toBe(0);
    limiter.recordFailure('1.1.1.1');
    expect(limiter.retryAfterSeconds('1.1.1.1')).toBe(900);
    time = 899_000;
    expect(limiter.retryAfterSeconds('1.1.1.1')).toBe(1);
    time = 901_000;
    expect(limiter.retryAfterSeconds('1.1.1.1')).toBe(0);
  });
  it('does not lock other addresses and forgets failures after success', () => {
    const limiter = createLoginLimiter();
    for (let i = 0; i < 5; i += 1) limiter.recordFailure('a');
    expect(limiter.retryAfterSeconds('b')).toBe(0);
    limiter.recordFailure('c'); limiter.recordSuccess('c');
    for (let i = 0; i < 4; i += 1) limiter.recordFailure('c');
    expect(limiter.retryAfterSeconds('c')).toBe(0);
  });
  it('ignores failures older than the window', () => {
    let time = 0;
    const limiter = createLoginLimiter({ now: () => time });
    for (let i = 0; i < 4; i += 1) limiter.recordFailure('x');
    time = 16 * 60_000;
    limiter.recordFailure('x');
    expect(limiter.retryAfterSeconds('x')).toBe(0);
  });
});

import { clientKeyFromRequest } from './developerLoginLimiter';

describe('clientKeyFromRequest', () => {
  it('uses the last forwarded address, which the hosting proxy adds', () => {
    expect(clientKeyFromRequest({ headers: { 'x-forwarded-for': '6.6.6.6, 9.9.9.9' }, socket: { remoteAddress: '10.0.0.1' } })).toBe('9.9.9.9');
  });
  it('falls back to the socket address', () => {
    expect(clientKeyFromRequest({ headers: {}, socket: { remoteAddress: '10.0.0.1' } })).toBe('10.0.0.1');
    expect(clientKeyFromRequest({ headers: {} })).toBe('unknown');
  });
});
