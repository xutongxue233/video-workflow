import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { prisma } from "../../../../lib/db/prisma";
import { createBullMQRenderQueuePort } from "../../../../lib/render/render-job.queue";
import { createPrismaRenderJobRepository } from "../../../../lib/render/render-job.repository";
import { createRenderJobService } from "../../../../lib/render/render-job.service";

const requestSchema = z.object({
  projectId: z.string().min(1),
  scriptId: z.string().min(1),
  aspectRatio: z.enum(["9:16", "16:9"]),
  voiceStyle: z.string().min(1),
  templateId: z.string().min(1).optional(),
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
      provider: "seadance",
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

    return NextResponse.json({ message: "failed to queue video generation" }, { status: 500 });
  }
}
