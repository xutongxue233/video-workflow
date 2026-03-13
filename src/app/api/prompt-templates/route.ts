import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { prisma } from "../../../lib/db/prisma";
import { parseLimit } from "../../../lib/http/query";
import { ensureWorkflowProjectExists, isDeletedProjectError } from "../../../lib/projects/workflow-project";

const createSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1).max(80),
  prompt: z.string().min(1).max(2000),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId")?.trim();
  const limit = parseLimit(url.searchParams.get("limit"), 50);
  if (!projectId) {
    return NextResponse.json({ message: "projectId is required" }, { status: 400 });
  }

  const items = await prisma.promptTemplate.findMany({
    where: {
      projectId,
      project: {
        deletedAt: null,
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
    take: limit,
    select: {
      id: true,
      projectId: true,
      name: true,
      prompt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ items }, { status: 200 });
}

export async function POST(request: Request) {
  try {
    const body = createSchema.parse(await request.json());
    await ensureWorkflowProjectExists(prisma, body.projectId);

    const item = await prisma.promptTemplate.create({
      data: {
        projectId: body.projectId,
        name: body.name.trim(),
        prompt: body.prompt.trim(),
      },
      select: {
        id: true,
        projectId: true,
        name: true,
        prompt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          message: "invalid prompt template payload",
          issues: error.issues,
        },
        { status: 400 },
      );
    }

    if (isDeletedProjectError(error)) {
      return NextResponse.json({ message: "project has been deleted" }, { status: 404 });
    }

    if (error instanceof Error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: "failed to create prompt template" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id")?.trim();
  const projectId = url.searchParams.get("projectId")?.trim();

  if (!id || !projectId) {
    return NextResponse.json({ message: "id and projectId are required" }, { status: 400 });
  }

  const deleted = await prisma.promptTemplate.deleteMany({
    where: {
      id,
      projectId,
    },
  });

  if (deleted.count === 0) {
    return NextResponse.json({ message: "template not found" }, { status: 404 });
  }

  return NextResponse.json({ id }, { status: 200 });
}

