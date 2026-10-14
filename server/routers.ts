import { createOfflineLeaseToken } from "./offlineToken";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { developerProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { authenticateDeveloper } from "./developerAuth";
import { DEVELOPER_SESSION_COOKIE, DEVELOPER_SESSION_MAX_AGE_MS, isDeveloperSession, issueDeveloperSession } from './developerSession';
import { checkDeveloperProvider, deleteDeveloperProvider, listDeveloperProviders, saveDeveloperProvider, verifyConnectedLeaderProvider } from './developerProviders';
import { getActiveProviderCooldowns, resetProviderCooldown, clearAllProviderCooldowns } from './aiProviderErrors';
import { inspectPrivateKeyBatch } from './privateKeyInspector';
import { removeBackgroundFromProduct, runProductToModelTryOn } from './tryOn';
import { generateMarketingTextWithFallback } from './marketingText';
import { checkAiQuota, deductAiQuota, getUserAiQuotaStatus, listAiUsageLogs, logAiUsage } from './aiQuotaGate';
import { generateLocalMarketingText, resolveMarketingTextPreferences } from '../shared/marketingText';
import { parseMerchantCommands } from '@shared/merchantAssistant';
import { resolveLocalLeaderPlan } from '@shared/localLeader';

import { getConnectedLeaderReply } from './connectedLeader';
import { createAccessCode, listAccessCodes, redeemAccessCode, revokeAccessCode, rechargeAccessCodeCredits, resetAccessCodeDailyLimit, updateAccessCodeAiLimits } from './accessCodes';
import { getUserByOpenId } from './db';
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
  setProjectRegistrationOpen,
  setProjectOfflineGraceHours,
  setPersonalUserAccess,
  touchUserPresence,
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
        const sessionToken = issueDeveloperSession();
        ctx.res.cookie(DEVELOPER_SESSION_COOKIE, sessionToken, {
          ...getSessionCookieOptions(ctx.req),
          maxAge: DEVELOPER_SESSION_MAX_AGE_MS,
        });
        return { authenticated: true, success: true, token: sessionToken } as const;
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
      cooldowns: developerProcedure.query(() => getActiveProviderCooldowns()),
      resetCooldown: developerProcedure
        .input(z.object({ id: z.string().min(1) }))
        .mutation(({ input }) => {
          resetProviderCooldown(input.id);
          return { success: true, id: input.id };
        }),
      clearAllCooldowns: developerProcedure
        .mutation(() => {
          clearAllProviderCooldowns();
          return { success: true };
        }),
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
      setRegistrationOpen: developerProcedure
        .input(z.object({ registrationOpen: z.boolean() }))
        .mutation(({ input }) => setProjectRegistrationOpen(input.registrationOpen)),
      setOfflineGraceHours: developerProcedure
        .input(z.object({ hours: z.number().int().min(0).max(720) }))
        .mutation(({ input }) => setProjectOfflineGraceHours(input.hours)),
      aiQuota: router({
        recharge: developerProcedure
          .input(z.object({ id: z.number().int().positive(), credits: z.number().int().positive() }))
          .mutation(({ input }) => rechargeAccessCodeCredits(input.id, input.credits)),
        resetDaily: developerProcedure
          .input(z.object({ id: z.number().int().positive() }))
          .mutation(({ input }) => resetAccessCodeDailyLimit(input.id)),
        updateLimits: developerProcedure
          .input(z.object({
            id: z.number().int().positive(),
            aiCreditsTotal: z.number().int().optional(),
            aiDailyLimit: z.number().int().optional(),
          }))
          .mutation(({ input }) => updateAccessCodeAiLimits(input.id, input)),
        logs: developerProcedure
          .input(z.object({ limit: z.number().int().positive().max(200).optional() }))
          .query(({ input }) => listAiUsageLogs(input.limit)),
      }),
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
        const settings = await getProjectAccessSettings();
        if (!settings.registrationOpen) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'التسجيل الجديد متوقف حالياً من لوحة المطور.' });
        }
        const redeemed = await redeemAccessCode(input.code);
        const remainingMs = redeemed.expiresAt
          ? Math.max(1_000, redeemed.expiresAt.getTime() - Date.now())
          : undefined;
        const remainingHours = remainingMs ? Math.ceil(remainingMs / (3600 * 1000)) : 24 * 365;
        const token = await sdk.createSessionToken(redeemed.openId, { name: redeemed.name, expiresInMs: remainingMs });
        ctx.res.cookie(COOKIE_NAME, token, {
          ...getSessionCookieOptions(ctx.req),
          maxAge: remainingMs,
        });

        const user = await getUserByOpenId(redeemed.openId);
        let offlineLeaseToken: string | undefined = undefined;
        if (user?.id) {
          try {
            offlineLeaseToken = await createOfflineLeaseToken(user.id, Math.min(remainingHours, 720));
          } catch (e) {
            console.warn('[Offline Lease] Failed to create offline lease on redeem:', e);
          }
        }

        return {
          success: true,
          token,
          user: user ?? null,
          expiresAt: redeemed.expiresAt ? redeemed.expiresAt.toISOString() : null,
          offlineLeaseToken,
          graceHours: Math.min(remainingHours, 720),
        } as const;
      }),
  }),
  personal: router({
    access: protectedProcedure.query(async ({ ctx }) => assertPersonalUserIsActive(ctx.user.id)),
    heartbeat: protectedProcedure
      .mutation(async ({ ctx }) => {
        await assertPersonalUserIsActive(ctx.user.id);
        const presence = await touchUserPresence(ctx.user.id);
        const settings = await getProjectAccessSettings();
        const offlineLeaseToken = await createOfflineLeaseToken(ctx.user.id, settings.offlineGraceHours);
        return { ...presence, offlineLeaseToken };
      }),
    aiQuota: protectedProcedure.query(async ({ ctx }) => {
      await assertPersonalUserIsActive(ctx.user.id);
      return getUserAiQuotaStatus(ctx.user.id);
    }),
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
      .input(z.object({
        message: z.string().trim().min(1).max(1_200),
        requestId: z.string().max(64).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertPersonalUserIsActive(ctx.user.id);
        const quotaCheck = await checkAiQuota({ userId: ctx.user.id, feature: 'connected_leader' });

        if (!quotaCheck.allowed) {
          const local = resolveLocalLeaderPlan(input.message, parseMerchantCommands(input.message));
          await logAiUsage({
            userId: ctx.user.id,
            accessCodeId: quotaCheck.accessCodeId,
            feature: 'connected_leader',
            provider: 'local',
            model: 'local-leader',
            status: quotaCheck.reason === 'daily_limit_exceeded' || quotaCheck.reason === 'credits_exhausted' ? 'quota_exceeded' : 'fallback_local',
          });
          return {
            reply: quotaCheck.message ? `${quotaCheck.message} (القائد المحلي: ${local.reply})` : `تعذر الوصول إلى القائد المتصل، القائد المحلي: ${local.reply}`,
            source: 'local-fallback' as const,
            usedFallback: true,
          };
        }

        const startTime = Date.now();
        const reply = await getConnectedLeaderReply(input.message);
        const duration = Date.now() - startTime;

        if (reply.source !== 'local-fallback') {
          await deductAiQuota({ accessCodeId: quotaCheck.accessCodeId, credits: 1, requestId: input.requestId });
          await logAiUsage({
            userId: ctx.user.id,
            accessCodeId: quotaCheck.accessCodeId,
            feature: 'connected_leader',
            provider: reply.source,
            model: reply.source,
            status: 'success',
            responseTimeMs: duration,
          });
        } else {
          await logAiUsage({
            userId: ctx.user.id,
            accessCodeId: quotaCheck.accessCodeId,
            feature: 'connected_leader',
            provider: 'local',
            model: 'local-leader',
            status: 'fallback_local',
            responseTimeMs: duration,
          });
        }

        return reply;
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
          storeLocation: z.string().max(160).optional().default(''),
          storeCategory: z.string().max(80).optional().default(''),
          marketingText: z.string().max(520),
          marketingPreferences: z.object({
            tone: z.enum(['exciting', 'persuasive', 'formal', 'playful']),
            length: z.enum(['short', 'medium', 'long']),
            goal: z.enum(['purchase', 'inquiry', 'showcase']),
            format: z.enum(['whatsapp', 'plain']).optional(),
            campaign: z.enum(['professional', 'passion', 'persuasive', 'new-arrival', 'eid-fitr', 'eid-adha', 'festival', 'women']).optional(),
            emphasis: z.enum(['normal', 'bold', 'featured']).optional(),
          }).optional(),
        }),
        preferences: z.object({
          tone: z.enum(['exciting', 'persuasive', 'formal', 'playful']),
          length: z.enum(['short', 'medium', 'long']),
          goal: z.enum(['purchase', 'inquiry', 'showcase']),
          format: z.enum(['whatsapp', 'plain']),
          campaign: z.enum(['professional', 'passion', 'persuasive', 'new-arrival', 'eid-fitr', 'eid-adha', 'festival', 'women']),
          emphasis: z.enum(['normal', 'bold', 'featured']),
        }),
        variant: z.number().int().min(0).max(20).optional(),
        requestId: z.string().max(64).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertPersonalUserIsActive(ctx.user.id);
        const quotaCheck = await checkAiQuota({ userId: ctx.user.id, feature: 'marketing_text' });

        if (!quotaCheck.allowed) {
          const resolvedPrefs = resolveMarketingTextPreferences(input.preferences || input.details.marketingPreferences);
          const local = generateLocalMarketingText({ ...input.details, marketingText: '', marketingPreferences: undefined }, resolvedPrefs, input.variant ?? 0);
          await logAiUsage({
            userId: ctx.user.id,
            accessCodeId: quotaCheck.accessCodeId,
            feature: 'marketing_text',
            provider: 'local',
            model: 'local-template',
            status: quotaCheck.reason === 'daily_limit_exceeded' || quotaCheck.reason === 'credits_exhausted' ? 'quota_exceeded' : 'fallback_local',
          });
          return {
            text: local.text,
            source: 'local-fallback' as const,
            message: quotaCheck.message || 'تم استخدام الصياغة المحلية لعدم توفر الرصيد السحابي.',
          };
        }

        const startTime = Date.now();
        const result = await generateMarketingTextWithFallback(
          { ...input.details, marketingText: '', marketingPreferences: undefined },
          input.preferences,
          input.variant
        );
        const duration = Date.now() - startTime;

        if (result.source === 'cloud') {
          await deductAiQuota({ accessCodeId: quotaCheck.accessCodeId, credits: 1, requestId: input.requestId });
          await logAiUsage({
            userId: ctx.user.id,
            accessCodeId: quotaCheck.accessCodeId,
            feature: 'marketing_text',
            provider: result.provider || 'cloud',
            model: result.provider || 'cloud',
            status: 'success',
            responseTimeMs: duration,
          });
        } else {
          await logAiUsage({
            userId: ctx.user.id,
            accessCodeId: quotaCheck.accessCodeId,
            feature: 'marketing_text',
            provider: 'local',
            model: 'local-template',
            status: 'fallback_local',
            responseTimeMs: duration,
          });
        }

        return result;
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
