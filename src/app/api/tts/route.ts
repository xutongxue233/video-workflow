import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { createLocalStorage } from "../../../lib/storage/local-storage";
import { createOpenAICompatibleTtsProvider } from "../../../lib/tts/providers/openai-compatible-tts.provider";
import { createTtsService } from "../../../lib/tts/tts.service";

const runtimeTtsModelSchema = z.object({
  protocol: z.literal("openai"),
  baseURL: z.string().url(),
  apiKey: z.string().min(1),
  modelId: z.string().min(1),
});

const requestSchema = z.object({
  scriptText: z.string().min(1),
  voiceStyle: z.string().min(1),
  modelProvider: runtimeTtsModelSchema.optional(),
});

function buildTtsProvider(input: { modelProvider?: z.infer<typeof runtimeTtsModelSchema> }) {
  if (input.modelProvider) {
    return createOpenAICompatibleTtsProvider({
      baseURL: input.modelProvider.baseURL,
      apiKey: input.modelProvider.apiKey,
      model: input.modelProvider.modelId,
      defaultVoice: process.env.OPENAI_TTS_VOICE ?? "alloy",
    });
  }

  const baseURL = process.env.OPENAI_TTS_BASE_URL ?? process.env.OPENAI_COMPAT_BASE_URL;
  const apiKey = process.env.OPENAI_TTS_API_KEY ?? process.env.OPENAI_COMPAT_API_KEY;
  const model = process.env.OPENAI_TTS_MODEL;

  if (!baseURL || !apiKey || !model) {
    throw new Error(
      "Missing OPENAI_TTS_BASE_URL/OPENAI_COMPAT_BASE_URL, OPENAI_TTS_API_KEY/OPENAI_COMPAT_API_KEY, or OPENAI_TTS_MODEL",
    );
  }

  return createOpenAICompatibleTtsProvider({
    baseURL,
    apiKey,
    model,
    defaultVoice: process.env.OPENAI_TTS_VOICE ?? "alloy",
  });
}

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const ttsService = createTtsService({
      provider: buildTtsProvider({ modelProvider: body.modelProvider }),
      storage: createLocalStorage({
        rootDir: process.env.LOCAL_STORAGE_ROOT ?? "storage",
      }),
    });
    const result = await ttsService.synthesize(body);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          message: "invalid tts payload",
          issues: error.issues,
        },
        { status: 400 },
      );
    }

    if (
      error instanceof Error &&
      error.message.includes("Missing OPENAI_TTS_BASE_URL/OPENAI_COMPAT_BASE_URL")
    ) {
      return NextResponse.json(
        {
          message:
            "No TTS model configured. Configure OPENAI_TTS_* env or provide modelProvider.",
        },
        { status: 422 },
      );
    }

    if (error instanceof Error && error.message.includes("OpenAI-compatible TTS request failed")) {
      return NextResponse.json({ message: error.message }, { status: 422 });
    }

    return NextResponse.json({ message: "failed to synthesize voiceover" }, { status: 500 });
  }
}
