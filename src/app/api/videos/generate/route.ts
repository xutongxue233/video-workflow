import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import {
  resolveProjectAssetsByIds,
  toAbsoluteAssetUrl,
} from "../../../../lib/assets/reference-asset.service";
import { prisma } from "../../../../lib/db/prisma";
import { createBullMQRenderQueuePort } from "../../../../lib/render/render-job.queue";
import { createPrismaRenderJobRepository } from "../../../../lib/render/render-job.repository";
import { createRenderJobService } from "../../../../lib/render/render-job.service";
import { isDeletedProjectError } from "../../../../lib/projects/workflow-project";
import { REFERENCE_ASSET_SELECTION_LIMIT } from "../../../../lib/reference-assets.constants";

const requestSchema = z.object({
  projectId: z.string().min(1),
  scriptId: z.string().min(1),
  aspectRatio: z.enum(["9:16", "16:9"]),
  voiceStyle: z.string().min(1),
  durationSec: z.number().int().min(-1).max(60).optional(),
  firstFrameAssetId: z.string().min(1).optional(),
  lastFrameAssetId: z.string().min(1).optional(),
  referenceAssetIds: z.array(z.string().min(1)).max(REFERENCE_ASSET_SELECTION_LIMIT).default([]),
  requestNonce: z.string().optional(),
  templateId: z.string().min(1).optional(),
  selectedVideoModel: z
    .object({
      protocol: z.enum(["seedance", "google"]),
      baseURL: z.string().url(),
      apiKey: z.string().min(1),
      modelId: z.string().min(1),
    })
    .optional(),
});

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const targetAssetIds = [
      body.firstFrameAssetId,
      body.lastFrameAssetId,
      ...body.referenceAssetIds,
    ].filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    const resolvedAssets = await resolveProjectAssetsByIds({
      prisma,
      projectId: body.projectId,
      assetIds: targetAssetIds,
    });
    const byId = new Map(resolvedAssets.map((item) => [item.id, item]));
    const resolveAssetUrl = (assetId: string | undefined) => {
      if (!assetId) {
        return undefined;
      }

      const asset = byId.get(assetId);
      if (!asset) {
        throw new Error(`reference asset not found in project: ${assetId}`);
      }

      return toAbsoluteAssetUrl(asset.url, request.url);
    };
    const referenceAssets = body.referenceAssetIds.map((assetId) => {
      const asset = byId.get(assetId);
      if (!asset) {
        throw new Error(`reference asset not found in project: ${assetId}`);
      }

      return {
        id: asset.id,
        projectId: asset.projectId,
        fileName: asset.fileName,
        url: toAbsoluteAssetUrl(asset.url, request.url),
      };
    });

    const service = createRenderJobService({
      repository: createPrismaRenderJobRepository(prisma),
      queue: createBullMQRenderQueuePort(),
    });

    const job = await service.create({
      projectId: body.projectId,
      templateId: body.templateId ?? "seadance-auto",
      scriptId: body.scriptId,
      voiceStyle: body.voiceStyle,
      aspectRatio: body.aspectRatio,
      durationSec: body.durationSec,
      firstFrameUrl: resolveAssetUrl(body.firstFrameAssetId),
      lastFrameUrl: resolveAssetUrl(body.lastFrameAssetId),
      referenceAssets,
      requestNonce: body.requestNonce,
      provider: body.selectedVideoModel?.protocol ?? "seadance",
      selectedVideoModel: body.selectedVideoModel,
    });

    return NextResponse.json(
      {
        renderJobId: job.id,
        status: job.status,
        provider: job.provider,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          message: "invalid video generation payload",
          issues: error.issues,
        },
        { status: 400 },
      );
    }

    if (isDeletedProjectError(error)) {
      return NextResponse.json({ message: "project has been deleted" }, { status: 404 });
    }

    if (error instanceof Error && error.message.includes("reference asset not found in project")) {
      return NextResponse.json({ message: error.message }, { status: 422 });
    }

    return NextResponse.json({ message: "failed to queue video generation" }, { status: 500 });
  }
}
