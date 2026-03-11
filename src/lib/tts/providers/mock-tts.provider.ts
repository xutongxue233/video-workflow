import { randomUUID } from "node:crypto";

import type { TtsProvider } from "../tts.types";

export function createMockTtsProvider(): TtsProvider {
  return {
    async synthesize(input) {
      const payload = {
        id: randomUUID(),
        scriptText: input.scriptText,
        voiceStyle: input.voiceStyle,
        generatedAt: new Date().toISOString(),
      };

      return {
        content: Buffer.from(JSON.stringify(payload, null, 2), "utf8"),
        mimeType: "audio/wav",
        extension: "wav",
        provider: "mock",
      };
    },
  };
}
