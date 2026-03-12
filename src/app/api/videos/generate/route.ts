import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

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
  firstFrameUrl: z.string().url().optional(),
  lastFrameUrl: z.string().url().optional(),
  referenceImageUrls: z.array(z.string().url()).max(REFERENCE_ASSET_SELECTION_LIMIT).optional(),
  referenceAssets: z.array(
    z.object({
      id: z.string().min(1),
      projectId: z.string().min(1),
      fileName: z.string().min(1).nullable().optional(),
      url: z.string().url(),
    }),
  ).max(REFERENCE_ASSET_SELECTION_LIMIT).optional(),
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
}).superRefine((value, ctx) => {
  if (value.lastFrameUrl && !value.firstFrameUrl) {
    ctx.addIssue({
      path: ["firstFrameUrl"],
      code: z.ZodIssueCode.custom,
      message: "firstFrameUrl is required when lastFrameUrl is provided",
    });
  }

  if (
    (Array.isArray(value.referenceImageUrls) && value.referenceImageUrls.length > 0
      || Array.isArray(value.referenceAssets) && value.referenceAssets.length > 0) &&
    (typeof value.firstFrameUrl === "string" || typeof value.lastFrameUrl === "string")
  ) {
    ctx.addIssue({
      path: ["referenceImageUrls"],
      code: z.ZodIssueCode.custom,
      message: "referenceImageUrls cannot be combined with firstFrameUrl/lastFrameUrl",
    });
  }
});

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());

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
      firstFrameUrl: body.firstFrameUrl,
      lastFrameUrl: body.lastFrameUrl,
      referenceImageUrls: body.referenceImageUrls,
      referenceAssets: body.referenceAssets,
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

    return NextResponse.json({ message: "failed to queue video generation" }, { status: 500 });
  }
}
