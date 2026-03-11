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
    referenceAssets: z
      .array(
        z.object({
          id: z.string().min(1),
          projectId: z.string().min(1),
          fileName: z.string().min(1),
          url: z.string().min(1),
        }),
      )
      .max(8)
      .optional(),
    modelProvider: runtimeTextModelSchema.optional(),
  });

const modelInputValidationMarkers = [
  "schema",
  "valid JSON",
  "did not return JSON",
  "OpenAI-compatible request failed",
  "Gemini request failed",
  "response did not include message content",
  "response did not include candidate text",
  "Model response must be valid JSON",
  "Model response failed schema validation",
  "Foreign key constraint violated",
];

function mapKnownError(error: Error): { message: string; status: number } | null {
  if (error.message.includes("Missing OPENAI_COMPAT_BASE_URL")) {
    return {
      message: "No text model configured. Configure a text model in settings or provide modelProvider.",
      status: 422,
    };
  }

  if (modelInputValidationMarkers.some((marker) => error.message.includes(marker))) {
    return { message: error.message, status: 422 };
  }

  return null;
}

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
      referenceAssets: body.referenceAssets ?? [],
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

    if (error instanceof Error) {
      const mapped = mapKnownError(error);
      if (mapped) {
        return NextResponse.json({ message: mapped.message }, { status: mapped.status });
      }
    }

    return NextResponse.json({ message: "failed to generate script" }, { status: 500 });
  }
}
