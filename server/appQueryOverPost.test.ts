import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import superjson from 'superjson';

const hoisted = vi.hoisted(() => ({
  user: { id: 7, openId: 'access_demo', name: 'مستخدم برمز', role: 'user' },
}));

// Stand-in for the real session check: only the right Bearer token is accepted.
vi.mock('./_core/sdk', () => ({
  sdk: {
    authenticateRequest: vi.fn(async (req: { headers: Record<string, string | undefined> }) => {
      if (req.headers.authorization === 'Bearer good-token') return hoisted.user;
      throw new Error('no session');
    }),
  },
}));

import { appRouter } from './routers';
import { createContext } from './_core/context';
import type { AppRouter } from './routers';

function listen(allowMethodOverride: boolean): Promise<{ server: Server; url: string }> {
  const app = express();
  app.use(express.json());
  app.use('/api/trpc', createExpressMiddleware({ router: appRouter, createContext, allowMethodOverride }));
  return new Promise(resolve => {
    const server = app.listen(0, () => {
      resolve({ server, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/trpc` });
    });
  });
}

function makeClient(url: string, opts: { post: boolean; token?: string }) {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url,
        transformer: superjson,
        ...(opts.post ? { methodOverride: 'POST' as const } : {}),
        headers: () => (opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      }),
    ],
  });
}

describe('طلبات القراءة من تطبيق الأندرويد (POST بدل GET)', () => {
  let enabled: { server: Server; url: string };
  let disabled: { server: Server; url: string };

  beforeAll(async () => {
    enabled = await listen(true);
    disabled = await listen(false);
  });
  afterAll(() => {
    enabled.server.close();
    disabled.server.close();
  });

  it('يتعرّف الخادم على المستخدم عند إرسال الاستعلام بطريقة POST مع مفتاح الدخول', async () => {
    const me = await makeClient(enabled.url, { post: true, token: 'good-token' }).auth.me.query();
    expect(me).toMatchObject({ id: 7, openId: 'access_demo' });
  });

  it('لا يعتبر الزائر بلا مفتاح مسجّلاً حتى مع POST', async () => {
    const me = await makeClient(enabled.url, { post: true }).auth.me.query();
    expect(me).toBeNull();
  });

  it('يبقى الاستعلام العادي بطريقة GET يعمل كما كان لنسخة الويب', async () => {
    const me = await makeClient(enabled.url, { post: false, token: 'good-token' }).auth.me.query();
    expect(me).toMatchObject({ id: 7 });
  });

  it('بدون تفعيل الخيار في الخادم يُرفض استعلام POST (لذلك التفعيل ضروري)', async () => {
    await expect(makeClient(disabled.url, { post: true, token: 'good-token' }).auth.me.query()).rejects.toThrow();
  });
});
