import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { prisma } from "@/lib/db/prisma";
import { createBullMQRenderQueuePort } from "@/lib/render/render-job.queue";
import { createPrismaRenderJobRepository } from "@/lib/render/render-job.repository";
import { createRenderJobService } from "@/lib/render/render-job.service";

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
