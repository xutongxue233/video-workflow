import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { prisma } from "@/lib/db/prisma";
import { ensureWorkflowProjectExists } from "@/lib/projects/workflow-project";

const createProjectSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});

function parseLimit(raw: string | null, fallback = 30): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(1, Math.min(100, Math.floor(parsed)));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId")?.trim();
  const limit = parseLimit(url.searchParams.get("limit"), 30);

  const projects = await prisma.project.findMany({
    where: projectId ? { id: projectId } : undefined,
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      name: true,
      description: true,
      updatedAt: true,
      _count: {
        select: {
          assets: true,
          scripts: true,
          renderJobs: true,
          videos: true,
        },
      },
      assets: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          url: true,
          fileName: true,
          createdAt: true,
        },
      },
      scripts: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: {
          id: true,
          title: true,
          updatedAt: true,
        },
      },
      renderJobs: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
          updatedAt: true,
          video: {
            select: {
              url: true,
            },
          },
        },
      },
    },
  });

  return NextResponse.json(
    {
      items: projects.map((project) => ({
        id: project.id,
        name: project.name,
        description: project.description,
        updatedAt: project.updatedAt,
        counts: {
          assets: project._count.assets,
          scripts: project._count.scripts,
          renderJobs: project._count.renderJobs,
          videos: project._count.videos,
        },
        latestAsset: project.assets[0] ?? null,
        latestScript: project.scripts[0] ?? null,
        latestRenderJob: project.renderJobs[0] ?? null,
      })),
    },
    { status: 200 },
  );
}

export async function POST(request: Request) {
  try {
    const body = createProjectSchema.parse(await request.json());

    await ensureWorkflowProjectExists(prisma, body.projectId);

    const project = await prisma.project.update({
      where: { id: body.projectId },
      data: {
        name: body.name?.trim() || undefined,
        description: body.description ?? undefined,
      },
      select: {
        id: true,
        name: true,
        description: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          message: "invalid project payload",
          issues: error.issues,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({ message: "failed to create project" }, { status: 500 });
  }
}
