import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import {
  resolveProjectAssetsByIds,
  toAssetImageDataUrl,
} from "../../../../lib/assets/reference-asset.service";
import { createAssetService, createPrismaAssetRepository } from "../../../../lib/assets/asset.service";
import { prisma } from "../../../../lib/db/prisma";
import { createOpenAICompatibleSeedreamClient } from "../../../../lib/image/seedream-image.service";
import { isDeletedProjectError } from "../../../../lib/projects/workflow-project";
import { createLocalStorage } from "../../../../lib/storage/local-storage";

const outputSchema = z
  .coerce
  .number()
  .int()
  .min(1)
  .max(14);

const requestSchema = z
  .object({
    projectId: z.string().min(1),
    prompt: z.string().min(1).max(2000),
    outputCount: outputSchema.default(4),
    prototypeAssetId: z.string().min(1),
    referenceAssetIds: z.array(z.string().min(1)).max(13).default([]),
    size: z.string().max(32).optional(),
    selectedImageModel: z
      .object({
        protocol: z.enum(["openai", "seedream"]),
        baseURL: z.string().url(),
        apiKey: z.string().min(1),
        modelId: z.string().min(1),
      })
      .optional(),
  })
  .superRefine((input, ctx) => {
    const inputImageCount = 1 + input.referenceAssetIds.length;
    if (inputImageCount > 14) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["referenceAssetIds"],
        message: "input images must be <= 14 (prototype + references)",
      });
    }

    if (inputImageCount + input.outputCount > 15) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["outputCount"],
        message: "input images + outputCount must be <= 15",
      });
    }
  });

const assetStorage = createLocalStorage({
  rootDir: process.env.LOCAL_STORAGE_ROOT ?? "storage",
});

const assetService = createAssetService({
  storage: assetStorage,
  repository: createPrismaAssetRepository(prisma),
});

function toFileExtFromMime(mimeType: string): string {
  if (/png/i.test(mimeType)) {
    return "png";
  }
  if (/webp/i.test(mimeType)) {
    return "webp";
  }
  return "jpg";
}

function normalizeAssetUrl(url: string): string {
  if (url.startsWith("/files/")) {
    return `/api/files/${url.slice("/files/".length)}`;
  }
  return url;
}

function resolveImageModelConfig(input: z.infer<typeof requestSchema>["selectedImageModel"]) {
  if (input) {
    return {
      baseURL: input.baseURL,
      apiKey: input.apiKey,
      modelId: input.modelId,
    };
  }

  return {
    baseURL: process.env.SEEDREAM_BASE_URL ?? "https://ark.cn-beijing.volces.com/api/v3",
    apiKey: process.env.SEEDREAM_API_KEY ?? "",
    modelId: process.env.SEEDREAM_IMAGE_MODEL ?? "",
  };
}

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const model = resolveImageModelConfig(body.selectedImageModel);
    if (!model.apiKey.trim() || !model.modelId.trim() || !model.baseURL.trim()) {
      return NextResponse.json(
        {
          message: "missing image model config (baseURL/apiKey/modelId)",
        },
        { status: 400 },
      );
    }

    const targetAssetIds = [body.prototypeAssetId, ...body.referenceAssetIds];
    const resolvedAssets = await resolveProjectAssetsByIds({
      prisma,
      projectId: body.projectId,
      assetIds: targetAssetIds,
    });
    const byId = new Map(resolvedAssets.map((item) => [item.id, item]));
    const prototypeAsset = byId.get(body.prototypeAssetId);
    if (!prototypeAsset) {
      throw new Error(`prototype asset not found in project: ${body.prototypeAssetId}`);
    }

    const rootDir = process.env.LOCAL_STORAGE_ROOT ?? "storage";
    const imageDataUrls = await Promise.all([
      toAssetImageDataUrl({ rootDir, asset: prototypeAsset }),
      ...body.referenceAssetIds.map((assetId) => {
        const asset = byId.get(assetId);
        if (!asset) {
          throw new Error(`reference asset not found in project: ${assetId}`);
        }
        return toAssetImageDataUrl({
          rootDir,
          asset,
        });
      }),
    ]);

    const client = createOpenAICompatibleSeedreamClient({
      baseURL: model.baseURL,
      apiKey: model.apiKey,
    });

    const generatedImages = await client.generateImages({
      model: model.modelId,
      prompt: body.prompt,
      inputImageDataUrls: imageDataUrls,
      outputCount: body.outputCount,
      size: body.size,
    });

    const created = await Promise.all(
      generatedImages.map((image, index) =>
        assetService.uploadImageAsset({
          projectId: body.projectId,
          fileName: `generated-material-${Date.now()}-${index + 1}.${toFileExtFromMime(image.mimeType)}`,
          content: image.content,
        })),
    );

    return NextResponse.json(
      {
        generatedCount: created.length,
        items: created.map((item) => ({
          ...item,
          url: normalizeAssetUrl(item.url),
        })),
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          message: "invalid image generate payload",
          issues: error.issues,
        },
        { status: 400 },
      );
    }

    if (isDeletedProjectError(error)) {
      return NextResponse.json({ message: "project has been deleted" }, { status: 404 });
    }

    if (error instanceof Error) {
      return NextResponse.json({ message: error.message }, { status: 502 });
    }

    return NextResponse.json({ message: "failed to generate images" }, { status: 500 });
  }
}
