import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { createLocalStorage } from "../../../lib/storage/local-storage";
import { createMockTtsProvider } from "../../../lib/tts/providers/mock-tts.provider";
import { createTtsService } from "../../../lib/tts/tts.service";

const ttsService = createTtsService({
  provider: createMockTtsProvider(),
  storage: createLocalStorage({
    rootDir: process.env.LOCAL_STORAGE_ROOT ?? "storage",
  }),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
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

    return NextResponse.json({ message: "failed to synthesize voiceover" }, { status: 500 });
  }
}
