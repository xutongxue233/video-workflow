import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { createOpenAICompatibleClient } from "../../../../../lib/ai/openai-compatible.client";
import {
  createPrismaScriptGenerationRepository,
  createScriptGenerationService,
} from "../../../../../lib/ai/script-generation.service";
import { prisma } from "../../../../../lib/db/prisma";

function buildService() {
  const baseURL = process.env.OPENAI_COMPAT_BASE_URL;
  const apiKey = process.env.OPENAI_COMPAT_API_KEY;
  const model = process.env.OPENAI_SCRIPT_MODEL;

  if (!baseURL || !apiKey || !model) {
    throw new Error(
      "Missing OPENAI_COMPAT_BASE_URL, OPENAI_COMPAT_API_KEY, or OPENAI_SCRIPT_MODEL",
    );
  }

  return createScriptGenerationService({
    completionClient: createOpenAICompatibleClient({
      baseURL,
      apiKey,
    }),
    repository: createPrismaScriptGenerationRepository(prisma),
    model,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const service = buildService();
    const generated = await service.generateAndSave(body);

    return NextResponse.json(generated, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          message: "invalid script generation payload",
          issues: error.issues,
        },
        { status: 400 },
      );
    }

    if (error instanceof Error && error.message.includes("schema")) {
      return NextResponse.json({ message: error.message }, { status: 422 });
    }

    if (error instanceof Error && error.message.includes("valid JSON")) {
      return NextResponse.json({ message: error.message }, { status: 422 });
    }

    return NextResponse.json({ message: "failed to generate script" }, { status: 500 });
  }
}
