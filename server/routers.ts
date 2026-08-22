import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { developerProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { authenticateDeveloper } from "./developerAuth";
import { DEVELOPER_SESSION_COOKIE, DEVELOPER_SESSION_MAX_AGE_MS, isDeveloperSession, issueDeveloperSession } from './developerSession';
import { checkDeveloperProvider, deleteDeveloperProvider, listDeveloperProviders, saveDeveloperProvider, verifyConnectedLeaderProvider } from './developerProviders';
import { inspectPrivateKeyBatch } from './privateKeyInspector';
import { removeBackgroundFromProduct, runProductToModelTryOn } from './tryOn';
import { generateMarketingTextWithFallback } from './marketingText';
import { getConnectedLeaderReply } from './connectedLeader';
import { createAccessCode, listAccessCodes, redeemAccessCode, revokeAccessCode } from './accessCodes';
import { sdk } from './_core/sdk';
import {
  createUserMessage,
  getActiveAnnouncement,
  getUserAccess,
  listAnnouncements,
  listDeveloperMessages,
  listPersonalUsers,
  saveAnnouncement,
  getProjectAccessSettings,
  setProjectLoginRequired,
  setPersonalUserAccess,
  updateUserMessageStatus,
} from './personalWorkspace';

async function assertPersonalUserIsActive(userId: number) {
  const access = await getUserAccess(userId);
  if (!access.exists || access.isDisabled) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'تم إيقاف هذا الحساب من مساحة المشروع الشخصية. تواصل مع المطور إذا كان ذلك غير متوقع.' });
  }
  return access;
}

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  developer: router({
    login: publicProcedure
      .input(z.object({ username: z.string().min(1), password: z.string().min(1) }))
      .mutation(({ ctx, input }) => {
        if (!authenticateDeveloper(input.username, input.password)) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "بيانات المطور غير صحيحة" });
        }
        ctx.res.cookie(DEVELOPER_SESSION_COOKIE, issueDeveloperSession(), {
          ...getSessionCookieOptions(ctx.req),
          maxAge: DEVELOPER_SESSION_MAX_AGE_MS,
        });
        return { authenticated: true } as const;
      }),
    status: publicProcedure.query(({ ctx }) => ({ authenticated: isDeveloperSession(ctx.req) })),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(DEVELOPER_SESSION_COOKIE, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
      return { success: true } as const;
    }),
    providers: router({
      list: developerProcedure.query(() => listDeveloperProviders()),
      save: developerProcedure
        .input(z.object({
          id: z.string().uuid().optional(),
          name: z.string().min(1).max(120),
          baseUrl: z.string().url().max(500),
          model: z.string().min(1).max(160),
          apiKey: z.string().min(1).optional(),
          enabled: z.boolean(),
        }))
        .mutation(({ input }) => saveDeveloperProvider(input)),
      check: developerProcedure.input(z.object({ id: z.string().uuid() })).mutation(({ input }) => checkDeveloperProvider(input.id)),
      verifyLeader: developerProcedure.input(z.object({ id: z.string().uuid() })).mutation(({ input }) => verifyConnectedLeaderProvider(input.id)),
      remove: developerProcedure.input(z.object({ id: z.string().uuid() })).mutation(({ input }) => deleteDeveloperProvider(input.id)),
    }),
    privateKeyChat: router({
      inspectBatch: developerProcedure
        .input(z.object({ rawKeys: z.string().trim().min(1).max(12_000) }).strict())
        .mutation(({ input }) => inspectPrivateKeyBatch(input.rawKeys)),
    }),
    personal: router({
      announcements: developerProcedure.query(() => listAnnouncements()),
      saveAnnouncement: developerProcedure
        .input(z.object({ id: z.number().int().positive().optional(), message: z.string().trim().min(1).max(1200), isActive: z.boolean() }))
        .mutation(({ input }) => saveAnnouncement(input)),
      messages: developerProcedure.query(() => listDeveloperMessages()),
      updateMessageStatus: developerProcedure
        .input(z.object({ id: z.number().int().positive(), status: z.enum(['new', 'read', 'archived']) }))
        .mutation(({ input }) => updateUserMessageStatus(input.id, input.status)),
      users: developerProcedure.query(() => listPersonalUsers()),
      setUserAccess: developerProcedure
        .input(z.object({ id: z.number().int().positive(), isDisabled: z.boolean() }))
        .mutation(({ input }) => setPersonalUserAccess(input.id, input.isDisabled)),
      accessSettings: developerProcedure.query(() => getProjectAccessSettings()),
      setLoginRequired: developerProcedure
        .input(z.object({ loginRequired: z.boolean() }))
        .mutation(({ input }) => setProjectLoginRequired(input.loginRequired)),
      accessCodes: router({
        list: developerProcedure.query(() => listAccessCodes()),
        create: developerProcedure
          .input(z.object({
            label: z.string().trim().min(1).max(120),
            expiresAt: z.number().int().positive().optional(),
            maxUses: z.number().int().positive().max(1_000_000).optional(),
          }))
          .mutation(({ input }) => createAccessCode({
            label: input.label,
            expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
            maxUses: input.maxUses,
          })),
        revoke: developerProcedure
          .input(z.object({ id: z.number().int().positive() }))
          .mutation(({ input }) => revokeAccessCode(input.id)),
      }),
    }),
  }),
  projectAccess: router({
    mode: publicProcedure.query(async () => getProjectAccessSettings()),
  }),
  accessCodes: router({
    redeem: publicProcedure
      .input(z.object({ code: z.string().trim().min(12).max(80) }))
      .mutation(async ({ ctx, input }) => {
        const redeemed = await redeemAccessCode(input.code);
        const remainingMs = redeemed.expiresAt
          ? Math.max(1_000, redeemed.expiresAt.getTime() - Date.now())
          : undefined;
        const token = await sdk.createSessionToken(redeemed.openId, { name: redeemed.name, expiresInMs: remainingMs });
        ctx.res.cookie(COOKIE_NAME, token, {
          ...getSessionCookieOptions(ctx.req),
          maxAge: remainingMs,
        });
        return { success: true } as const;
      }),
  }),
  personal: router({
    access: protectedProcedure.query(async ({ ctx }) => assertPersonalUserIsActive(ctx.user.id)),
    announcement: protectedProcedure.query(async ({ ctx }) => {
      await assertPersonalUserIsActive(ctx.user.id);
      return getActiveAnnouncement();
    }),
    sendMessage: protectedProcedure
      .input(z.object({ message: z.string().trim().min(1).max(1200) }))
      .mutation(async ({ ctx, input }) => {
        await assertPersonalUserIsActive(ctx.user.id);
        return createUserMessage({ userId: ctx.user.id, message: input.message });
      }),
  }),
  leader: router({
    connected: protectedProcedure
      .input(z.object({ message: z.string().trim().min(1).max(1_200) }))
      .mutation(async ({ ctx, input }) => {
        await assertPersonalUserIsActive(ctx.user.id);
        return getConnectedLeaderReply(input.message);
      }),
  }),
  tryOn: router({
    run: protectedProcedure
      .input(z.object({
        productImageData: z.string().startsWith('data:image/').max(12_000_000),
        aspectRatio: z.enum(['4:5', '9:16']),
        presentation: z.enum(['women-fashion', 'men-fashion', 'kids-fashion', 'accessories']),
        pose: z.enum(['studio-standing', 'lifestyle-standing']),
        consent: z.literal(true),
        consentVersion: z.literal('tryon-v1'),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertPersonalUserIsActive(ctx.user.id);
        return runProductToModelTryOn(input.productImageData, input.aspectRatio, undefined, {
          presentation: input.presentation,
          pose: input.pose,
        });
      }),
    removeBackground: protectedProcedure
      .input(z.object({ productImageData: z.string().startsWith('data:image/').max(12_000_000) }))
      .mutation(async ({ ctx, input }) => {
        await assertPersonalUserIsActive(ctx.user.id);
        return removeBackgroundFromProduct(input.productImageData);
      }),
  }),

  marketingText: router({
    generate: protectedProcedure
      .input(z.object({
        details: z.object({
          productName: z.string().max(160),
          headline: z.string().max(220),
          discount: z.string().max(32),
          quantity: z.string().max(80),
          colors: z.array(z.string().max(80)).max(8),
          price: z.string().max(80),
          currency: z.string().max(32),
          features: z.array(z.string().max(160)).max(8),
          storeName: z.string().max(160),
          storePhone: z.string().max(80),
          marketingText: z.string().max(520),
          marketingPreferences: z.object({
            tone: z.enum(['exciting', 'persuasive', 'formal', 'playful']),
            length: z.enum(['short', 'medium', 'long']),
            goal: z.enum(['purchase', 'inquiry', 'showcase']),
            format: z.enum(['whatsapp', 'plain']).optional(),
          }).optional(),
        }),
        preferences: z.object({
          tone: z.enum(['exciting', 'persuasive', 'formal', 'playful']),
          length: z.enum(['short', 'medium', 'long']),
          goal: z.enum(['purchase', 'inquiry', 'showcase']),
          format: z.enum(['whatsapp', 'plain']),
        }),
        variant: z.number().int().min(0).max(20).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertPersonalUserIsActive(ctx.user.id);
        return generateMarketingTextWithFallback(
          { ...input.details, marketingText: '', marketingPreferences: undefined },
          input.preferences,
          input.variant
        );
      }),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
