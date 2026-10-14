import { ENV } from "./_core/env";
import { parseMerchantCommands } from "@shared/merchantAssistant";
import { resolveLocalLeaderPlan } from "@shared/localLeader";
import { listEnabledConnectedLeaderProviders, type EnabledConnectedLeaderProvider } from "./developerProviders";
import {
  classifyProviderError,
  isProviderInCooldown,
  markProviderCooldown,
  resetProviderCooldown,
} from "./aiProviderErrors";

export type ConnectedLeaderSource = "gemini-flash" | "gemini-flash-lite" | "llm7" | "free-ai" | "local-fallback";
type GeminiLeaderSource = "gemini-flash" | "gemini-flash-lite";

export type ConnectedLeaderReply = {
  reply: string;
  source: ConnectedLeaderSource;
  usedFallback: boolean;
};

const GEMINI_MODELS: Array<{ id: string; source: GeminiLeaderSource; thinkingLevel?: "LOW" }> = [
  { id: "gemini-flash-latest", source: "gemini-flash", thinkingLevel: "LOW" },
  { id: "gemini-flash-lite-latest", source: "gemini-flash-lite" },
];

function localFallback(message: string): ConnectedLeaderReply {
  const commands = parseMerchantCommands(message);
  const plan = resolveLocalLeaderPlan(message, commands);
  return {
    reply: `تعذر الوصول إلى القائد المتصل الآن، لذلك أكمل القائد المحلي معك: ${plan.reply}`,
    source: "local-fallback",
    usedFallback: true,
  };
}

function buildPrompt(message: string) {
  return `أنت القائد الذكي لتطبيق شخصي تعليمي يصمم صوراً للملابس على الهاتف. أجب بالعربية الدافئة والواضحة. ركز أولاً على: تجهيز صورة القطعة، جودة القالب، العنوان، الشعار، التذييل، والخطوات العملية داخل التطبيق. يمكنك تقديم نصائح وخطة قصيرة عند الطلب، لكن لا تدّعِ أنك نفذت تغييراً أو رأيت صورة لم تُرسل إليك. لا تطلب مفاتيح أو معلومات خاصة، ولا تقترح شراء خدمة كشرط. إذا كان الطلب يتضمن تغييراً في القالب، صف التغيير بصورة موجزة واذكر أنه يحتاج تأكيد المستخدم قبل التطبيق.

رسالة المستخدم:
${message}`;
}

async function askGemini(model: string, message: string, thinkingLevel?: "LOW"): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(ENV.geminiApiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(message) }] }],
        generationConfig: {
          temperature: 0.55,
          maxOutputTokens: 900,
          ...(thinkingLevel ? { thinkingConfig: { thinkingLevel } } : {}),
        },
      }),
      signal: AbortSignal.timeout(12_000),
    }
  );
  if (!response.ok) throw new Error(`Gemini returned ${response.status}`);
  const payload = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = payload.candidates?.[0]?.content?.parts?.map(part => part.text ?? "").join("\n").trim();
  if (!text) throw new Error("Gemini returned an empty reply");
  return text.slice(0, 4_000);
}

function extractOpenAiReply(payload: unknown) {
  const record = payload as { choices?: Array<{ message?: { content?: string } }> };
  const text = record.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Connected provider returned an empty reply");
  return text.slice(0, 4_000);
}

async function askStoredProvider(provider: EnabledConnectedLeaderProvider, message: string): Promise<string> {
  const url = provider.adapter === "free-ai"
    ? `${provider.baseUrl}/chat/`
    : `${provider.baseUrl}/chat/completions`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${provider.apiKey}` },
    body: JSON.stringify({
      model: provider.model,
      messages: [{ role: "system", content: buildPrompt(message) }],
      temperature: 0.55,
      max_tokens: 900,
      stream: false,
    }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Connected provider returned ${response.status}`);
  return extractOpenAiReply(await response.json());
}

export async function getConnectedLeaderReply(message: string): Promise<ConnectedLeaderReply> {
  if (ENV.geminiApiKey) {
    for (const candidate of GEMINI_MODELS) {
      const geminiKey = `gemini:${candidate.id}`;
      if (isProviderInCooldown(geminiKey)) continue;

      try {
        const reply = await askGemini(candidate.id, message, candidate.thinkingLevel);
        resetProviderCooldown(geminiKey);
        return { reply, source: candidate.source, usedFallback: candidate.source !== "gemini-flash" };
      } catch (err: unknown) {
        const statusMatch = err instanceof Error ? err.message.match(/returned (\d+)/) : null;
        const status = statusMatch ? Number(statusMatch[1]) : undefined;
        const classified = classifyProviderError(status, err instanceof Error ? err.message : undefined);
        if (classified.shouldCooldown) {
          markProviderCooldown(geminiKey, classified.cooldownMs);
        }
      }
    }
  }

  const alternatives = await Promise.resolve(listEnabledConnectedLeaderProviders()).catch(() => []);
  for (const provider of alternatives ?? []) {
    const providerKey = `${provider.adapter}:${provider.model}`;
    if (isProviderInCooldown(providerKey)) continue;

    try {
      const reply = await askStoredProvider(provider, message);
      resetProviderCooldown(providerKey);
      return { reply, source: provider.adapter, usedFallback: true };
    } catch (err: unknown) {
      const statusMatch = err instanceof Error ? err.message.match(/returned (\d+)/) : null;
      const status = statusMatch ? Number(statusMatch[1]) : undefined;
      const classified = classifyProviderError(status, err instanceof Error ? err.message : undefined);
      if (classified.shouldCooldown) {
        markProviderCooldown(providerKey, classified.cooldownMs);
      }
      // A stored provider must never prevent the local leader from answering.
    }
  }
  return localFallback(message);
}
