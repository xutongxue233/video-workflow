import type { PrismaClient } from "@prisma/client";

import { z } from "zod";

import { prisma as defaultPrisma } from "../db/prisma";
import { ensureWorkflowProjectExists } from "../projects/workflow-project";
import { REFERENCE_ASSET_SELECTION_LIMIT } from "../reference-assets.constants";
import type { OpenAICompatibleChatClient } from "./openai-compatible.client";
import {
  DEFAULT_SCRIPT_SCENE_TEMPLATE,
  getSceneTemplatePromptContext,
  scriptSceneTemplateSchema,
} from "./script-scene-template";

const generationInputSchema = z.object({
  projectId: z.string().min(1),
  productName: z.string().min(1),
  sellingPoints: z.array(z.string().min(1)).min(1),
  targetAudience: z.string().min(1),
  tone: z.string().min(1),
  durationSec: z.number().int().positive().max(60),
  contentLanguage: z.enum(["zh-CN", "en-US"]).default("zh-CN"),
  referenceAssets: z
    .array(
      z.object({
        id: z.string().min(1),
        projectId: z.string().min(1),
        fileName: z.string().min(1),
        url: z.string().min(1),
      }),
    )
    .max(REFERENCE_ASSET_SELECTION_LIMIT)
    .default([]),
  sceneTemplate: scriptSceneTemplateSchema.default(DEFAULT_SCRIPT_SCENE_TEMPLATE),
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

function buildSystemPrompt(sceneTemplate: z.infer<typeof scriptSceneTemplateSchema>): string {
  const context = getSceneTemplatePromptContext(sceneTemplate);
  return [
    "You are a short-video copywriter and storyboard planner.",
    `Scene template: ${context.title}.`,
    ...context.instructions,
    "Use only realistic, business-safe claims. Do not fabricate impossible data, awards, or guarantees.",
    "Return strictly valid JSON only.",
    "All user-facing text fields must be in the requested language.",
    "Use provided reference assets as visual guidance when available.",
    "Shots must align with durationSec and read as a coherent storefront storyboard: opening full-facade panorama, value-focused highlights, then conversion-driven close.",
    "Output shape: {title,hook,voiceover,cta,shots:[{index,durationSec,visual,caption,camera}]}",
    "No markdown. No code fences. No additional keys.",
  ].join(" ");
}

function buildUserPrompt(input: z.infer<typeof generationInputSchema>): string {
  const context = getSceneTemplatePromptContext(input.sceneTemplate);

  return JSON.stringify(
    {
      task: context.userTaskLabel,
      productName: input.productName,
      sellingPoints: input.sellingPoints,
      targetAudience: input.targetAudience,
      tone: input.tone,
      durationSec: input.durationSec,
      language: input.contentLanguage,
      sceneTemplate: input.sceneTemplate,
      campaignCoreValue:
        input.sceneTemplate === "storefront"
          ? "通过门头展示强化信任感与自然到店转化"
          : "通过结构化镜头叙事强化价值传达与转化",
      requiredSellingClaim: input.sceneTemplate === "storefront" ? "不用发传单也客流不断" : undefined,
      shotDirection:
        input.sceneTemplate === "storefront"
          ? [
              "起镜以门头全景动态展示建立第一眼吸引力",
              "中段突出核心价值与人流感知",
              "结尾给出到店行动引导",
            ]
          : [
              "第一段明确受众痛点或关注点",
              "中段展示核心卖点与可信证据",
              "结尾给出具体行动引导",
            ],
      referenceAssets: input.referenceAssets.map((asset) => ({
        id: asset.id,
        projectId: asset.projectId,
        fileName: asset.fileName,
        url: asset.url,
      })),
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
        systemPrompt: buildSystemPrompt(payload.sceneTemplate),
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
