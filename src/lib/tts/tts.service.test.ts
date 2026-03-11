import { describe, expect, it, vi } from "vitest";

import { createTtsService } from "./tts.service";

describe("tts service", () => {
  it("synthesizes audio and stores output", async () => {
    const provider = {
      synthesize: vi.fn().mockResolvedValue({
        content: Buffer.from("voice"),
        mimeType: "audio/wav",
        extension: "wav",
        provider: "mock",
      }),
    };

    const storage = {
      saveBuffer: vi.fn().mockResolvedValue({
        storageKey: "tts/voice_1.wav",
        absolutePath: "D:/storage/tts/voice_1.wav",
      }),
    };

    const service = createTtsService({ provider, storage });

    const result = await service.synthesize({
      scriptText: "This is demo voiceover",
      voiceStyle: "energetic",
    });

    expect(provider.synthesize).toHaveBeenCalledOnce();
    expect(storage.saveBuffer).toHaveBeenCalledOnce();
    expect(result.url).toBe("/files/tts/voice_1.wav");
    expect(result.mimeType).toBe("audio/wav");
  });

  it("rejects empty script text", async () => {
    const service = createTtsService({
      provider: {
        synthesize: vi.fn(),
      },
      storage: {
        saveBuffer: vi.fn(),
      },
    });

    await expect(
      service.synthesize({
        scriptText: "",
        voiceStyle: "energetic",
      }),
    ).rejects.toThrow("scriptText");
  });
});
