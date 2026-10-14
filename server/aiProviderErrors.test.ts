import { beforeEach, describe, expect, it } from 'vitest';
import {
  classifyProviderError,
  clearAllProviderCooldowns,
  getActiveProviderCooldowns,
  isProviderInCooldown,
  markProviderCooldown,
  resetProviderCooldown,
} from './aiProviderErrors';

describe('AI provider error classification & key rotation', () => {
  beforeEach(() => {
    clearAllProviderCooldowns();
  });

  describe('classifyProviderError', () => {
    it('classifies 401 and 403 as INVALID_KEY with long cooldown and non-retryable', () => {
      const err401 = classifyProviderError(401);
      expect(err401).toMatchObject({
        kind: 'INVALID_KEY',
        status: 401,
        isRetryable: false,
        shouldCooldown: true,
      });

      const err403 = classifyProviderError(403, 'Forbidden access key');
      expect(err403).toMatchObject({
        kind: 'INVALID_KEY',
        status: 403,
        isRetryable: false,
        shouldCooldown: true,
      });
    });

    it('classifies 402 and quota/credit text as QUOTA_EXHAUSTED', () => {
      const err402 = classifyProviderError(402);
      expect(err402).toMatchObject({
        kind: 'QUOTA_EXHAUSTED',
        status: 402,
        isRetryable: false,
        shouldCooldown: true,
      });

      const err429Quota = classifyProviderError(429, 'insufficient_quota: you exceeded your current quota');
      expect(err429Quota).toMatchObject({
        kind: 'QUOTA_EXHAUSTED',
        isRetryable: false,
        shouldCooldown: true,
      });
    });

    it('classifies 429 without quota text as transient RATE_LIMIT with retryable status', () => {
      const err429 = classifyProviderError(429, 'Too many requests, please slow down');
      expect(err429).toMatchObject({
        kind: 'RATE_LIMIT',
        status: 429,
        isRetryable: true,
        shouldCooldown: true,
      });
    });

    it('classifies 500/502/503/504 and timeout errors as SERVICE_UNAVAILABLE', () => {
      const err503 = classifyProviderError(503);
      expect(err503).toMatchObject({
        kind: 'SERVICE_UNAVAILABLE',
        status: 503,
        isRetryable: true,
        shouldCooldown: true,
      });

      const errTimeout = classifyProviderError(undefined, new Error('The operation was aborted due to timeout'));
      expect(errTimeout).toMatchObject({
        kind: 'SERVICE_UNAVAILABLE',
        isRetryable: true,
        shouldCooldown: true,
      });
    });

    it('classifies 400 as BAD_REQUEST with no cooldown', () => {
      const err400 = classifyProviderError(400, 'Invalid JSON body format');
      expect(err400).toMatchObject({
        kind: 'BAD_REQUEST',
        status: 400,
        isRetryable: false,
        shouldCooldown: false,
      });
    });
  });

  describe('provider cooldown tracker', () => {
    it('sets, checks, and resets cooldown for a provider', () => {
      const now = 1_000_000;
      expect(isProviderInCooldown('test-provider', now)).toBe(false);

      markProviderCooldown('test-provider', 30_000, now);
      expect(isProviderInCooldown('test-provider', now + 10_000)).toBe(true);
      expect(isProviderInCooldown('test-provider', now + 30_000)).toBe(false);

      markProviderCooldown('test-provider', 30_000, now);
      resetProviderCooldown('test-provider');
      expect(isProviderInCooldown('test-provider', now + 10_000)).toBe(false);
    });
    it('returns active cooldowns via getActiveProviderCooldowns and cleans expired entries', () => {
      const now = 2_000_000;
      markProviderCooldown('prov-1', 20_000, now);
      markProviderCooldown('prov-2', 50_000, now);

      const active = getActiveProviderCooldowns(now + 10_000);
      expect(active['prov-1']).toMatchObject({
        inCooldown: true,
        remainingMs: 10_000,
        until: now + 20_000,
      });
      expect(active['prov-2']).toMatchObject({
        inCooldown: true,
        remainingMs: 40_000,
        until: now + 50_000,
      });

      const later = getActiveProviderCooldowns(now + 25_000);
      expect(later['prov-1']).toBeUndefined();
      expect(later['prov-2']).toBeDefined();
    });
  });
});
