import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TrpcContext } from './_core/context';

const listMock = vi.fn();
const saveMock = vi.fn();
const deleteMock = vi.fn();
const checkMock = vi.fn();

vi.mock('./developerSession', () => ({
  DEVELOPER_SESSION_COOKIE: 'test-developer-session',
  DEVELOPER_SESSION_MAX_AGE_MS: 1,
  isDeveloperSession: () => true,
  issueDeveloperSession: () => 'test-session',
}));
vi.mock('./developerProviders', () => ({
  listDeveloperProviders: listMock,
  saveDeveloperProvider: saveMock,
  deleteDeveloperProvider: deleteMock,
  checkDeveloperProvider: checkMock,
}));

const { appRouter } = await import('./routers');

function createContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: 'https', headers: {} } as TrpcContext['req'],
    res: { cookie: () => undefined, clearCookie: () => undefined } as TrpcContext['res'],
  };
}

describe('developer provider tRPC routes', () => {
  const provider = {
    id: 'd26bb412-9f8b-4e66-b3a6-d8b60f833aa0',
    name: 'Test provider',
    baseUrl: 'https://api.example.com/v1',
    model: 'try-on',
    enabled: true,
    hasApiKey: true,
    updatedAt: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    listMock.mockResolvedValue([provider]);
    saveMock.mockResolvedValue(provider);
    deleteMock.mockResolvedValue(undefined);
    checkMock.mockResolvedValue({ reachable: true, status: 200, message: 'تم الوصول إلى المزود.' });
  });

  it('returns provider summaries only and never any raw or encrypted API key', async () => {
    const caller = appRouter.createCaller(createContext());
    const result = await caller.developer.providers.list();

    expect(result).toEqual([provider]);
    expect(JSON.stringify(result)).not.toContain('apiKey');
    expect(JSON.stringify(result)).not.toContain('encryptedApiKey');
  });

  it('saves and checks a provider through protected routes without echoing the supplied key', async () => {
    const caller = appRouter.createCaller(createContext());
    const saved = await caller.developer.providers.save({
      name: provider.name,
      baseUrl: provider.baseUrl,
      model: provider.model,
      apiKey: 'never-return-this-key',
      enabled: true,
    });
    const status = await caller.developer.providers.check({ id: provider.id });

    expect(saveMock).toHaveBeenCalledWith(expect.objectContaining({ apiKey: 'never-return-this-key' }));
    expect(JSON.stringify(saved)).not.toContain('never-return-this-key');
    expect(status).toMatchObject({ reachable: true, status: 200 });
  });

  it('allows a developer to stop a saved provider without resubmitting its API key', async () => {
    const stoppedProvider = { ...provider, enabled: false };
    saveMock.mockResolvedValueOnce(stoppedProvider);
    const caller = appRouter.createCaller(createContext());
    const saved = await caller.developer.providers.save({
      id: provider.id,
      name: provider.name,
      baseUrl: provider.baseUrl,
      model: provider.model,
      enabled: false,
    });

    expect(saveMock).toHaveBeenCalledWith(expect.objectContaining({ id: provider.id, enabled: false }));
    expect(saveMock.mock.calls[0]?.[0]).not.toHaveProperty('apiKey');
    expect(saved.enabled).toBe(false);
  });
});
