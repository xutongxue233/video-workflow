import { NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";
import { createBullMQRenderQueuePort } from "@/lib/render/render-job.queue";
import { createPrismaRenderJobRepository } from "@/lib/render/render-job.repository";
import { createRenderJobService } from "@/lib/render/render-job.service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const service = createRenderJobService({
    repository: createPrismaRenderJobRepository(prisma),
    queue: createBullMQRenderQueuePort(),
  });

  const job = await service.getById(id);

  if (!job) {
    return NextResponse.json({ message: "Render job not found" }, { status: 404 });
  }

  return NextResponse.json(job, { status: 200 });
}
