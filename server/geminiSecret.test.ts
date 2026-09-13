import { describe, expect, it } from "vitest";

describe("Gemini project credential", () => {
  it("authenticates against the lightweight models catalog", async () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.log("Skipping Gemini test: GEMINI_API_KEY not configured");
      return;
    }
    expect(apiKey).toMatch(/\S+/);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
      { signal: AbortSignal.timeout(10_000) }
    );

    expect(response.ok).toBe(true);
    const payload = (await response.json()) as { models?: Array<{ name?: string }> };
    expect(payload.models?.some(model => model.name?.includes("gemini"))).toBe(true);
  }, 15_000);
});
