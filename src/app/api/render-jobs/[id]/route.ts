import { NextResponse } from "next/server";

import { prisma } from "../../../../lib/db/prisma";
import { createPrismaRenderJobRepository } from "../../../../lib/render/render-job.repository";
import { parseStoryboardProgress } from "../../../../lib/render/storyboard-progress";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
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

  const repository = createPrismaRenderJobRepository(prisma);
  const job = await repository.findById(id);

  if (!job) {
    return NextResponse.json({ message: "Render job not found" }, { status: 404 });
  }

  const progress = parseStoryboardProgress(job.externalStatus);

  return NextResponse.json(
    {
      ...job,
      progress: progress
        ? {
            completed: progress.completed,
            total: progress.total,
            failed: progress.failed,
          }
        : null,
      shotStatuses: progress?.shots ?? [],
    },
    { status: 200 },
  );
}
