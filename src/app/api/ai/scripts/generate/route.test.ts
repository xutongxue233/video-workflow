import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

describe("/api/ai/scripts/generate route", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns 422 when no runtime text model and no default env model are configured", async () => {
    vi.stubEnv("OPENAI_COMPAT_BASE_URL", "");
    vi.stubEnv("OPENAI_COMPAT_API_KEY", "");
    vi.stubEnv("OPENAI_SCRIPT_MODEL", "");

    const request = new Request("http://localhost/api/ai/scripts/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectId: "proj_1",
        productName: "Miniature Dragon",
        sellingPoints: ["high detail"],
        targetAudience: "tabletop gamers",
        tone: "energetic",
        durationSec: 30,
        contentLanguage: "zh-CN",
      }),
    });

    const response = await POST(request);
    const json = (await response.json()) as { message?: string };

    expect(response.status).toBe(422);
    expect(json.message).toContain("No text model configured");
  });

  it("returns 422 with provider error message when upstream text endpoint rejects request", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () =>
        '{"error":{"message":"Unsupported legacy protocol: /v1/chat/completions is not supported. Please use /v1/responses."}}',
    });
    vi.stubGlobal("fetch", fetchMock);

    const request = new Request("http://localhost/api/ai/scripts/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectId: "proj_1",
        productName: "Miniature Dragon",
        sellingPoints: ["high detail"],
        targetAudience: "tabletop gamers",
        tone: "energetic",
        durationSec: 30,
        contentLanguage: "zh-CN",
        modelProvider: {
          protocol: "openai",
          baseURL: "http://api.example.com/v1",
          apiKey: "sk-test",
          modelId: "gpt-5.2-codex",
        },
      }),
    });

    const response = await POST(request);
    const json = (await response.json()) as { message?: string };

    expect(response.status).toBe(422);
    expect(json.message).toContain("OpenAI-compatible request failed");
  });
});
