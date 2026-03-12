import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { prisma } from "../../../../../lib/db/prisma";
import { buildRenderPayload } from "../../../../../lib/render/render-job";
import { createPrismaRenderJobRepository } from "../../../../../lib/render/render-job.repository";
import { parseStoryboardProgress } from "../../../../../lib/render/storyboard-progress";
import { buildRenderQueueJobOptions, getRenderQueue } from "../../../../../lib/queue/render-queue";
import { REFERENCE_ASSET_SELECTION_LIMIT } from "../../../../../lib/reference-assets.constants";

const retryBodySchema = z.object({
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

type RetryBody = z.infer<typeof retryBodySchema>;

function toRetryQueueJobId(jobId: string): string {
  return `retry:${jobId}:${Date.now()}`;
}

function parseAspectRatio(value: string): "9:16" | "16:9" | null {
  if (value === "9:16" || value === "16:9") {
    return value;
  }
  return null;
}

function isMergeStuckStoryboard(job: {
  status: string;
  videoUrl?: string | null;
  externalStatus?: string | null;
}): boolean {
  if (job.videoUrl) {
    return false;
  }

  const progress = parseStoryboardProgress(job.externalStatus);
  if (!progress) {
    return false;
  }

  if (progress.total <= 0) {
    return false;
  }

  if (progress.completed !== progress.total || progress.failed !== 0) {
    return false;
  }

  return progress.shots.every((shot) => shot.status === "succeeded" && typeof shot.videoUrl === "string");
}

async function parseRetryBody(request: Request): Promise<RetryBody> {
  if (!request.body) {
    return {};
  }

  try {
    const json = await request.json();
    return retryBodySchema.parse(json ?? {});
  } catch (error) {
    if (error instanceof ZodError) {
      throw error;
    }

    throw new Error("invalid retry payload");
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const visibleJob = await prisma.renderJob.findFirst({
      where: {
        id,
        project: {
          deletedAt: null,
        },
      },
      select: { id: true },
    });

    if (!visibleJob) {
      return NextResponse.json({ message: "Render job not found" }, { status: 404 });
    }

    const body = await parseRetryBody(request);

    const repository = createPrismaRenderJobRepository(prisma);
    const job = await repository.findById(id);

    if (!job) {
      return NextResponse.json({ message: "Render job not found" }, { status: 404 });
    }

    if (job.videoUrl) {
      return NextResponse.json(
        {
          renderJobId: job.id,
          status: job.status,
          skipped: true,
          videoUrl: job.videoUrl,
        },
        { status: 200 },
      );
    }

    if ((job.status === "RUNNING" || job.status === "QUEUED") && !isMergeStuckStoryboard(job)) {
      return NextResponse.json(
        { message: "Render job is already in progress" },
        { status: 409 },
      );
    }

    if (!job.scriptId) {
      return NextResponse.json(
        { message: "Render job is missing scriptId and cannot be retried" },
        { status: 422 },
      );
    }

    const aspectRatio = parseAspectRatio(job.aspectRatio);
    if (!aspectRatio) {
      return NextResponse.json(
        { message: `Render job has unsupported aspect ratio: ${job.aspectRatio}` },
        { status: 422 },
      );
    }

    const queueJobId = toRetryQueueJobId(job.id);
    const payload = buildRenderPayload({
      projectId: job.projectId,
      templateId: job.templateId,
      scriptId: job.scriptId,
      voiceStyle: job.voiceStyle,
      aspectRatio,
      durationSec: body.durationSec,
      firstFrameUrl: body.firstFrameUrl,
      lastFrameUrl: body.lastFrameUrl,
      referenceImageUrls: body.referenceImageUrls,
      referenceAssets: body.referenceAssets,
      requestNonce: body.requestNonce ?? queueJobId,
      provider: body.selectedVideoModel?.protocol ?? job.provider ?? "seadance",
      selectedVideoModel: body.selectedVideoModel,
    });

    await getRenderQueue().add("render", payload, buildRenderQueueJobOptions(queueJobId));
    await repository.markRunning(job.id);

    return NextResponse.json(
      {
        renderJobId: job.id,
        status: "QUEUED",
      },
      { status: 202 },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          message: "invalid retry payload",
          issues: error.issues,
        },
        { status: 400 },
      );
    }

    if (error instanceof Error && error.message.includes("Job is already waiting")) {
      return NextResponse.json(
        { message: "Render job is already queued for retry" },
        { status: 409 },
      );
    }

    if (error instanceof Error && error.message === "invalid retry payload") {
      return NextResponse.json(
        { message: "invalid retry payload" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { message: "failed to enqueue retry" },
      { status: 500 },
    );
  }
}
