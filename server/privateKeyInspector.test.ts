import { describe, expect, it, vi } from 'vitest';
import { MAX_PARALLEL_PRIVATE_KEY_CHECKS, identifyPrivateKeyProvider, inspectPrivateKeyBatch, splitPrivateKeyBatch } from './privateKeyInspector';

const geminiPrefix = String.fromCharCode(65, 73, 122, 97);
const openRouterPrefix = String.fromCharCode(115, 107, 45, 111, 114, 45, 118, 49, 45);
const freeAiPrefix = String.fromCharCode(115, 107, 45, 102, 114, 101, 101, 45);
const genericSecretPrefix = String.fromCharCode(115, 107, 45);

describe('private API-key batch inspector', () => {
  it('recognizes only explicit provider signatures and keeps unknown keys local', () => {
    expect(identifyPrivateKeyProvider(geminiPrefix + 'a'.repeat(32))?.id).toBe('gemini');
    expect(identifyPrivateKeyProvider('hf_' + 'a'.repeat(32))?.id).toBe('hugging-face');
    expect(identifyPrivateKeyProvider(openRouterPrefix + 'a'.repeat(32))?.id).toBe('openrouter');
    expect(identifyPrivateKeyProvider('gsk_' + 'a'.repeat(32))?.id).toBe('groq');
    expect(identifyPrivateKeyProvider('r8_' + 'a'.repeat(32))?.id).toBe('replicate');
    expect(identifyPrivateKeyProvider('github_pat_' + 'a'.repeat(40))?.id).toBe('github');
    expect(identifyPrivateKeyProvider(freeAiPrefix + 'a'.repeat(32))?.id).toBe('free-ai');
    expect(identifyPrivateKeyProvider('sk-unknown-provider')).toBeUndefined();
  });

  it('never calls an external provider for a key whose provider is not recognized', async () => {
    const request = vi.fn();
    const raw = genericSecretPrefix + 'unknown-provider-token';
    const [result] = await inspectPrivateKeyBatch(raw, request);
    expect(request).not.toHaveBeenCalled();
    expect(result).toMatchObject({ provider: null, state: 'unrecognized' });
    expect(JSON.stringify(result)).not.toContain(raw);
  });

  it('uses a fixed official route and returns a result that never exposes the submitted key', async () => {
    const raw = geminiPrefix + 'a'.repeat(32);
    const request = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    const [result] = await inspectPrivateKeyBatch(raw, request);
    expect(request).toHaveBeenCalledWith('https://generativelanguage.googleapis.com/v1beta/models', expect.objectContaining({ method: 'GET' }));
    expect(result).toMatchObject({ provider: 'gemini', state: 'valid' });
    expect(JSON.stringify(result)).not.toContain(raw);
  });

  it('checks a GitHub development token separately and never presents it as an AI model key', async () => {
    const raw = 'ghp_' + 'a'.repeat(36);
    const request = vi.fn().mockResolvedValue(new Response('{"login":"private-account"}', { status: 200 }));
    const [result] = await inspectPrivateKeyBatch(raw, request);
    expect(request).toHaveBeenCalledWith('https://api.github.com/user', expect.objectContaining({ method: 'GET' }));
    expect(result).toMatchObject({ provider: 'github', state: 'valid', providerLabel: 'GitHub Personal Access Token' });
    expect(result.suggestedUses.join(' ')).toContain('ليس مفتاح نموذج');
    expect(JSON.stringify(result)).not.toContain(raw);
    expect(JSON.stringify(result)).not.toContain('private-account');
  });

  it('uses the documented Free.ai models route without exposing the submitted key', async () => {
    const raw = freeAiPrefix + 'a'.repeat(32);
    const request = vi.fn().mockResolvedValue(new Response('{"data":[]}', { status: 200 }));
    const [result] = await inspectPrivateKeyBatch(raw, request);
    expect(request).toHaveBeenCalledWith('https://api.free.ai/v1/models', expect.objectContaining({ method: 'GET' }));
    expect(result).toMatchObject({ provider: 'free-ai', state: 'valid', providerLabel: 'Free.ai API' });
    expect(JSON.stringify(result)).not.toContain(raw);
  });

  it('reports rejected and quota-limited keys without response bodies', async () => {
    const raw = `gsk_${'b'.repeat(32)}\nr8_${'c'.repeat(32)}`;
    const request = vi.fn().mockResolvedValueOnce(new Response('forbidden-body', { status: 403 })).mockResolvedValueOnce(new Response('provider-limit-body', { status: 429 }));
    const results = await inspectPrivateKeyBatch(raw, request);
    expect(results.map(result => result.state)).toEqual(['invalid', 'limited']);
    expect(JSON.stringify(results)).not.toContain('forbidden-body');
    expect(JSON.stringify(results)).not.toContain('provider-limit-body');
  });

  it('limits an unlabelled batch to a safe bounded size', () => {
    expect(() => splitPrivateKeyBatch(Array.from({ length: 41 }, (_, index) => `key-${index}`).join('\n'))).toThrow('40');
  });

  it('limits parallel recognized-provider checks to protect external quotas', async () => {
    let active = 0;
    let highestActive = 0;
    const request = vi.fn().mockImplementation(async () => {
      active += 1;
      highestActive = Math.max(highestActive, active);
      await new Promise(resolve => setTimeout(resolve, 1));
      active -= 1;
      return new Response('{}', { status: 200 });
    });
    const raw = Array.from({ length: MAX_PARALLEL_PRIVATE_KEY_CHECKS + 2 }, (_, index) => `${geminiPrefix}${String(index).padStart(2, '0')}${'a'.repeat(30)}`).join('\n');
    await inspectPrivateKeyBatch(raw, request);
    expect(highestActive).toBeLessThanOrEqual(MAX_PARALLEL_PRIVATE_KEY_CHECKS);
  });
});
