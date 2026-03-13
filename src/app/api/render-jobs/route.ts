import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { prisma } from "@/lib/db/prisma";
import { parseLimit } from "../../../lib/http/query";
import { parseReferenceAssetsJson } from "../../../lib/render/reference-assets";
import { parseStoryboardProgress } from "@/lib/render/storyboard-progress";
import { createBullMQRenderQueuePort } from "@/lib/render/render-job.queue";
import { createPrismaRenderJobRepository } from "@/lib/render/render-job.repository";
import { createRenderJobService } from "@/lib/render/render-job.service";
import { isDeletedProjectError } from "../../../lib/projects/workflow-project";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId")?.trim();
  const limit = parseLimit(url.searchParams.get("limit"), 40);

  const items = await prisma.renderJob.findMany({
    where: {
      ...(projectId ? { projectId } : {}),
      project: {
        deletedAt: null,
      },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      projectId: true,
      scriptId: true,
      voiceStyle: true,
      aspectRatio: true,
      provider: true,
      externalJobId: true,
      externalStatus: true,
      status: true,
      errorMessage: true,
      createdAt: true,
      updatedAt: true,
      referenceAssetsJson: true,
      video: {
        select: {
          url: true,
        },
      },
    },
  });

  return NextResponse.json(
    {
      items: items.map((job) => {
        const { referenceAssetsJson, ...rest } = job;
        return {
        ...rest,
        videoUrl: job.video?.url ?? null,
        referenceAssets: parseReferenceAssetsJson(referenceAssetsJson),
        progress: (() => {
          const parsed = parseStoryboardProgress(job.externalStatus);
          if (!parsed) {
            return null;
          }
          return {
            completed: parsed.completed,
            total: parsed.total,
            failed: parsed.failed,
          };
        })(),
      };
      }),
    },
    { status: 200 },
  );
}

export async function POST(request: Request) {
  const body = await request.json();

  const service = createRenderJobService({
    repository: createPrismaRenderJobRepository(prisma),
    queue: createBullMQRenderQueuePort(),
  });

  try {
    const job = await service.create(body);

    return NextResponse.json(job, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          message: "Invalid render job payload",
          issues: error.issues,
        },
        { status: 400 },
      );
    }

    if (isDeletedProjectError(error)) {
      return NextResponse.json({ message: "project has been deleted" }, { status: 404 });
    }

    return NextResponse.json(
      {
        message: "Failed to create render job",
      },
      { status: 500 },
    );
  }
}
