import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { prisma } from "@/lib/db/prisma";
import { parseLimit } from "../../../lib/http/query";
import {
  WORKFLOW_DEFAULT_TEAM_ID,
  ensureWorkflowProjectExists,
  ensureWorkflowTeamExists,
  isDeletedProjectError,
} from "@/lib/projects/workflow-project";

const createProjectSchema = z
  .object({
    projectId: z.string().trim().min(1).optional(),
    name: z.string().trim().optional(),
    description: z.string().trim().optional(),
  })
  .superRefine((value, context) => {
    if (!value.projectId && !value.name) {
      context.addIssue({
        code: "custom",
        path: ["name"],
        message: "name is required when projectId is omitted",
      });
    }
  });

const deleteProjectSchema = z.object({
  projectId: z.string().trim().min(1),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId")?.trim();
  const limit = parseLimit(url.searchParams.get("limit"), 30, { max: 100 });

  const projects = await prisma.project.findMany({
    where: {
      deletedAt: null,
      ...(projectId ? { id: projectId } : {}),
    },
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

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const queryProjectId = url.searchParams.get("projectId")?.trim();
    const parsed = deleteProjectSchema.parse(
      queryProjectId ? { projectId: queryProjectId } : await request.json(),
    );

    const result = await prisma.project.updateMany({
      where: {
        id: parsed.projectId,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    if (result.count === 0) {
      return NextResponse.json({ message: "project not found" }, { status: 404 });
    }

    return NextResponse.json(
      {
        projectId: parsed.projectId,
        deleted: true,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          message: "invalid delete payload",
          issues: error.issues,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({ message: "failed to delete project" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = createProjectSchema.parse(await request.json());
    const description = body.description || undefined;

    if (body.projectId) {
      await ensureWorkflowProjectExists(prisma, body.projectId);

      const project = await prisma.project.update({
        where: { id: body.projectId },
        data: {
          name: body.name || undefined,
          description,
        },
        select: {
          id: true,
          name: true,
          description: true,
          updatedAt: true,
        },
      });

      return NextResponse.json(project, { status: 201 });
    }

    await ensureWorkflowTeamExists(prisma);
    const project = await prisma.project.create({
      data: {
        teamId: WORKFLOW_DEFAULT_TEAM_ID,
        name: body.name!,
        description,
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

    if (isDeletedProjectError(error)) {
      return NextResponse.json({ message: "project has been deleted" }, { status: 404 });
    }

    return NextResponse.json({ message: "failed to create project" }, { status: 500 });
  }
}
