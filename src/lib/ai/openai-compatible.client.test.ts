import { afterEach, describe, expect, it, vi } from "vitest";

import { createOpenAICompatibleClient } from "./openai-compatible.client";

describe("openai-compatible client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns assistant content from json response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          choices: [
            {
              message: {
                content: "{\"title\":\"ok\"}",
              },
            },
          ],
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = createOpenAICompatibleClient({
      baseURL: "https://api.openai.com/v1",
      apiKey: "sk-test",
    });

    const result = await client.createJsonCompletion({
      model: "gpt-4.1-mini",
      systemPrompt: "sys",
      userPrompt: "usr",
    });

    expect(result).toBe("{\"title\":\"ok\"}");
  });

  it("throws clear error when provider returns html instead of json", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "<!doctype html><html><body>gateway page</body></html>",
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = createOpenAICompatibleClient({
      baseURL: "https://api.openai.com/v1",
      apiKey: "sk-test",
    });

    await expect(
      client.createJsonCompletion({
        model: "gpt-4.1-mini",
        systemPrompt: "sys",
        userPrompt: "usr",
      }),
    ).rejects.toThrow("did not return JSON");
  });

  it("falls back to responses api when chat completions is unsupported", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () =>
          '{"error":{"message":"Unsupported legacy protocol: /v1/chat/completions is not supported. Please use /v1/responses."}}',
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            output_text: "{\"title\":\"ok-from-responses\"}",
          }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const client = createOpenAICompatibleClient({
      baseURL: "https://api.openai.com/v1",
      apiKey: "sk-test",
    });

    const result = await client.createJsonCompletion({
      model: "gpt-4.1-mini",
      systemPrompt: "sys",
      userPrompt: "usr",
    });

    expect(result).toBe("{\"title\":\"ok-from-responses\"}");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/chat/completions");
    expect(fetchMock.mock.calls[1]?.[0]).toContain("/responses");
  });
});

