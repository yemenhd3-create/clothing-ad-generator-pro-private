import { describe, expect, it } from 'vitest';
import type { TrpcContext } from './_core/context';
import { appRouter } from './routers';

function createPublicContext(): { ctx: TrpcContext; cookies: Array<{ name: string; value: string }> } {
  const cookies: Array<{ name: string; value: string }> = [];
  return {
    cookies,
    ctx: {
    user: null,
    req: { protocol: 'https', headers: {} } as TrpcContext['req'],
    res: {
      cookie: (name: string, value: string) => cookies.push({ name, value }),
      clearCookie: () => undefined,
    } as TrpcContext['res'],
    },
  };
}

describe('developer.login', () => {
  it('accepts the configured server secrets through the lightweight developer endpoint', async () => {
    const username = process.env.DEVELOPER_PANEL_USERNAME;
    const password = process.env.DEVELOPER_PANEL_PASSWORD;

    expect(username, 'DEVELOPER_PANEL_USERNAME must be configured').toBeTruthy();
    expect(password, 'DEVELOPER_PANEL_PASSWORD must be configured').toBeTruthy();

    const { ctx, cookies } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.developer.login({ username: username!, password: password! })).resolves.toMatchObject({
      authenticated: true,
    });
    expect(cookies).toHaveLength(1);

    const statusContext: TrpcContext = {
      ...ctx,
      req: { protocol: 'https', headers: { cookie: `${cookies[0]?.name}=${cookies[0]?.value}` } } as TrpcContext['req'],
    };
    const statusCaller = appRouter.createCaller(statusContext);
    await expect(statusCaller.developer.status()).resolves.toEqual({ authenticated: true });
  });

  it('rejects an incorrect password without exposing the configured value', async () => {
    const username = process.env.DEVELOPER_PANEL_USERNAME ?? 'missing-user';
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.developer.login({ username, password: 'incorrect-password' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });
});
