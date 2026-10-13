import { afterEach, describe, expect, it, vi } from "vitest";
import { clearAllProviderCooldowns, markProviderCooldown } from "./aiProviderErrors";

const originalFetch = global.fetch;
const listEnabledConnectedLeaderProvidersMock = vi.hoisted(() => vi.fn());

vi.mock('./developerProviders', () => ({
  listEnabledConnectedLeaderProviders: listEnabledConnectedLeaderProvidersMock,
}));

async function loadLeader() {
  vi.resetModules();
  return import("./connectedLeader");
}

afterEach(() => {
  global.fetch = originalFetch;
  vi.unstubAllEnvs();
  listEnabledConnectedLeaderProvidersMock.mockReset();
  clearAllProviderCooldowns();
});

describe("connected leader provider chain", () => {
  it("uses Flash when its response is available", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "رد Flash" }] } }] }), { status: 200 }));
    const { getConnectedLeaderReply } = await loadLeader();
    await expect(getConnectedLeaderReply("أريد خطة للصورة")).resolves.toMatchObject({ source: "gemini-flash", reply: "رد Flash", usedFallback: false });
  });

  it("falls back to Flash-Lite when Flash fails", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    global.fetch = vi.fn()
      .mockResolvedValueOnce(new Response("temporary demand", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "رد Lite" }] } }] }), { status: 200 }));
    const { getConnectedLeaderReply } = await loadLeader();
    await expect(getConnectedLeaderReply("حسّن القالب")).resolves.toMatchObject({ source: "gemini-flash-lite", reply: "رد Lite", usedFallback: true });
  });

  it("returns the local leader safely when the online chain is unavailable", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    global.fetch = vi.fn().mockRejectedValue(new Error("offline"));
    const { getConnectedLeaderReply } = await loadLeader();
    const result = await getConnectedLeaderReply("أرفق شعاراً");
    expect(result.source).toBe("local-fallback");
    expect(result.usedFallback).toBe(true);
    expect(result.reply).toContain("القائد المحلي");
  });

  it("uses an enabled LLM7 alternative when Gemini is unavailable and keeps the saved key out of the reply", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const privateKey = 'new-private-key';
    listEnabledConnectedLeaderProvidersMock.mockResolvedValue([{ adapter: 'llm7', baseUrl: 'https://api.llm7.io/v1', model: 'default', apiKey: privateKey }]);
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: 'رد LLM7' } }] }), { status: 200 }));
    const { getConnectedLeaderReply } = await loadLeader();
    const result = await getConnectedLeaderReply("حسّن العنوان");
    expect(result).toMatchObject({ source: 'llm7', reply: 'رد LLM7', usedFallback: true });
    expect(global.fetch).toHaveBeenCalledWith('https://api.llm7.io/v1/chat/completions', expect.objectContaining({ method: 'POST' }));
    expect(JSON.stringify(result)).not.toContain(privateKey);
  });

  it("uses the fixed Free.ai chat route when its owner-enabled alternative is available", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    listEnabledConnectedLeaderProvidersMock.mockResolvedValue([{ adapter: 'free-ai', baseUrl: 'https://api.free.ai/v1', model: 'qwen7b', apiKey: 'new-private-key' }]);
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: 'رد Free.ai' } }] }), { status: 200 }));
    const { getConnectedLeaderReply } = await loadLeader();
    await expect(getConnectedLeaderReply("اقترح وصفاً قصيراً")).resolves.toMatchObject({ source: 'free-ai', reply: 'رد Free.ai', usedFallback: true });
    expect(global.fetch).toHaveBeenCalledWith('https://api.free.ai/v1/chat/', expect.objectContaining({ method: 'POST' }));
  });

  it("rotates past an unauthorized or quota-exhausted provider to the next valid alternative", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    listEnabledConnectedLeaderProvidersMock.mockResolvedValue([
      { adapter: 'llm7', baseUrl: 'https://api.llm7.io/v1', model: 'default', apiKey: 'bad-key' },
      { adapter: 'free-ai', baseUrl: 'https://api.free.ai/v1', model: 'qwen7b', apiKey: 'good-key' },
    ]);
    global.fetch = vi.fn()
      .mockResolvedValueOnce(new Response("Unauthorized", { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: 'رد Free.ai بعد التدوير' } }] }), { status: 200 }));

    const { getConnectedLeaderReply } = await loadLeader();
    const result = await getConnectedLeaderReply("اقتراح تصميم");
    expect(result).toMatchObject({ source: 'free-ai', reply: 'رد Free.ai بعد التدوير', usedFallback: true });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("skips a provider that is currently in cooldown and proceeds to the next provider", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    listEnabledConnectedLeaderProvidersMock.mockResolvedValue([
      { adapter: 'llm7', baseUrl: 'https://api.llm7.io/v1', model: 'default', apiKey: 'key-1' },
      { adapter: 'free-ai', baseUrl: 'https://api.free.ai/v1', model: 'qwen7b', apiKey: 'key-2' },
    ]);
    markProviderCooldown('llm7:default', 60_000);
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: 'رد فوري بدون انتظار' } }] }), { status: 200 }));

    const { getConnectedLeaderReply } = await loadLeader();
    const result = await getConnectedLeaderReply("اقتراح");
    expect(result).toMatchObject({ source: 'free-ai', reply: 'رد فوري بدون انتظار', usedFallback: true });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith('https://api.free.ai/v1/chat/', expect.anything());
  });
});
