import { afterEach, describe, expect, it, vi } from "vitest";

import { createOpenAICompatibleTtsProvider } from "./openai-compatible-tts.provider";

describe("openai-compatible tts provider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls /audio/speech and returns binary audio", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: vi.fn().mockReturnValue("audio/mpeg"),
      },
      arrayBuffer: vi.fn().mockResolvedValue(Uint8Array.from([1, 2, 3]).buffer),
    });

    vi.stubGlobal("fetch", fetchMock);

    const provider = createOpenAICompatibleTtsProvider({
      baseURL: "https://api.openai.com/v1",
      apiKey: "test-key",
      model: "gpt-4o-mini-tts",
    });

    const result = await provider.synthesize({
      scriptText: "Hello world",
      voiceStyle: "energetic",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/audio/speech",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(result.provider).toBe("openai-compatible");
    expect(result.mimeType).toBe("audio/mpeg");
    expect(result.extension).toBe("mp3");
    expect(result.content.length).toBe(3);
  });

  it("throws readable error when upstream tts fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: vi.fn().mockResolvedValue('{"error":"unauthorized"}'),
    });

    vi.stubGlobal("fetch", fetchMock);

    const provider = createOpenAICompatibleTtsProvider({
      baseURL: "https://api.openai.com/v1",
      apiKey: "bad-key",
      model: "gpt-4o-mini-tts",
    });

    await expect(
      provider.synthesize({
        scriptText: "Hello world",
        voiceStyle: "energetic",
      }),
    ).rejects.toThrow("OpenAI-compatible TTS request failed: 401");
  });
});
