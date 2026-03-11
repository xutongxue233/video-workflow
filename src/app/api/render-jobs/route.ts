import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { prisma } from "@/lib/db/prisma";
import { createBullMQRenderQueuePort } from "@/lib/render/render-job.queue";
import { createPrismaRenderJobRepository } from "@/lib/render/render-job.repository";
import { createRenderJobService } from "@/lib/render/render-job.service";

function parseLimit(raw: string | null, fallback = 40): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(1, Math.min(200, Math.floor(parsed)));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId")?.trim();
  const limit = parseLimit(url.searchParams.get("limit"), 40);

  const items = await prisma.renderJob.findMany({
    where: projectId ? { projectId } : undefined,
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
      video: {
        select: {
          url: true,
        },
      },
    },
  });

  return NextResponse.json(
    {
      items: items.map((job) => ({
        ...job,
        videoUrl: job.video?.url ?? null,
      })),
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

    return NextResponse.json(
      {
        message: "Failed to create render job",
      },
      { status: 500 },
    );
  }
}
