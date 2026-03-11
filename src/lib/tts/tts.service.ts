import { z } from "zod";

import type { LocalStorage } from "../storage/local-storage";

import type { TtsProvider } from "./tts.types";

const synthesizeSchema = z.object({
  scriptText: z.string().min(1),
  voiceStyle: z.string().min(1),
});

export function createTtsService(deps: {
  provider: TtsProvider;
  storage: Pick<LocalStorage, "saveBuffer">;
}) {
  return {
    async synthesize(input: { scriptText: string; voiceStyle: string }) {
      const payload = synthesizeSchema.parse(input);

      const generated = await deps.provider.synthesize(payload);

      const saved = await deps.storage.saveBuffer({
        scope: "tts",
        fileName: `${payload.voiceStyle}.${generated.extension}`,
        content: generated.content,
      });

      return {
        provider: generated.provider,
        mimeType: generated.mimeType,
        storageKey: saved.storageKey,
        url: `/files/${saved.storageKey}`,
      };
    },
  };
}
