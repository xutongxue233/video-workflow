import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { createGeminiCompatibleClient } from "../../../../../lib/ai/gemini-compatible.client";
import { createOpenAICompatibleClient } from "../../../../../lib/ai/openai-compatible.client";
import {
  createPrismaScriptGenerationRepository,
  createScriptGenerationService,
} from "../../../../../lib/ai/script-generation.service";
import { prisma } from "../../../../../lib/db/prisma";

const runtimeTextModelSchema = z.object({
  protocol: z.enum(["openai", "gemini"]),
  baseURL: z.string().url(),
  apiKey: z.string().min(1),
  modelId: z.string().min(1),
});

const requestSchema = z
  .object({
    projectId: z.string().min(1),
    productName: z.string().min(1),
    sellingPoints: z.array(z.string().min(1)).min(1),
    targetAudience: z.string().min(1),
    tone: z.string().min(1),
    durationSec: z.number().int().positive().max(180),
    contentLanguage: z.enum(["zh-CN", "en-US"]).optional(),
    modelProvider: runtimeTextModelSchema.optional(),
  });

function buildService(input: { modelProvider?: z.infer<typeof runtimeTextModelSchema> }) {
  if (input.modelProvider) {
    return createScriptGenerationService({
      completionClient:
        input.modelProvider.protocol === "gemini"
          ? createGeminiCompatibleClient({
              baseURL: input.modelProvider.baseURL,
              apiKey: input.modelProvider.apiKey,
            })
          : createOpenAICompatibleClient({
              baseURL: input.modelProvider.baseURL,
              apiKey: input.modelProvider.apiKey,
            }),
      repository: createPrismaScriptGenerationRepository(prisma),
      model: input.modelProvider.modelId,
    });
  }

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
    const body = requestSchema.parse(await request.json());
    const service = buildService({ modelProvider: body.modelProvider });
    const generated = await service.generateAndSave({
      projectId: body.projectId,
      productName: body.productName,
      sellingPoints: body.sellingPoints,
      targetAudience: body.targetAudience,
      tone: body.tone,
      durationSec: body.durationSec,
      contentLanguage: body.contentLanguage,
    });

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
