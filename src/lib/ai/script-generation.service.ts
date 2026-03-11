import type { PrismaClient } from "@prisma/client";

import { z } from "zod";

import { prisma as defaultPrisma } from "../db/prisma";
import { ensureWorkflowProjectExists } from "../projects/workflow-project";
import type { OpenAICompatibleChatClient } from "./openai-compatible.client";

const generationInputSchema = z.object({
  projectId: z.string().min(1),
  productName: z.string().min(1),
  sellingPoints: z.array(z.string().min(1)).min(1),
  targetAudience: z.string().min(1),
  tone: z.string().min(1),
  durationSec: z.number().int().positive().max(180),
  contentLanguage: z.enum(["zh-CN", "en-US"]).default("zh-CN"),
});

const generatedScriptSchema = z.object({
  title: z.string().min(1),
  hook: z.string().min(1),
  voiceover: z.string().min(1),
  cta: z.string().min(1),
  shots: z
    .array(
      z.object({
        index: z.number().int().positive(),
        durationSec: z.number().positive(),
        visual: z.string().min(1),
        caption: z.string().min(1),
        camera: z.string().min(1),
      }),
    )
    .min(1),
});

type GeneratedScript = z.infer<typeof generatedScriptSchema>;

type ScriptGenerationRepository = {
  createGeneratedScript(input: {
    projectId: string;
    title: string;
    hook: string;
    sellingPoints: string;
    storyboard: string;
    structuredJson: string;
    generatorModel: string;
    cta: string;
  }): Promise<{ id: string }>;
};

function buildSystemPrompt(): string {
  return [
    "You are a short-video copywriting and storyboard planner for 3D printing models.",
    "Return strictly valid JSON only.",
    "Output shape: {title,hook,voiceover,cta,shots:[{index,durationSec,visual,caption,camera}]}",
    "No markdown. No code fences. No additional keys.",
  ].join(" ");
}

function buildUserPrompt(input: z.infer<typeof generationInputSchema>): string {
  return JSON.stringify(
    {
      task: "Generate short-video script and storyboard",
      productName: input.productName,
      sellingPoints: input.sellingPoints,
      targetAudience: input.targetAudience,
      tone: input.tone,
      durationSec: input.durationSec,
      language: input.contentLanguage,
    },
    null,
    2,
  );
}

function toStoryboardText(script: GeneratedScript): string {
  return script.shots
    .map((shot) => `${shot.index}. ${shot.visual} | ${shot.caption} | ${shot.camera}`)
    .join("\n");
}

export function createScriptGenerationService(deps: {
  completionClient: OpenAICompatibleChatClient;
  repository: ScriptGenerationRepository;
  model: string;
}) {
  return {
    async generateAndSave(input: z.input<typeof generationInputSchema>): Promise<{
      scriptId: string;
      model: string;
      structuredJson: GeneratedScript;
    }> {
      const payload = generationInputSchema.parse(input);

      const rawCompletion = await deps.completionClient.createJsonCompletion({
        model: deps.model,
        systemPrompt: buildSystemPrompt(),
        userPrompt: buildUserPrompt(payload),
      });

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(rawCompletion);
      } catch {
        throw new Error("Model response must be valid JSON");
      }

      let structured: GeneratedScript;
      try {
        structured = generatedScriptSchema.parse(parsedJson);
      } catch {
        throw new Error("Model response failed schema validation");
      }

      const saved = await deps.repository.createGeneratedScript({
        projectId: payload.projectId,
        title: structured.title,
        hook: structured.hook,
        sellingPoints: payload.sellingPoints.join(", "),
        storyboard: toStoryboardText(structured),
        structuredJson: JSON.stringify(structured),
        generatorModel: deps.model,
        cta: structured.cta,
      });

      return {
        scriptId: saved.id,
        model: deps.model,
        structuredJson: structured,
      };
    },
  };
}

export function createPrismaScriptGenerationRepository(
  prisma: PrismaClient = defaultPrisma,
): ScriptGenerationRepository {
  return {
    async createGeneratedScript(input) {
      await ensureWorkflowProjectExists(prisma, input.projectId);

      const script = await prisma.script.create({
        data: {
          projectId: input.projectId,
          title: input.title,
          hook: input.hook,
          sellingPoints: input.sellingPoints,
          storyboard: input.storyboard,
          structuredJson: input.structuredJson,
          generatorModel: input.generatorModel,
          cta: input.cta,
        },
      });

      return { id: script.id };
    },
  };
}
