import { afterEach, describe, expect, it, vi } from "vitest";

import { createGeminiCompatibleClient } from "./gemini-compatible.client";

describe("gemini-compatible client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests generateContent and returns text output", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: "{\"title\":\"ok\"}",
                  },
                ],
              },
            },
          ],
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = createGeminiCompatibleClient({
      baseURL: "https://generativelanguage.googleapis.com/v1beta",
      apiKey: "gem-key",
    });

    const content = await client.createJsonCompletion({
      model: "models/gemini-2.5-flash",
      systemPrompt: "system",
      userPrompt: "user",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=gem-key",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(content).toBe("{\"title\":\"ok\"}");
  });

  it("throws on non-ok response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => "denied",
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = createGeminiCompatibleClient({
      baseURL: "https://generativelanguage.googleapis.com/v1beta",
      apiKey: "gem-key",
    });

    await expect(
      client.createJsonCompletion({
        model: "gemini-2.5-flash",
        systemPrompt: "system",
        userPrompt: "user",
      }),
    ).rejects.toThrow("Gemini request failed: 403 denied");
  });

  it("throws clear error when provider returns html instead of json", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "<!doctype html><html><body>gateway page</body></html>",
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = createGeminiCompatibleClient({
      baseURL: "https://generativelanguage.googleapis.com/v1beta",
      apiKey: "gem-key",
    });

    await expect(
      client.createJsonCompletion({
        model: "gemini-2.5-flash",
        systemPrompt: "system",
        userPrompt: "user",
      }),
    ).rejects.toThrow("did not return JSON");
  });
});

